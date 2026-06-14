const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path  = require('path');
const fs    = require('fs');
const http  = require('http');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// ── Load .env ─────────────────────────────────────────────────
(function loadEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(process.env.APPDATA || process.env.HOME || '', 'trading-dashboard', '.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch(_) {}
    break;
  }
})();

// ── Anthropic API ─────────────────────────────────────────────
function callAnthropicApi(messages, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Promise.reject(new Error('NO_API_KEY'));
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    const req = https.request({
      hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content?.[0]?.text ?? '');
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// ── Anthropic long call (4096 tokens) ────────────────────────
function callAnthropicApiLong(messages, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Promise.reject(new Error('NO_API_KEY'));
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    const req = https.request({
      hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error.message));
          resolve(p.content?.[0]?.text ?? '');
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── MNQ multi-day OHLCV fetch (symbol = URL-encoded Yahoo ticker) ─
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function calcHighLow(candles) {
  if (!candles.length) return { high: null, low: null };
  return {
    high: Math.round(Math.max(...candles.map(c => c.high ?? 0))),
    low:  Math.round(Math.min(...candles.map(c => c.low ?? Infinity))),
  };
}

async function fetchNQRange(fromDate, toDate, interval, symbol) {
  const sym = symbol ?? 'MNQ%3DF'; // default MNQ=F
  const p1 = Math.floor(new Date(fromDate + 'T00:00:00Z').getTime() / 1000);
  const p2 = Math.floor(new Date(toDate   + 'T23:59:59Z').getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&period1=${p1}&period2=${p2}&events=`;
  const raw = await new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
  const result = raw?.chart?.result?.[0];
  if (!result) throw new Error('Pas de données MNQ');
  const ts = result.timestamp ?? [];
  const q  = result.indicators?.quote?.[0] ?? {};
  return ts.map((t, i) => ({
    ts: t,
    iso: new Date(t * 1000).toISOString(),
    open:  q.open?.[i], high: q.high?.[i],
    low:   q.low?.[i],  close: q.close?.[i],
    vol:   q.volume?.[i],
  })).filter(c => c.open != null && c.close != null);
}

// ── Parse AI response: split text from chart zones JSON ──────
function parseChartZones(raw) {
  const m = raw.match(/---CHART_ZONES---\s*([\s\S]*?)\s*---END_CHART_ZONES---/);
  let zones   = { fvgs: [], swings: [], liquidity: [] };
  let content = raw;
  if (m) {
    try { zones = JSON.parse(m[1]); } catch(_) {}
    content = raw.replace(/---CHART_ZONES---[\s\S]*?---END_CHART_ZONES---/, '').trim();
  }
  return { content, zones };
}

const ZONES_INSTRUCTION = `

---INSTRUCTION GRAPHIQUE (OBLIGATOIRE)---
Après ton analyse, émets EXACTEMENT ce bloc JSON — FVGs, swings et niveaux de liquidité ICT :
---CHART_ZONES---
{"fvgs":[{"idx":0,"high":0,"low":0,"type":"bullish"}],"swings":[{"idx":0,"price":0,"type":"high","label":"HH"}],"liquidity":[{"price":0,"type":"BSL","label":"BSL","idx":0},{"price":0,"type":"SSL","label":"SSL","idx":0},{"price":0,"type":"EQH","label":"EQH","idx":0},{"price":0,"type":"EQL","label":"EQL","idx":0}]}
---END_CHART_ZONES---
RÈGLES :
- idx = numéro [N] de la bougie exacte dans les données OHLCV
- fvgs : max 3 FVGs bullish ou bearish clairement identifiés ([] si aucun)
- swings : max 4 points de structure HH/HL/LH/LL ([] si peu clairs)
- liquidity : BSL, SSL, EQH et EQL uniquement — jamais PDH/PDL/PWH/PWL (calculés séparément)
  BSL/SSL = liquidité resting ICT NON encore liquidés
  EQH = Equal Highs NON encore liquidés (double/triple top)
  EQL = Equal Lows NON encore liquidés (double/triple bottom)
  idx = numéro [N] exact de la bougie (obligatoire). MAX 6 niveaux. Prix = H ou L exact.
- Tous prix = entiers. Rien après ---END_CHART_ZONES---.`
// ── ICT analysis generation ───────────────────────────────────
async function generateIctAnalysis(type, date) {

  // ── DAILY — M15, 1 jour de contexte préalable ─────────────
  if (type === 'daily') {
    const ctxFrom = addDays(date, -3); // 3 jours arrière (couvre le vendredi si lundi)
    let candles = [];
    try { candles = await fetchNQRange(ctxFrom, date, '15m'); } catch(_) {}

    // Séparer candles de contexte vs jour d'analyse
    const ctxCandles  = candles.filter(c => new Date(c.ts * 1000).toISOString().slice(0,10) !== date);
    const dayCandles  = candles.filter(c => new Date(c.ts * 1000).toISOString().slice(0,10) === date);
    const ctxOffset   = ctxCandles.length;

    const fmtRow = (c, i) => {
      const d = new Date(c.ts * 1000);
      return `[${i}] ${d.toISOString().slice(0,10)} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}UTC  O:${c.open?.toFixed(0)} H:${c.high?.toFixed(0)} L:${c.low?.toFixed(0)} C:${c.close?.toFixed(0)}`;
    };
    const ctxRows = ctxCandles.map(fmtRow).join('\n') || '(aucune)';
    const dayRows = dayCandles.map((c, i) => fmtRow(c, ctxOffset + i)).join('\n') || 'Données non disponibles.';

    const dayLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('fr-FR',
      { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const raw = await callAnthropicApiLong([{ role:'user', content:
      `Génère un résumé de journée ICT complet pour le MNQ le ${date}.\n\n` +
      `CONTEXTE PRÉCÉDENT (M15 UTC, idx 0…${ctxOffset-1}):\n${ctxRows}\n\n` +
      `=== JOURNÉE ANALYSÉE : ${date} (idx ${ctxOffset}…) ===\n${dayRows}\n\n` +
      `Rédige l'analyse en Markdown structurée ainsi :\n\n` +
      `## 📊 RÉSUMÉ JOURNALIER — ${dayLabel}\n\n` +
      `### 🎯 BIAIS DU JOUR\n[Haussier/Baissier/Neutre avec justification]\n\n` +
      `### 📈 NIVEAUX CLÉS\n- Open: ...\n- High: ...\n- Low: ...\n- Close: ...\n- Variation: ...\n\n` +
      `### 🕐 ANALYSE PAR SESSION (heure Paris = UTC+2)\n\n` +
      `**Pre-Market (13h00–15h30):** ...\n\n**Opening Drive / Judas Swing (15h30–16h00):** ...\n\n` +
      `**Silver Bullet NY AM (16h00–17h00):** ...\n\n**Continuation (17h00–18h00):** ...\n\n` +
      `**NY Lunch (18h00–19h30):** ...\n\n**NY PM / Silver Bullet (19h30–21h00):** ...\n\n` +
      `### 💧 LIQUIDITÉ & ICT\n- Liquidité prise: ...\n- FVG identifiés (M15): ...\n- Displacement: ...\n- Draw On Liquidity (DOL): ...\n\n` +
      `### 🔭 NIVEAUX POUR DEMAIN\n- Résistances: ...\n- Supports: ...\n- Imbalances M15 à surveiller: ...\n\n` +
      `### ✅ BILAN ICT\n[2–3 phrases de synthèse ICT]` +
      ZONES_INSTRUCTION +
      '\n  RESTRICTION DAILY : les idx BSL/SSL/EQH/EQL doivent tous être >= ' + ctxOffset + ' (journée analysée). Pas de zones de liquidité sur le contexte précédent (idx < ctxOffset).'
    }],
    `Tu es un analyste expert ICT (Inner Circle Trader) sur le MNQ (Micro NASDAQ-100 Futures). Tu analyses les marchés en M15 pour des traders français (horaires CET/Paris). Sois précis, structuré et opérationnel.`);
    const { content, zones } = parseChartZones(raw);

    // Resoudre idx->ts pour zones IA (liquidity)
    const sortedD = [...candles].sort((a,b) => a.ts - b.ts);
    (zones.liquidity ?? []).forEach(l => { if (l.idx != null && l.ts == null) l.ts = sortedD[l.idx]?.ts; });

    // --- Niveaux deterministes PDH/PDL + PWH/PWL ---
    const fixedLevels = [];
    const ctxDates = [...new Set(ctxCandles.map(c => new Date(c.ts*1000).toISOString().slice(0,10)))].sort().reverse();
    if (ctxDates[0]) {
      const pdCandles = ctxCandles.filter(c => new Date(c.ts*1000).toISOString().slice(0,10) === ctxDates[0]);
      const { high: pdh, highTs: pdhTs, low: pdl, lowTs: pdlTs } = calcHighLow(pdCandles);
      if (pdh) fixedLevels.push({ price: pdh, type: 'PDH', label: 'PDH', ts: pdhTs });
      if (pdl) fixedLevels.push({ price: pdl, type: 'PDL', label: 'PDL', ts: pdlTs });
    }
    const analysisDay = new Date(date + 'T12:00:00Z');
    const dow         = analysisDay.getUTCDay();
    const daysToMon   = dow === 0 ? 6 : dow - 1;
    const thisMonday  = addDays(date, -daysToMon);
    const prevWkMon   = addDays(thisMonday, -7);
    const prevWkFri   = addDays(thisMonday, -3);
    let prevWkD1 = [];
    try { prevWkD1 = await fetchNQRange(prevWkMon, prevWkFri, '1d'); } catch(_) {}
    const { high: pwh, low: pwl } = calcHighLow(prevWkD1);
    if (pwh && prevWkD1.length) fixedLevels.push({ price: pwh, type: 'PWH', label: 'PWH', ts: sortedD[0]?.ts });
    if (pwl && prevWkD1.length) fixedLevels.push({ price: pwl, type: 'PWL', label: 'PWL', ts: sortedD[0]?.ts });
    const aiLiqDaily = (zones.liquidity ?? []).filter(l => ['BSL','SSL','EQH','EQL'].includes(l.type)).slice(0, 4);
    zones.liquidity = [...fixedLevels, ...aiLiqDaily];

    return { content, candles, zones,
      meta: { symbol: 'MNQ=F', from: ctxFrom, to: date, defaultTf: '15m' } };
  }

  // ── WEEKLY — H1, 1 semaine de contexte préalable ──────────
  if (type === 'weekly') {
    const friday    = new Date(date + 'T12:00:00Z');
    friday.setUTCDate(friday.getUTCDate() + 4);
    const fridayStr = friday.toISOString().slice(0,10);
    const ctxFrom   = addDays(date, -7); // semaine précédente
    let candles = [];
    try { candles = await fetchNQRange(ctxFrom, fridayStr, '1h'); } catch(_) {}

    const ctxCandles = candles.filter(c => c.ts < new Date(date + 'T00:00:00Z').getTime() / 1000);
    const wkCandles  = candles.filter(c => c.ts >= new Date(date + 'T00:00:00Z').getTime() / 1000);
    const ctxOffset  = ctxCandles.length;

    const fmtRow = (c, i) => {
      const d = new Date(c.ts * 1000);
      const day = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' });
      return `[${i}] ${day} ${String(d.getUTCHours()).padStart(2,'0')}h  O:${c.open?.toFixed(0)} H:${c.high?.toFixed(0)} L:${c.low?.toFixed(0)} C:${c.close?.toFixed(0)}`;
    };
    const ctxRows = ctxCandles.map(fmtRow).join('\n') || '(aucune)';
    const wkRows  = wkCandles.map((c, i) => fmtRow(c, ctxOffset + i)).join('\n') || 'Données non disponibles.';

    const d0 = new Date(date + 'T12:00:00Z');
    const d1 = new Date(fridayStr + 'T12:00:00Z');
    const wLabel = `${d0.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} – ${d1.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}`;

    const raw = await callAnthropicApiLong([{ role:'user', content:
      `Génère un bilan hebdomadaire ICT pour le MNQ. Semaine du ${wLabel}.\n\n` +
      `CONTEXTE SEMAINE PRÉCÉDENTE (H1, idx 0…${ctxOffset-1}):\n${ctxRows}\n\n` +
      `=== SEMAINE ANALYSÉE (idx ${ctxOffset}…) ===\n${wkRows}\n\n` +
      `Rédige en Markdown :\n\n## 📈 BILAN HEBDOMADAIRE — ${wLabel}\n\n` +
      `### 🎯 BIAIS DE SEMAINE\n[Direction + variation totale en pts et %]\n\n` +
      `### 📊 ANALYSE JOUR PAR JOUR\n[Pour chaque jour: move principal, liquidité prise, FVG notable en H1]\n\n` +
      `### 💧 LIQUIDITÉ DE LA SEMAINE\n- Début de semaine (lundi): ...\n- Mercredi (pivot ICT): ...\n- Fin de semaine (vendredi): ...\n\n` +
      `### 🔑 STRUCTURE DE MARCHÉ\n- Tendance (HH+HL / LH+LL): ...\n- BOS / CHOCH identifiés: ...\n- FVGs majeurs H1: ...\n\n` +
      `### 📌 NIVEAUX IMPORTANTS À RETENIR\n- Résistances majeures: ...\n- Supports majeurs: ...\n- Imbalances H1 non comblées: ...\n\n` +
      `### ✅ BILAN ICT DE LA SEMAINE\n[Synthèse en 2-3 phrases]` +
      ZONES_INSTRUCTION
    }],
    `Tu es un analyste expert ICT sur le MNQ (Micro NASDAQ-100 Futures). Tu rédiges des bilans hebdomadaires en H1 pour des traders français.`);
    const { content, zones } = parseChartZones(raw);

    // Resoudre idx->ts pour zones IA
    const sortedW = [...candles].sort((a,b) => a.ts - b.ts);
    (zones.liquidity ?? []).forEach(l => { if (l.idx != null && l.ts == null) l.ts = sortedW[l.idx]?.ts; });

    // PWH/PWL : semaine precedente = ctxCandles
    const fixedLevelsWk = [];
    const { high: pwhWk, highTs: pwhWkTs, low: pwlWk, lowTs: pwlWkTs } = calcHighLow(ctxCandles);
    if (pwhWk) fixedLevelsWk.push({ price: pwhWk, type: 'PWH', label: 'PWH', ts: pwhWkTs });
    if (pwlWk) fixedLevelsWk.push({ price: pwlWk, type: 'PWL', label: 'PWL', ts: pwlWkTs });
    const aiLiqWk = (zones.liquidity ?? []).filter(l => ['BSL','SSL','EQH','EQL'].includes(l.type)).slice(0, 4);
    zones.liquidity = [...fixedLevelsWk, ...aiLiqWk];

    return { content, candles, zones,
      meta: { symbol: 'MNQ=F', from: ctxFrom, to: fridayStr, defaultTf: '1h' } };
  }

  // ── NEXT_WEEK — H1, 2 semaines de contexte ────────────────
  if (type === 'next_week') {
    const friday    = new Date(date + 'T12:00:00Z');
    friday.setUTCDate(friday.getUTCDate() + 4);
    const fridayStr = friday.toISOString().slice(0,10);
    const ctxFrom   = addDays(date, -14);
    const lastFri   = addDays(date, -3);
    let candles = [];
    try { candles = await fetchNQRange(ctxFrom, lastFri, '1h'); } catch(_) {}

    const rows = candles.map((c, i) => {
      const d = new Date(c.ts * 1000);
      const day = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' });
      return `[${i}] ${day} ${String(d.getUTCHours()).padStart(2,'0')}h  O:${c.open?.toFixed(0)} H:${c.high?.toFixed(0)} L:${c.low?.toFixed(0)} C:${c.close?.toFixed(0)}`;
    }).join('\n') || 'Données non disponibles.';

    const d0 = new Date(date + 'T12:00:00Z');
    const d1 = new Date(fridayStr + 'T12:00:00Z');
    const wLabel = `${d0.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} – ${d1.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}`;

    const raw = await callAnthropicApiLong([{ role:'user', content:
      `Génère un plan de trading ICT pour la semaine prochaine du MNQ (${wLabel}).\n\n` +
      `CONTEXTE — MNQ 2 dernières semaines (H1, idx 0…${candles.length-1}):\n${rows}\n\n` +
      `Rédige en Markdown :\n\n## 🔭 PLAN ICT — Semaine du ${wLabel}\n\n` +
      `### 📊 CONTEXTE MACRO\n[Structure actuelle, tendance en cours, niveaux hebdo importants]\n\n` +
      `### 💧 LIQUIDITÉ À SURVEILLER\n- BSL (Buy Side): Equal Highs, PWH, Swing Highs\n- SSL (Sell Side): Equal Lows, PWL, Swing Lows\n\n` +
      `### 📐 FVGs & IMBALANCES H1\n[FVGs H1 importants non comblés pour la semaine]\n\n` +
      `### 📈 SCÉNARIO HAUSSIER\n[Conditions d'activation, niveaux entrée, cibles, invalidation]\n\n` +
      `### 📉 SCÉNARIO BAISSIER\n[Conditions d'activation, niveaux entrée, cibles, invalidation]\n\n` +
      `### 📅 PLAN JOUR PAR JOUR\n- **Lundi**: ...\n- **Mardi**: ...\n- **Mercredi** (pivot ICT): ...\n- **Jeudi**: ...\n- **Vendredi**: ...\n\n` +
      `### ⚠️ POINTS DE VIGILANCE\n[News macro, FOMC, NFP ou événements importants cette semaine]\n\n` +
      `### 🎯 SESSIONS PRIORITAIRES\n[Silver Bullet windows et moments clés à privilégier]` +
      ZONES_INSTRUCTION +
      '\n  RESTRICTION NEXT_WEEK : BSL/SSL/EQH/EQL uniquement si NON liquides par les ${candles.length-1} bougies de contexte disponibles. Seuls les niveaux vierges/non touchés sont pertinents. idx obligatoire.'
    }],
    `Tu es un analyste expert ICT sur le MNQ (Micro NASDAQ-100 Futures). Tu prépares des plans de trading hebdomadaires en H1 pour des traders français.`);
    const { content, zones } = parseChartZones(raw);

    // Resoudre idx->ts pour zones IA
    const sortedNW = [...candles].sort((a,b) => a.ts - b.ts);
    (zones.liquidity ?? []).forEach(l => { if (l.idx != null && l.ts == null) l.ts = sortedNW[l.idx]?.ts; });

    // PWH/PWL : derniere semaine des candles de contexte
    const fixedLevelsNW = [];
    const lastWkStart = new Date(addDays(date, -7) + 'T00:00:00Z').getTime() / 1000;
    const lastWkCandles = candles.filter(c => c.ts >= lastWkStart);
    const { high: pwhNW, highTs: pwhNWTs, low: pwlNW, lowTs: pwlNWTs } = calcHighLow(lastWkCandles);
    if (pwhNW) fixedLevelsNW.push({ price: pwhNW, type: 'PWH', label: 'PWH (sem. passée)', ts: pwhNWTs });
    if (pwlNW) fixedLevelsNW.push({ price: pwlNW, type: 'PWL', label: 'PWL (sem. passée)', ts: pwlNWTs });
    const aiLiqNW = (zones.liquidity ?? []).filter(l => ['BSL','SSL','EQH','EQL'].includes(l.type)).slice(0, 4);
    zones.liquidity = [...fixedLevelsNW, ...aiLiqNW];

    return { content, candles, zones,
      meta: { symbol: 'MNQ=F', from: ctxFrom, to: lastFri, defaultTf: '1h' } };
  }

  throw new Error(`Type inconnu: ${type}`);
}

