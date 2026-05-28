'use strict';
const https = require('https');

const LIVE_URL = 'https://live.tradovateapi.com/v1';
const DEMO_URL = 'https://demo.tradovateapi.com/v1';

const POINT_VALUE = {
  MNQ: 2,   NQ: 20,   MES: 5,   ES: 50,
  MCL: 100, CL: 1000, MGC: 10,  GC: 100,
  M2K: 5,   RTY: 50,  YM: 5,    MYM: 0.5,
  MBT: 5,   BTC: 25,
};

function rootSymbol(name = '') {
  return name.replace(/[A-Z]\d+$/, '').replace(/\d+$/, '');
}
function normPair(name = '') {
  const r = rootSymbol(name);
  const MAP = {
    MNQ:'MNQ', NQ:'NQ', MES:'MES', ES:'ES', MGC:'MGC', GC:'GC',
    M2K:'M2K', RTY:'RTY', MCL:'MCL', CL:'CL', YM:'YM', MYM:'MYM',
    MBT:'MBT', BTC:'BTC',
  };
  return MAP[r] ?? (r || 'Autre');
}
function fmtDur(ms) {
  const s   = Math.floor(Math.max(0, ms) / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ── HTTP helper ───────────────────────────────────────────────
function apiCall(base, method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const u    = new URL(base + endpoint);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname,
      path:     u.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept:         'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve({}); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// ── Token cache: key = "username:env" ────────────────────────
const tokenCache = {};

function cacheKey(creds) {
  return `${creds.username}:${creds.env || 'live'}`;
}
function baseUrl(creds) {
  return (creds.env === 'demo') ? DEMO_URL : LIVE_URL;
}

async function getToken(creds) {
  const key    = cacheKey(creds);
  const cached = tokenCache[key];
  if (cached?.accessToken) {
    const exp = new Date(cached.expirationTime || 0).getTime();
    if (exp - Date.now() > 5 * 60 * 1000) return cached.accessToken;
  }
  const r = await apiCall(baseUrl(creds), 'POST', '/auth/accesstokenrequest', {
    name:       creds.username,
    password:   creds.password,
    appId:      creds.appId || 'TradingDashboard',
    appVersion: '1.0',
    cid:        creds.cid ?? 8,
    sec:        creds.sec ?? '',
  }, null);
  if (!r.accessToken) {
    throw new Error(r.errorText || 'Authentification échouée — vérifiez vos identifiants Tradovate');
  }
  tokenCache[key] = r;
  return r.accessToken;
}

// ── Test connection (no side effects) ────────────────────────
async function testConnect(creds) {
  const r = await apiCall(baseUrl(creds), 'POST', '/auth/accesstokenrequest', {
    name:       creds.username,
    password:   creds.password,
    appId:      creds.appId || 'TradingDashboard',
    appVersion: '1.0',
    cid:        creds.cid ?? 8,
    sec:        creds.sec ?? '',
  }, null);
  if (!r.accessToken) {
    throw new Error(r.errorText || 'Identifiants incorrects');
  }
  // Cache the token immediately so first sync is instant
  tokenCache[cacheKey(creds)] = r;
  return { userId: r.userId, tradovateUsername: r.name || creds.username };
}

// ── FIFO fill pairing → trades ────────────────────────────────
function pairFills(fills, cmap) {
  const sorted = [...fills].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const openLongs  = {};
  const openShorts = {};
  const trades     = [];

  for (const fill of sorted) {
    const cid      = fill.contractId;
    const contract = cmap[cid] ?? {};
    const pair     = normPair(contract.name);
    const vpp      = POINT_VALUE[pair] ?? contract.valuePerPoint ?? 1;

    if (!openLongs[cid])  openLongs[cid]  = [];
    if (!openShorts[cid]) openShorts[cid] = [];

    const isBuy  = fill.action === 'Buy';
    let   rem    = fill.qty ?? 1;
    const closeQ = isBuy ? openShorts[cid] : openLongs[cid];

    while (rem > 0 && closeQ.length > 0) {
      const entry = closeQ[0];
      const qty   = Math.min(rem, entry.qty);
      const dir   = isBuy ? 'SHORT' : 'LONG';
      const pnlPts = isBuy
        ? (entry.price - fill.price)
        : (fill.price  - entry.price);
      const result = Math.round(pnlPts * qty * vpp * 100) / 100;
      const durMs  = new Date(fill.timestamp).getTime() - new Date(entry.ts).getTime();

      trades.push({
        external_id: `tdv_${entry.fillId}_${fill.id}`,
        date:        entry.ts.slice(0, 10),
        pair,
        direction:   dir,
        entry:       entry.price,
        exit_price:  fill.price,
        stop: 0, tp: 0, rr: null,
        result,
        result_net:  result,
        fees:        null,
        commissions: null,
        size:        qty,
        outcome:     result > 0 ? 'WIN' : result < 0 ? 'LOSS' : 'BE',
        entered_at:  entry.ts,
        exited_at:   fill.timestamp,
        duration:    fmtDur(durMs),
        source:      'tradovate',
      });

      entry.qty -= qty;
      rem       -= qty;
      if (entry.qty <= 0) closeQ.shift();
    }

    if (rem > 0) {
      const openQ = isBuy ? openLongs[cid] : openShorts[cid];
      openQ.push({ price: fill.price, qty: rem, ts: fill.timestamp, fillId: fill.id });
    }
  }

  return trades;
}

// ── Sync one account ──────────────────────────────────────────
async function syncAccount(creds, insertTrade, db, dbPath) {
  const token = await getToken(creds);
  const base  = baseUrl(creds);

  const [rawFills, rawContracts] = await Promise.all([
    apiCall(base, 'GET', '/fill/list',     null, token),
    apiCall(base, 'GET', '/contract/list', null, token),
  ]);

  const fills     = Array.isArray(rawFills)     ? rawFills     : (rawFills?.d     ?? []);
  const contracts = Array.isArray(rawContracts) ? rawContracts : (rawContracts?.d ?? []);

  if (!Array.isArray(rawFills) && !fills.length) {
    throw new Error('Impossible de récupérer les fills — vérifiez les permissions API');
  }

  const cmap = {};
  for (const c of contracts) cmap[c.id] = c;

  const trades = pairFills(fills, cmap);

  let imported = 0, skipped = 0, errors = 0;
  for (const t of trades) {
    try {
      const r = insertTrade(db, dbPath, t);
      if (r.skipped) skipped++; else imported++;
    } catch { errors++; }
  }

  return { imported, skipped, errors, total: trades.length, syncedAt: new Date().toISOString() };
}

module.exports = { testConnect, syncAccount };