let mainWindow;
let accounts;
let dbModule;
let marketDbMod;
let activeDb     = null;
let activeDbPath = null;
let globalDb     = null;
let globalDbPath = null;

// ── Bot webhook server ────────────────────────────────────────
let botServer      = null;
let botPort        = 3001;
let botSignals     = [];
let botSignalsFile = null;
let webhookLogs    = []; // max 50 dernières requêtes

function pushWebhookLog(entry) {
  webhookLogs.unshift(entry);
  if (webhookLogs.length > 50) webhookLogs = webhookLogs.slice(0, 50);
  mainWindow?.webContents.send('bot:webhook-log', entry);
}

function loadBotSignalsFromFile() {
  try {
    if (botSignalsFile && fs.existsSync(botSignalsFile)) {
      const raw = fs.readFileSync(botSignalsFile, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch(e) { console.error('[Bot] Erreur chargement historique:', e.message); }
  return [];
}

function saveBotSignalsToFile() {
  try {
    if (botSignalsFile) fs.writeFileSync(botSignalsFile, JSON.stringify(botSignals), 'utf-8');
  } catch(e) { console.error('[Bot] Erreur sauvegarde historique:', e.message); }
}

function startBotServer(port) {
  if (botServer) { try { botServer.close(); } catch(_) {} }
  botPort = port || 3001;
  botServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'POST' && req.url === '/webhook') {
      const from = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
      req.on('end', () => {
        const ts = new Date().toISOString();
        try {
          const signal = JSON.parse(body);
          const logType = signal.type === 'bar' ? 'bar' : signal.type === 'close' ? 'close' : 'signal';
          const logLabel = signal.type === 'bar' ? `BAR ${signal.bot ?? ''}` : signal.type === 'close' ? `CLOSE ${signal.result?.toUpperCase() ?? ''} ${signal.bot ?? ''}` : `${(signal.signal ?? signal.direction ?? '').toUpperCase() || 'SIGNAL'} ${signal.bot ?? ''} ${signal.symbol ?? ''}`;
          pushWebhookLog({ ts, from, type: logType, label: logLabel.trim(), status: 200 });

          // ── Signal de fermeture automatique (TP/SL détecté par TV) ──
          if (signal.type === 'close') {
            const outcome  = signal.result; // 'win' | 'loss' | 'be'
            const botName  = signal.bot;
            const target   = botSignals.find(s =>
              !s.type && !s._outcome &&
              (!botName || s.bot === botName)
            );
            if (target) {
              target._outcome     = outcome;
              target._autoOutcome = true;
              saveBotSignalsToFile();
              mainWindow?.webContents.send('bot:outcome-update', {
                id: String(target._id), outcome, auto: true,
              });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, matched: !!target }));
            return;
          }

          // ── Données de barre — détection TP/SL côté backend ──────
          if (signal.type === 'bar') {
            const h       = parseFloat(signal.h);
            const l       = parseFloat(signal.l);
            const botName = signal.bot;
            if (!isNaN(h) && !isNaN(l)) {
              // Filtre principal : même bot
              let opens = botSignals.filter(s =>
                !s.type && !s._outcome &&
                (!botName || s.bot === botName) &&
                (s.tp || s.tp2 || s.tp1) && s.sl && (s.signal || s.direction)
              );
              // Fallback : signaux sans champ bot (anciens signaux)
              if (opens.length === 0 && botName) {
                opens = botSignals.filter(s =>
                  !s.type && !s._outcome && !s.bot &&
                  (s.tp || s.tp2 || s.tp1) && s.sl && (s.signal || s.direction)
                );
              }
              let changed = false;
              for (const sig of opens) {
                const tp  = parseFloat(sig.tp) || parseFloat(sig.tp2) || parseFloat(sig.tp1);
                const sl  = parseFloat(sig.sl);
                const dir = (sig.signal || sig.direction || '').toUpperCase();
                let outcome = null;
                if (dir === 'LONG') {
                  if (h >= tp)       outcome = 'win';
                  else if (l <= sl)  outcome = 'loss';
                } else if (dir === 'SHORT') {
                  if (l <= tp)       outcome = 'win';
                  else if (h >= sl)  outcome = 'loss';
                }
                if (outcome) {
                  sig._outcome     = outcome;
                  sig._autoOutcome = true;
                  changed = true;
                  mainWindow?.webContents.send('bot:outcome-update', {
                    id: String(sig._id), outcome, auto: true,
                  });
                }
              }
              if (changed) saveBotSignalsToFile();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // ── Signal d'entrée normal ──
          signal._id         = Date.now() + Math.random();
          signal._receivedAt = new Date().toISOString();
          botSignals.unshift(signal);
          if (botSignals.length > 2000) botSignals = botSignals.slice(0, 2000);
          saveBotSignalsToFile();
          mainWindow?.webContents.send('bot:signal', signal);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch(e) {
          console.error('[webhook] JSON parse error:', e.message, '| body:', body.slice(0, 300));
          pushWebhookLog({ ts: new Date().toISOString(), from, type: 'error', label: `400 JSON INVALIDE — ${body.slice(0, 60)}`, status: 400 });
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON', body: body.slice(0, 200) }));
        }
      });
    } else {
      res.writeHead(404); res.end();
    }
  });
  botServer.on('error', (e) => {
    console.error('[Bot] Server error:', e.message);
    mainWindow?.webContents.send('bot:server-error', e.message);
  });
  botServer.listen(botPort, '127.0.0.1', () => {
    console.log(`[Bot] Webhook server listening on port ${botPort}`);
    mainWindow?.webContents.send('bot:server-ready', botPort);
  });
}

async function init() {
  accounts    = require('./accounts.cjs');
  dbModule    = require('./database.cjs');
  marketDbMod = require('./market_db.cjs');
}

async function loadActiveDb() {
  const active = accounts.getActiveAccount();
  if (!active) { activeDb = null; activeDbPath = null; return null; }
  activeDbPath = active.dbPath;
  activeDb     = await dbModule.getDb(activeDbPath);
  return activeDb;
}

async function loadGlobalDb() {
  globalDbPath = path.join(app.getPath('userData'), 'global.db');
  globalDb     = await dbModule.getDb(globalDbPath);
  // One-time migration: copy analyses from all account DBs
  const migFlag = path.join(app.getPath('userData'), '.analyses_migrated');
  if (!fs.existsSync(migFlag)) {
    try {
      const { accounts: accs } = accounts.getAllAccounts();
      for (const acc of accs) {
        try {
          const accDb = await dbModule.getDb(acc.dbPath);
          for (const a of dbModule.getDailyAnalyses(accDb)) {
            try { dbModule.upsertDailyAnalysis(globalDb, globalDbPath, a); } catch(_) {}
          }
          for (const a of dbModule.getWeeklyAnalyses(accDb)) {
            try { dbModule.upsertWeeklyAnalysis(globalDb, globalDbPath, a); } catch(_) {}
          }
        } catch(_) {}
      }
    } catch(_) {}
    fs.writeFileSync(migFlag, new Date().toISOString());
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1000, minHeight: 700,
    backgroundColor: '#070d12',
    title: `Trading Dashboard ${app.getVersion()}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const distIndex = path.join(__dirname, 'dist', 'index.html');
  const useVite   = !app.isPackaged && !fs.existsSync(distIndex);
  if (useVite) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(distIndex);
  }
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle(`Trading Dashboard ${app.getVersion()}`);
  });
}

app.whenReady().then(async () => {
  await init();
  await loadActiveDb();
  await loadGlobalDb();
  await marketDbMod.init(app.getPath('userData'));
  registerHandlers();
  botSignalsFile = path.join(app.getPath('userData'), 'bot_signals.json');
  botSignals     = loadBotSignalsFromFile();
  createWindow();
  startBotServer(3001);

  if (app.isPackaged) {
    mainWindow.webContents.on('did-finish-load', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
  }

  // ── Scheduler analyses marché (toutes les 5 min) ──────────────
  setInterval(async () => {
    try {
      const now = new Date();
      const utcH = now.getUTCHours();
      const day  = now.getUTCDay();
      const todayStr = now.toISOString().slice(0,10);
      // Lun-Ven après 20h UTC (22h Paris) → résumé journalier
      if (day >= 1 && day <= 5 && utcH >= 20) {
        if (!marketDbMod.getOne('daily', todayStr)) {
          const { content, candles, zones, meta } = await generateIctAnalysis('daily', todayStr);
          marketDbMod.upsert('daily', todayStr, content, { candles, zones, meta });
          mainWindow?.webContents.send('market:analysisGenerated', { type:'daily', date:todayStr });
        }
      }
      // Samedi après 6h UTC (8h Paris) → bilan semaine + preview suivante
      if (day === 6 && utcH >= 6) {
        const lastMon = new Date(now); lastMon.setUTCDate(now.getUTCDate() - 5);
        const lastMonStr = lastMon.toISOString().slice(0,10);
        const nextMon = new Date(now); nextMon.setUTCDate(now.getUTCDate() + 2);
        const nextMonStr = nextMon.toISOString().slice(0,10);
        if (!marketDbMod.getOne('weekly', lastMonStr)) {
          const { content, candles, zones, meta } = await generateIctAnalysis('weekly', lastMonStr);
          marketDbMod.upsert('weekly', lastMonStr, content, { candles, zones, meta });
          mainWindow?.webContents.send('market:analysisGenerated', { type:'weekly', date:lastMonStr });
        }
        if (!marketDbMod.getOne('next_week', nextMonStr)) {
          const { content, candles, zones, meta } = await generateIctAnalysis('next_week', nextMonStr);
          marketDbMod.upsert('next_week', nextMonStr, content, { candles, zones, meta });
          mainWindow?.webContents.send('market:analysisGenerated', { type:'next_week', date:nextMonStr });
        }
      }
    } catch(e) { console.error('[Market scheduler]', e.message); }
  }, 5 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (botServer) { try { botServer.close(); } catch(_) {} }
  if (process.platform !== 'darwin') app.quit();
});

autoUpdater.on('update-available',  (info) => { mainWindow?.webContents.send('update:available', info); });
autoUpdater.on('update-downloaded', (info) => { mainWindow?.webContents.send('update:downloaded', info); });
autoUpdater.on('error', (err) => { console.error('AutoUpdater error:', err); });

function registerHandlers() {
  ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall(); });

  // ── Shell handlers ────────────────────────────────────────
  ipcMain.handle('shell:openExternal', (_, url) => { shell.openExternal(url); return { ok: true }; });

  // ── Bot handlers ──────────────────────────────────────────
  ipcMain.handle('bot:getSignals',     () => ({ ok: true, data: botSignals }));
  ipcMain.handle('bot:clearSignals',   () => { botSignals = []; saveBotSignalsToFile(); return { ok: true }; });
  ipcMain.handle('bot:getPort',        () => ({ ok: true, data: botPort }));
  ipcMain.handle('bot:getWebhookLogs', () => ({ ok: true, data: webhookLogs }));
  ipcMain.handle('bot:setPort',     (_, port) => {
    try { startBotServer(parseInt(port) || 3001); return { ok: true, data: botPort }; }
    catch(e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('bot:updateOutcome', (_, id, outcome) => {
    const sig = botSignals.find(s => String(s._id) === String(id));
    if (!sig) return { ok: false, error: 'Signal introuvable' };
    if (outcome === null) delete sig._outcome; else sig._outcome = outcome;
    saveBotSignalsToFile();
    return { ok: true };
  });

  ipcMain.handle('bot:getStats',    () => {
    const total   = botSignals.length;
    const longs   = botSignals.filter(s => (s.signal ?? s.direction ?? '').toUpperCase() === 'LONG').length;
    const shorts  = total - longs;
    const oldest  = botSignals.length > 0 ? botSignals[botSignals.length - 1]._receivedAt : null;
    const newest  = botSignals.length > 0 ? botSignals[0]._receivedAt : null;
    const bots    = [...new Set(botSignals.map(s => s.bot).filter(Boolean))];
    return { ok: true, data: { total, longs, shorts, oldest, newest, bots } };
  });

  // ── Account handlers ──────────────────────────────────────
  ipcMain.handle('accounts:getAll',    async () => { try { return { ok: true, data: accounts.getAllAccounts() }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:create',    async (_, acc) => { try { const a = accounts.createAccount(acc); await loadActiveDb(); return { ok: true, data: a }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:update',    async (_, id, u) => { try { return { ok: true, data: accounts.updateAccount(id, u) }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:delete',    async (_, id) => { try { const r = accounts.deleteAccount(id); await loadActiveDb(); return { ok: true, data: r }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:setActive', async (_, id) => { try { const r = accounts.setActiveAccount(id); await loadActiveDb(); return { ok: true, data: r }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:getActive', async () => { try { return { ok: true, data: accounts.getActiveAccount() }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:types',     async () => { try { return { ok: true, data: accounts.ACCOUNT_TYPES }; } catch(e) { return { ok: false, error: e.message }; } });

  // ── DB handlers ───────────────────────────────────────────
  const dbHandle = (channel, fn) => {
    ipcMain.handle(channel, async (_, ...args) => {
      try {
        if (!activeDb || !activeDbPath) return { ok: false, error: 'Aucun compte actif' };
        return { ok: true, data: fn(activeDb, activeDbPath, ...args) };
      } catch(e) {
        console.error(`[IPC] ${channel}:`, e.message);
        return { ok: false, error: e.message };
      }
    });
  };

  const globalDbHandle = (channel, fn) => {
    ipcMain.handle(channel, async (_, ...args) => {
      try {
        if (!globalDb || !globalDbPath) return { ok: false, error: 'Global DB non initialisée' };
        return { ok: true, data: fn(globalDb, globalDbPath, ...args) };
      } catch(e) {
        console.error(`[IPC] ${channel}:`, e.message);
        return { ok: false, error: e.message };
      }
    });
  };

  dbHandle('db:getAllTrades',           (db) => dbModule.getAllTrades(db));
  ipcMain.handle('db:getTradesForPath', async (_, dbPath) => {
    try {
      const db = await dbModule.getDb(dbPath);
      return { ok: true, data: dbModule.getAllTrades(db) };
    } catch(e) { return { ok: false, error: e.message }; }
  });
  dbHandle('db:getTradeById',           (db, _, id) => dbModule.getTradeById(db, id));
  dbHandle('db:insertTrade',            (db, dbp, t) => dbModule.insertTrade(db, dbp, t));
  dbHandle('db:updateTrade',            (db, dbp, id, t) => dbModule.updateTrade(db, dbp, id, t));
  dbHandle('db:deleteTrade',            (db, dbp, id) => dbModule.deleteTrade(db, dbp, id));
  dbHandle('db:getStats',               (db) => dbModule.getStats(db));
  dbHandle('db:importCsvTrades',        (db, dbp, rows) => dbModule.importCsvTrades(db, dbp, rows));
  dbHandle('db:insertEmotionalCheck',   (db, dbp, c) => dbModule.insertEmotionalCheck(db, dbp, c));
  dbHandle('db:getTodayEmotionalCheck', (db) => dbModule.getTodayEmotionalCheck(db));

  // Analysis handlers (global DB — shared across all accounts)
  globalDbHandle('db:getDailyAnalyses',    (db) => dbModule.getDailyAnalyses(db));
  globalDbHandle('db:upsertDailyAnalysis', (db, dbp, a) => dbModule.upsertDailyAnalysis(db, dbp, a));
  globalDbHandle('db:deleteDailyAnalysis', (db, dbp, id) => dbModule.deleteDailyAnalysis(db, dbp, id));
  globalDbHandle('db:getWeeklyAnalyses',   (db) => dbModule.getWeeklyAnalyses(db));
  globalDbHandle('db:upsertWeeklyAnalysis',(db, dbp, a) => dbModule.upsertWeeklyAnalysis(db, dbp, a));
  globalDbHandle('db:deleteWeeklyAnalysis',(db, dbp, id) => dbModule.deleteWeeklyAnalysis(db, dbp, id));

  // ── AI Coach handlers ─────────────────────────────────────────
  ipcMain.handle('ai:hasKey', () => ({ ok: true, data: !!process.env.ANTHROPIC_API_KEY }));

  ipcMain.handle('ai:setKey', async (_, key) => {
    try {
      const k = (key || '').trim();
      if (!k.startsWith('sk-ant-')) return { ok: false, error: 'Clé invalide (doit commencer par sk-ant-)' };
      const dir = path.join(process.env.APPDATA || process.env.HOME || '', 'trading-dashboard');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const envPath = path.join(dir, '.env');
      let lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8').split('\n') : [];
      const idx = lines.findIndex(l => l.startsWith('ANTHROPIC_API_KEY='));
      const newLine = `ANTHROPIC_API_KEY="${k}"`;
      if (idx >= 0) lines[idx] = newLine; else lines.push(newLine);
      fs.writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
      process.env.ANTHROPIC_API_KEY = k;
      return { ok: true };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('ai:chat', async (_, messages, systemPrompt) => {
    try {
      const text = await callAnthropicApi(messages, systemPrompt);
      return { ok: true, data: text };
    } catch(e) {
      if (e.message === 'NO_API_KEY') return { ok: false, error: 'no_api_key' };
      return { ok: false, error: e.message };
    }
  });

  dbHandle('ai:getMessages',  (db) => dbModule.getAiMessages(db));
  dbHandle('ai:addMessage',   (db, dbp, msg) => dbModule.insertAiMessage(db, dbp, msg));
  dbHandle('ai:clearHistory', (db, dbp) => dbModule.clearAiConversations(db, dbp));

  // ── Market AI Analyses ────────────────────────────────────
  ipcMain.handle('market:getAiAnalyses', () => {
    try { return { ok: true, data: marketDbMod.getAll() }; }
    catch(e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('market:generateAiAnalysis', async (_, type, date) => {
    try {
      const { content, candles, zones, meta } = await generateIctAnalysis(type, date);
      const row = marketDbMod.upsert(type, date, content, { candles, zones, meta });
      return { ok: true, data: row };
    } catch(e) {
      if (e.message === 'NO_API_KEY') return { ok: false, error: 'no_api_key' };
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('market:deleteAiAnalysis', (_, id) => {
    try { marketDbMod.deleteById(id); return { ok: true }; }
    catch(e) { return { ok: false, error: e.message }; }
  });

  // Fetch MNQ candles on-demand (for TF switching in the chart)
  ipcMain.handle('market:getCandles', async (_, from, to, tf) => {
    try {
      const data = await fetchNQRange(from, to, tf ?? '15m', 'MNQ%3DF');
      return { ok: true, data };
    } catch(e) { return { ok: false, error: e.message }; }
  });

  // ── Market Data ───────────────────────────────────────────
  ipcMain.handle('market:getOHLCV', async (_, pair, date, interval) => {
    try {
      const SYMBOL_MAP = {
        // Micro Nasdaq
        MN:'NQ=F', MNQ:'NQ=F', NQ:'NQ=F', NASDAQ:'NQ=F',
        // Micro S&P 500
        ME:'ES=F', MES:'ES=F', ES:'ES=F', SP500:'ES=F',
        // Micro Dow Jones
        MY:'YM=F', MYM:'YM=F', YM:'YM=F', DOW:'YM=F',
        // Micro Russell 2000
        M2K:'RTY=F', RTY:'RTY=F', RUT:'RTY=F',
        // Micro Gold / Silver
        MGC:'GC=F', GC:'GC=F', MSG:'SI=F', SI:'SI=F',
        // Micro Crude Oil
        MCL:'CL=F', CL:'CL=F',
        // Indices
        DAX:'%5EGDAXI', CAC:'%5EFCHI', FTSE:'%5EFTSE',
      };
      // Strip trailing contract month+year codes (e.g. MNQ1!, MNQZ24, ESH25 → MNQ / MNQ / ES)
      const normalized = (pair || '').toUpperCase()
        .replace(/\d+!$/, '')              // remove "1!" suffix
        .replace(/[FGHJKMNQUVXZ]\d{2}$/, ''); // remove month+2-digit year (e.g. Z24)
      const symbol = SYMBOL_MAP[normalized] ?? SYMBOL_MAP[(pair||'').toUpperCase()] ?? pair;
      const dayStart = Math.floor(new Date(date + 'T06:00:00Z').getTime() / 1000);
      const dayEnd   = Math.floor(new Date(date + 'T23:59:59Z').getTime() / 1000);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&period1=${dayStart}&period2=${dayEnd}&events=`;
      const raw = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      });
      const result = raw?.chart?.result?.[0];
      if (!result) return { ok: false, error: 'Symbole introuvable sur Yahoo Finance' };
      const ts = result.timestamp ?? [];
      const q  = result.indicators?.quote?.[0] ?? {};
      const candles = ts
        .map((t, i) => ({ ts: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
        .filter(c => c.open != null && c.high != null && c.low != null && c.close != null);
      return { ok: true, data: candles };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  });

  // ── File dialogs ──────────────────────────────────────────
  ipcMain.handle('dialog:openCsv', async () => {
    const result = await dialog.showOpenDialog({ title: 'Importer CSV TopstepX', filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { ok: true, content };
    } catch(e) { return { ok: false, error: e.message }; }
  });

  // Open image file dialog → return base64
  ipcMain.handle('dialog:openImage', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner une image',
      filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif','bmp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try {
      const filePath = result.filePaths[0];
      const data     = fs.readFileSync(filePath);
      const ext      = path.extname(filePath).slice(1).toLowerCase();
      const mime     = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const b64      = `data:${mime};base64,${data.toString('base64')}`;
      const name     = path.basename(filePath);
      return { ok: true, dataUrl: b64, name };
    } catch(e) { return { ok: false, error: e.message }; }
  });

  // Open multiple images
  ipcMain.handle('dialog:openImages', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner des images',
      filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif','bmp'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try {
      const images = result.filePaths.map(filePath => {
        const data = fs.readFileSync(filePath);
        const ext  = path.extname(filePath).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return { dataUrl: `data:${mime};base64,${data.toString('base64')}`, name: path.basename(filePath) };
      });
      return { ok: true, images };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}
