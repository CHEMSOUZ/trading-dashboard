import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── CSV Parsers ────────────────────────────────────────────────

/**
 * Detect CSV source from headers
 */
function detectSource(headers) {
  const h = headers.map(x => x.trim().toLowerCase());
  if (h.includes('contractname') && h.includes('enteredat') && h.includes('tradeday')) return 'topstep';
  // Tradovate Performance export (buyFillId + sellFillId + boughtTimestamp + soldTimestamp + pnl)
  if (h.includes('buyfillid') && h.includes('sellfillid') &&
      h.includes('boughttimestamp') && h.includes('soldtimestamp'))
    return 'tradovate_perf';
  // Tradovate Orders export (B/S column + Product + Fill Time + avgPrice)
  if (h.includes('b/s') && h.includes('product') &&
      (h.includes('fill time') || h.includes('avgprice') || h.includes('avg fill price')))
    return 'tradovate_orders';
  // Tradovate Performance générique (opened at / closed at)
  if ((h.some(x => x === 'opened at' || x === 'entry time' || x === 'open time' || x === 'entrytime')) &&
      (h.some(x => x === 'closed at'  || x === 'exit time'  || x === 'close time' || x === 'closetime')))
    return 'tradovate_perf';
  // Tradovate Fills export générique (fills individuels buy/sell)
  if ((h.includes('timestamp') || h.includes('fill time')) &&
      (h.includes('action') || h.includes('side')) &&
      (h.includes('contractid') || h.includes('contract id')) &&
      h.includes('qty'))
    return 'tradovate_fills';
  // Tradovate cash ledger export
  if (h.includes('transaction id') && h.includes('cash change type') && (h.includes('contract') || h.includes('contractid'))) return 'tradovate';
  // Tradovate API-style export (legacy)
  if (h.includes('symbol') && h.includes('buyfillid') && h.includes('clearingfees')) return 'tradovate_api';
  return 'unknown';
}

/**
 * Parse a raw CSV string → array of row objects
 */
function parseCsv(raw) {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/^\uFEFF/, '');

  function splitCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitCsvLine(headerLine);
  return lines.slice(1).map(line => {
    const vals = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
    return obj;
  });
}

function parseTradovateDate(str) {
  if (!str) return null;
  try {
    // "MM/DD/YYYY HH:MM:SS" (format Tradovate)
    const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
    if (m) return new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T${m[4]}`).toISOString();
    return new Date(str).toISOString();
  } catch { return null; }
}

/**
 * Normalize contract name → pair symbol
 * MNQM6 → MNQ, ESU6 → ES, MESM6 → MES, etc.
 */
function normalizePair(contractName) {
  if (!contractName) return 'Autre';
  // Strip expiry suffix (last letter + digit(s) at end)
  const clean = contractName.replace(/[A-Z]\d+$/, '').replace(/\d+$/, '');
  const MAP = {
    MNQ: 'MNQ', NQ: 'NQ', MES: 'MES', ES: 'ES',
    MGC: 'MGC', GC: 'GC', M2K: 'M2K', RTY: 'RTY',
    MCL: 'MCL', CL: 'CL',
  };
  return MAP[clean] ?? clean;
}

/**
 * Parse Topstep date string with timezone offset
 * "05/22/2026 08:54:10 +02:00" → ISO string
 */
function parseTopstepDate(str) {
  if (!str) return null;
  try {
    // Format: MM/DD/YYYY HH:MM:SS +HH:MM
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2}:\d{2})$/);
    if (match) {
      const [, mm, dd, yyyy, time, tz] = match;
      return new Date(`${yyyy}-${mm}-${dd}T${time}${tz}`).toISOString();
    }
    return new Date(str).toISOString();
  } catch { return null; }
}

/**
 * Format TradeDuration "00:07:25.333..." → "7m 25s"
 */
function formatDuration(str) {
  if (!str) return null;
  try {
    const parts = str.split(':');
    if (parts.length < 3) return str;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  } catch { return str; }
}

/**
 * Map a Topstep CSV row → trade payload for window.db.insertTrade
 */
function mapTopstepRow(row) {
  const enteredAt  = parseTopstepDate(row['EnteredAt']);
  const exitedAt   = parseTopstepDate(row['ExitedAt']);
  const date       = enteredAt ? enteredAt.slice(0, 10) : '';
  const pnlBrut    = parseFloat(row['PnL']) || 0;
  const fees       = parseFloat(row['Fees']) || 0;
  const commissions = parseFloat(row['Commissions']) || 0;
  const resultNet  = pnlBrut - fees - commissions;
  const direction  = (row['Type'] ?? '').toLowerCase() === 'short' ? 'SHORT' : 'LONG';
  const size       = parseFloat(row['Size']) || null;

  return {
    external_id:  row['Id'] ?? null,
    source:       'topstep_csv',
    date,
    entered_at:   enteredAt,
    exited_at:    exitedAt,
    pair:         normalizePair(row['ContractName']),
    direction,
    entry:        parseFloat(row['EntryPrice']) || 0,
    exit_price:   parseFloat(row['ExitPrice']) || null,
    size,
    result:       pnlBrut,
    fees,
    commissions,
    result_net:   Math.round(resultNet * 100) / 100,
    outcome:      resultNet > 0 ? 'WIN' : resultNet < 0 ? 'LOSS' : 'BE',
    duration:     formatDuration(row['TradeDuration']),
    stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
  };
}

/**
 * Map a Tradovate CSV row → trade payload
 * (structure prête — à affiner quand on aura un vrai export)
 */
function mapTradovateRow(row) {
  const enteredAt = row['boughtTimestamp'] || row['EnteredAt'] || null;
  const exitedAt  = row['soldTimestamp']   || row['ExitedAt']  || null;
  const enteredIso = enteredAt ? new Date(enteredAt).toISOString() : null;
  const date       = enteredIso ? enteredIso.slice(0, 10) : '';
  const pnlBrut    = parseFloat(row['tradePnL'] ?? row['PnL'] ?? 0) || 0;
  const fees       = parseFloat(row['clearingFees'] ?? row['Fees'] ?? 0) || 0;
  const commissions = parseFloat(row['commission'] ?? row['Commissions'] ?? 0) || 0;
  const resultNet  = pnlBrut - fees - commissions;

  return {
    external_id:  row['tradeId'] ?? row['Id'] ?? null,
    source:       'tradovate_csv',
    date,
    entered_at:   enteredIso,
    exited_at:    exitedAt ? new Date(exitedAt).toISOString() : null,
    pair:         normalizePair(row['symbol'] ?? row['ContractName'] ?? ''),
    direction:    (row['action'] ?? '').toLowerCase().includes('sell') ? 'SHORT' : 'LONG',
    entry:        parseFloat(row['price'] ?? row['EntryPrice'] ?? 0) || 0,
    exit_price:   parseFloat(row['exitPrice'] ?? row['ExitPrice'] ?? 0) || null,
    size:         parseFloat(row['qty'] ?? row['Size'] ?? 0) || null,
    result:       pnlBrut,
    fees,
    commissions,
    result_net:   Math.round(resultNet * 100) / 100,
    outcome:      resultNet > 0 ? 'WIN' : resultNet < 0 ? 'LOSS' : 'BE',
    duration:     null,
    stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
  };
}

/**
 * Tradovate Performance export — une ligne = un trade complet
 * Colonnes réelles : symbol, buyFillId, sellFillId, qty, buyPrice, sellPrice,
 *   pnl (format "$(420.00)"), boughtTimestamp, soldTimestamp, duration
 */
function mapTradovatePerfRow(row, idx) {
  // Parse "$(420.00)" → -420  |  "$420.00" → 420
  function parsePnl(str) {
    if (!str) return 0;
    const s = str.trim();
    const neg = s.match(/^\$\(([0-9,.]+)\)$/);
    if (neg) return -parseFloat(neg[1].replace(/,/g, ''));
    const pos = s.match(/^\$([0-9,.]+)$/);
    if (pos) return parseFloat(pos[1].replace(/,/g, ''));
    return parseFloat(s.replace(/[$(),]/g, '')) || 0;
  }

  // Normalise "6min 30sec" / "3h 31min 28sec" → "6m 30s" / "3h 31m"
  function normDur(str) {
    if (!str) return null;
    return str.replace(/(\d+)h/g, '$1h ').replace(/(\d+)min/g, '$1m ').replace(/(\d+)sec/g, '$1s').trim();
  }

  const boughtTs  = parseTradovateDate(row['boughtTimestamp']);
  const soldTs    = parseTradovateDate(row['soldTimestamp']);
  const buyPrice  = parseFloat(row['buyPrice'])  || 0;
  const sellPrice = parseFloat(row['sellPrice']) || 0;
  const qty       = parseFloat(row['qty'])       || 1;
  const pnl       = parsePnl(row['pnl']);
  const contract  = (row['symbol'] || '').trim();

  // Direction : acheté avant vendu → LONG ; vendu avant acheté → SHORT
  const isLong    = !soldTs || (boughtTs && boughtTs <= soldTs);
  const direction = isLong ? 'LONG' : 'SHORT';
  const enteredAt = isLong ? boughtTs  : soldTs;
  const exitedAt  = isLong ? soldTs    : boughtTs;
  const entry     = isLong ? buyPrice  : sellPrice;
  const exitPrice = isLong ? sellPrice : buyPrice;
  const date      = enteredAt ? enteredAt.slice(0, 10) : '';

  const buyId  = row['buyFillId']  || '';
  const sellId = row['sellFillId'] || '';
  const extId  = buyId && sellId
    ? `tdv_perf_${buyId}_${sellId}`
    : `tdv_perf_${date}_${contract}_${idx}`;

  return {
    external_id:  extId,
    source:       'tradovate_csv',
    date,
    entered_at:   enteredAt,
    exited_at:    exitedAt,
    pair:         normalizePair(contract),
    direction,
    entry,
    exit_price:   exitPrice,
    size:         qty,
    result:       pnl,
    fees:         0,
    commissions:  0,
    result_net:   pnl,
    outcome:      pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE',
    duration:     normDur(row['duration']),
    stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
  };
}

/**
 * Tradovate Orders export — apparie les ordres Buy/Sell (FIFO) pour reconstituer les trades
 * Colonnes réelles : B/S, Product, avgPrice, filledQty, Fill Time, Notional Value, Status
 */
function parseTradovateOrders(rows) {
  // Parse "MM/DD/YYYY HH:MM:SS" ou "M/D/YY" → ISO
  function parseOrderDate(str) {
    if (!str) return null;
    try {
      // MM/DD/YYYY HH:MM:SS
      const m1 = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
      if (m1) return new Date(`${m1[3]}-${m1[1].padStart(2,'0')}-${m1[2].padStart(2,'0')}T${m1[4]}`).toISOString();
      // M/D/YY
      const m2 = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (m2) return new Date(`20${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}T00:00:00`).toISOString();
      return new Date(str).toISOString();
    } catch { return null; }
  }

  function calcDuration(start, end) {
    if (!start || !end) return null;
    const diff = new Date(end) - new Date(start);
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // Multiplicateurs connus ($ par point, par contrat)
  const MULT = { MNQ:2, NQ:20, MES:5, ES:50, MGC:10, GC:100, M2K:5, RTY:50, MCL:100, CL:1000 };
  const multCache = new Map();

  function getMultiplier(product, notionalStr, qty, price) {
    if (multCache.has(product)) return multCache.get(product);
    if (MULT[product]) { multCache.set(product, MULT[product]); return MULT[product]; }
    const notional = parseFloat((notionalStr || '0').replace(/,/g, '').replace(/[^0-9.]/g, ''));
    if (notional > 0 && qty > 0 && price > 0) {
      const m = Math.round((notional / (qty * price)) * 10) / 10;
      if (m > 0) { multCache.set(product, m); return m; }
    }
    return 1;
  }

  // Garder uniquement les ordres remplis, trier par Fill Time
  const sorted = rows
    .filter(r => {
      const status = (r['Status'] || '').trim().toLowerCase();
      return status === 'filled' || status === '';
    })
    .sort((a, b) => {
      const ta = parseOrderDate(a['Fill Time'] || a['Timestamp'] || '') || '';
      const tb = parseOrderDate(b['Fill Time'] || b['Timestamp'] || '') || '';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

  const queues = new Map(); // product → { buys: [], sells: [] }
  const completed = [];

  for (const row of sorted) {
    const bs      = (row['B/S'] || '').trim().toUpperCase();
    const product = (row['Product'] || '').trim();
    const price   = parseFloat(row['avgPrice'] || row['Avg Fill Price'] || '0') || 0;
    const qty     = Math.abs(parseFloat(row['filledQty'] || row['Filled Qty'] || row['Quantity'] || '1')) || 1;
    const notional = row['Notional Value'] || '';
    const fillTime = parseOrderDate(row['Fill Time'] || row['Timestamp'] || '');

    if (!product || !price || (!bs.startsWith('B') && !bs.startsWith('S'))) continue;
    const mult = getMultiplier(product, notional, qty, price);

    if (!queues.has(product)) queues.set(product, { buys: [], sells: [] });
    const q = queues.get(product);
    const fill = { price, qty, fillTime, mult, product };

    if (bs.startsWith('B')) {
      // BUY : ferme un SHORT ou ouvre un LONG
      if (q.sells.length > 0) {
        const open = q.sells.shift();
        completed.push({ dir: 'SHORT', open, close: fill });
      } else {
        q.buys.push(fill);
      }
    } else {
      // SELL : ferme un LONG ou ouvre un SHORT
      if (q.buys.length > 0) {
        const open = q.buys.shift();
        completed.push({ dir: 'LONG', open, close: fill });
      } else {
        q.sells.push(fill);
      }
    }
  }

  return completed.map((t, i) => {
    const entryFill = t.dir === 'LONG' ? t.open  : t.close;
    const exitFill  = t.dir === 'LONG' ? t.close : t.open;
    const pnl = Math.round((exitFill.price - entryFill.price) * t.open.qty * t.open.mult * 100) / 100;
    const date = t.open.fillTime ? t.open.fillTime.slice(0,10) : '';
    return {
      external_id: `tdv_ord_${date}_${t.open.product}_${i}`,
      source:      'tradovate_csv',
      date,
      entered_at:  t.open.fillTime,
      exited_at:   t.close.fillTime,
      pair:        normalizePair(t.open.product),
      direction:   t.dir,
      entry:       entryFill.price,
      exit_price:  exitFill.price,
      size:        t.open.qty,
      result:      pnl,
      fees:        0,
      commissions: 0,
      result_net:  pnl,
      outcome:     pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE',
      duration:    calcDuration(t.open.fillTime, t.close.fillTime),
      stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
    };
  });
}

/**
 * Tradovate Fills export — apparie les fills Buy/Sell en FIFO pour reconstituer les trades
 * Colonnes : timestamp, contractId, qty, price, action (Buy/Sell), commission, clearingFee
 */
function parseTradovateFills(rows) {
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a['timestamp'] || a['Timestamp'] || a['fill time'] || a['Fill Time'] || 0);
    const tb = new Date(b['timestamp'] || b['Timestamp'] || b['fill time'] || b['Fill Time'] || 0);
    return ta - tb;
  });
  const queues = new Map();
  const completed = [];

  for (const row of sorted) {
    const contract   = (row['contractId'] || row['Contract ID'] || row['contract'] || '').trim();
    const action     = (row['action'] || row['side'] || row['Action'] || row['Side'] || '').toLowerCase();
    const qty        = Math.abs(parseFloat(row['qty'] || row['Qty'] || '1')) || 1;
    const price      = parseFloat(row['price'] || row['Price'] || '0') || 0;
    const commission = Math.abs(parseFloat(row['commission'] || row['Commission'] || '0')) || 0;
    const fees       = Math.abs(parseFloat(row['clearingFee'] || row['ClearingFee'] || row['fee'] || row['Fee'] || '0')) || 0;
    const tsRaw      = row['timestamp'] || row['Timestamp'] || row['fill time'] || row['Fill Time'] || '';
    const enteredAt  = parseTradovateDate(tsRaw);
    const isBuy = action.includes('buy') || action === 'b';

    if (!queues.has(contract)) queues.set(contract, { buys: [], sells: [] });
    const q = queues.get(contract);

    if (isBuy) {
      if (q.sells.length > 0) {
        const open = q.sells.shift();
        const pnlBrut   = (open.price - price) * qty;
        const totalComm = commission + open.commission;
        const totalFees = fees + open.fees;
        const resultNet = pnlBrut - totalComm - totalFees;
        completed.push({ open, close: { price, enteredAt, commission, fees }, qty, pnlBrut, totalComm, totalFees, resultNet, direction: 'SHORT', contract });
      } else { q.buys.push({ price, qty, commission, fees, enteredAt }); }
    } else {
      if (q.buys.length > 0) {
        const open = q.buys.shift();
        const pnlBrut   = (price - open.price) * qty;
        const totalComm = commission + open.commission;
        const totalFees = fees + open.fees;
        const resultNet = pnlBrut - totalComm - totalFees;
        completed.push({ open, close: { price, enteredAt, commission, fees }, qty, pnlBrut, totalComm, totalFees, resultNet, direction: 'LONG', contract });
      } else { q.sells.push({ price, qty, commission, fees, enteredAt }); }
    }
  }

  return completed.map((t, i) => {
    const date = t.open.enteredAt ? t.open.enteredAt.slice(0,10) : '';
    return {
      external_id: `tdv_fill_${date}_${t.contract}_${i}`,
      source: 'tradovate_csv', date,
      entered_at: t.open.enteredAt, exited_at: t.close.enteredAt,
      pair: normalizePair(t.contract), direction: t.direction,
      entry: t.direction === 'LONG' ? t.open.price : t.close.price,
      exit_price: t.direction === 'LONG' ? t.close.price : t.open.price,
      size: t.qty,
      result: Math.round(t.pnlBrut * 100) / 100,
      fees: t.totalFees, commissions: t.totalComm,
      result_net: Math.round(t.resultNet * 100) / 100,
      outcome: t.resultNet > 0 ? 'WIN' : t.resultNet < 0 ? 'LOSS' : 'BE',
      duration: null, stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
    };
  });
}

/**
 * Parse Tradovate cash ledger CSV (Account, Transaction ID, Timestamp, Date, Delta, Amount, Cash Change Type, ...)
 * Groups rows by Transaction ID: P&L row = trade, Commission/Fee rows = costs.
 */
function parseTradovateLedger(rows) {
  const isPnL        = t => { const s = t.toLowerCase(); return s.includes('p&l') || s.includes('pnl') || s === 'trade'; };
  const isFee        = t => { const s = t.toLowerCase(); return s.includes('fee') || s.includes('clearing'); };
  const isCommission = t => t.toLowerCase().includes('commission');

  // Group by Transaction ID
  const groups = new Map();
  for (const row of rows) {
    const id = row['Transaction ID'] || '';
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }

  const trades = [];
  for (const [txId, group] of groups) {
    const pnlRow = group.find(r => isPnL(r['Cash Change Type'] || ''));
    if (!pnlRow) continue;

    const amount   = parseFloat(pnlRow['Amount'])    || 0;
    const delta    = parseFloat(pnlRow['Delta'])     || 0;
    const contract = pnlRow['Contract']   || '';
    const tsRaw    = pnlRow['Timestamp']  || '';
    const dateRaw  = pnlRow['Date']       || '';

    let fees = 0, commissions = 0;
    for (const r of group) {
      if (r === pnlRow) continue;
      const amt  = parseFloat(r['Amount']) || 0;
      const type = r['Cash Change Type']   || '';
      if (isFee(type))        fees         += Math.abs(amt);
      else if (isCommission(type)) commissions += Math.abs(amt);
    }

    let enteredIso = null;
    try { if (tsRaw) enteredIso = new Date(tsRaw).toISOString(); } catch {}
    const isoDate   = enteredIso ? enteredIso.slice(0, 10) : dateRaw;
    const resultNet = Math.round((amount - fees - commissions) * 100) / 100;
    // delta < 0 → net sold (closing LONG) → LONG; delta > 0 → net bought (closing SHORT) → SHORT
    const direction = delta < 0 ? 'LONG' : delta > 0 ? 'SHORT' : 'LONG';

    trades.push({
      external_id: `tdv_${txId}`,
      source:      'tradovate_csv',
      date:        isoDate,
      entered_at:  enteredIso,
      exited_at:   enteredIso,
      pair:        normalizePair(contract),
      direction,
      entry:       0,
      exit_price:  null,
      size:        Math.abs(delta) || null,
      result:      amount,
      fees,
      commissions,
      result_net:  resultNet,
      outcome:     resultNet > 0 ? 'WIN' : resultNet < 0 ? 'LOSS' : 'BE',
      duration:    null,
      stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
    });
  }

  return trades;
}

function mapRow(row, source, idx) {
  if (source === 'topstep')        return mapTopstepRow(row);
  if (source === 'tradovate_api')  return mapTradovateRow(row);
  if (source === 'tradovate_perf') return mapTradovatePerfRow(row, idx);
  return null;
}

// ── UI Components ──────────────────────────────────────────────

function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

const SOURCE_INFO = {
  topstep:          { label: 'Topstep',                 color: '#00ff88', icon: <TopstepLogo size={18} /> },
  tradovate:        { label: 'Tradovate (Ledger)',       color: '#00aaff', icon: <TradovateLogo size={18} /> },
  tradovate_orders: { label: 'Tradovate (Orders)',       color: '#00aaff', icon: <TradovateLogo size={18} /> },
  tradovate_perf:   { label: 'Tradovate (Performance)',  color: '#00aaff', icon: <TradovateLogo size={18} /> },
  tradovate_fills:  { label: 'Tradovate (Fills)',        color: '#00aaff', icon: <TradovateLogo size={18} /> },
  tradovate_api:    { label: 'Tradovate (API)',          color: '#00aaff', icon: <TradovateLogo size={18} /> },
  unknown:          { label: 'Inconnu',                 color: '#f0a020', icon: '❓' },
};

function TopstepLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00ff88" fillOpacity="0.15"/>
      <path d="M8 20 L20 8 L32 20 L20 32 Z" stroke="#00ff88" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <circle cx="20" cy="20" r="4" fill="#00ff88"/>
      <path d="M20 8 L20 16 M20 24 L20 32 M8 20 L16 20 M24 20 L32 20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TradovateLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00aaff" fillOpacity="0.15"/>
      <path d="M10 28 L20 12 L30 28" stroke="#00aaff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M14 22 L26 22" stroke="#00aaff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function DropZone({ onFile, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) onFile(file);
  }
  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={disabled ? undefined : handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? '#00ff88' : '#1a4a2a'}`,
        borderRadius: '10px',
        padding: '48px 24px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragOver ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.3)',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} style={{ display: 'none' }} />
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>📂</div>
      <div style={{ fontSize: '14px', color: '#c8d8c8', marginBottom: '6px', fontWeight: '600' }}>
        Glisse ton fichier CSV ici
      </div>
      <div style={{ fontSize: '12px', color: '#3a6a4a' }}>
        ou clique pour sélectionner · Topstep &amp; Tradovate supportés
      </div>
    </div>
  );
}

function PreviewRow({ trade, idx, duplicate }) {
  const net = trade.result_net ?? 0;
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const totalFees = (trade.fees ?? 0) + (trade.commissions ?? 0);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 86px 90px 60px 60px 55px 90px 75px 70px 1fr',
      gap: '5px',
      alignItems: 'center',
      padding: '7px 10px',
      background: duplicate
        ? 'rgba(240,160,32,0.06)'
        : idx % 2 === 0 ? 'rgba(10,28,18,0.4)' : 'rgba(10,28,18,0.25)',
      borderLeft: `2px solid ${duplicate ? '#f0a020' : pnlColor(net)}`,
      borderRadius: '3px',
      fontSize: '11px',
      opacity: duplicate ? 0.7 : 1,
    }}>
      <span style={{ color: '#2a5a32', fontSize: '10px' }}>{idx + 1}</span>
      <span style={{ color: '#4a7a5a', fontSize: '10px' }}>{trade.date}</span>
      <span style={{ color: '#6a8a7a', fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span>{fmtTime(trade.entered_at)}</span>
        {trade.exited_at && trade.exited_at !== trade.entered_at && (
          <span style={{ color: '#4a6a5a' }}>↓{fmtTime(trade.exited_at)}</span>
        )}
      </span>
      <span style={{ color: '#c8d8c8', fontWeight: '600' }}>{trade.pair}</span>
      <span style={{
        color: trade.direction === 'LONG' ? '#00ff88' : '#ff4455',
        fontSize: '10px',
        background: `rgba(${trade.direction === 'LONG' ? '0,255,136' : '255,68,85'},0.08)`,
        padding: '1px 5px', borderRadius: '3px', textAlign: 'center',
      }}>{trade.direction}</span>
      <span style={{ color: '#8aaa90' }}>{trade.size ?? '—'}</span>
      <span style={{ color: pnlColor(net), fontWeight: '700' }}>{fmt(net, true)}</span>
      <span style={{ color: '#f0a020', fontSize: '10px' }}>{totalFees > 0 ? `-${totalFees.toFixed(2)}$` : '—'}</span>
      <span style={{ color: '#4a7a5a', fontSize: '10px' }}>{trade.duration ?? '—'}</span>
      {duplicate
        ? <span style={{ color: '#f0a020', fontSize: '10px' }}>⚠ Déjà importé</span>
        : <span style={{ color: pnlColor(net), fontSize: '10px', fontWeight: '700' }}>{trade.outcome ?? '—'}</span>
      }
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function CsvImport() {
  const navigate = useNavigate();
  const [step, setStep]         = useState('drop');   // drop | preview | importing | done
  const [source, setSource]     = useState(null);
  const [trades, setTrades]     = useState([]);
  const [duplicates, setDuplicates] = useState(new Set()); // set of external_ids
  const [result, setResult]     = useState({ imported: 0, skipped: 0, errors: 0 });
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState('');
  const [fileName, setFileName] = useState('');

  // ── Load & parse CSV ──────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    setError('');
    setFileName(file.name);
    const raw = await file.text();
    const rows = parseCsv(raw);
    if (rows.length === 0) { setError('Fichier vide ou format non reconnu.'); return; }

    const detectedSource = detectSource(Object.keys(rows[0]));
    setSource(detectedSource);

    if (detectedSource === 'unknown') {
      setError('Format CSV non reconnu. Exports supportés : Topstep · Tradovate Performance · Tradovate Fills · Tradovate Ledger. Voir les instructions ci-dessous.');
      return;
    }

    const mapped = detectedSource === 'tradovate'
      ? parseTradovateLedger(rows)
      : detectedSource === 'tradovate_orders'
        ? parseTradovateOrders(rows)
        : detectedSource === 'tradovate_fills'
          ? parseTradovateFills(rows)
          : rows.map((r, i) => mapRow(r, detectedSource, i)).filter(Boolean);

    // Check duplicates against existing trades
    let existingIds = new Set();
    try {
      const res = await window.db.getAllTrades();
      if (res.ok) {
        existingIds = new Set(res.data.map(t => t.external_id).filter(Boolean));
      }
    } catch {}

    const dupSet = new Set(mapped.filter(t => t.external_id && existingIds.has(t.external_id)).map(t => t.external_id));
    setDuplicates(dupSet);
    setTrades(mapped);
    setStep('preview');
  }, []);

  // ── Import ────────────────────────────────────────────────────
  async function handleImport(skipDuplicates = true) {
    setStep('importing');
    let imported = 0, skipped = 0, errors = 0;

    // Toujours passer TOUS les trades à la DB :
    // - nouveaux  → INSERT
    // - doublons avec champs manquants → auto-patch (UPDATE timestamps/taille/durée)
    // - doublons complets → SKIP (si skipDuplicates=true et données déjà OK)
    for (let i = 0; i < trades.length; i++) {
      setProgress(Math.round(((i + 1) / trades.length) * 100));
      const t = trades[i];
      const isDup = duplicates.has(t.external_id);
      // Sauter les vrais doublons seulement si l'utilisateur a choisi skipDuplicates
      // Mais on laisse passer si le doublon pourrait être patché (pas de entered_at ISO en DB)
      if (skipDuplicates && isDup) {
        // On appelle quand même insertTrade : il auto-patchera si nécessaire et retournera patched=true
        try {
          const res = await window.db.insertTrade(t);
          if (res.ok && res.data?.patched) imported++;
          else skipped++;
        } catch { skipped++; }
        continue;
      }
      try {
        const res = await window.db.insertTrade(t);
        if (res.ok && !res.data?.skipped) imported++;
        else skipped++;
      } catch { errors++; }
    }
    setResult({ imported, skipped, errors });
    setStep('done');
  }

  // ── Computed ──────────────────────────────────────────────────
  const newTrades = trades.filter(t => !duplicates.has(t.external_id));
  const totalNet  = newTrades.reduce((s, t) => s + (t.result_net ?? 0), 0);
  const wins      = newTrades.filter(t => (t.result_net ?? 0) > 0).length;
  const losses    = newTrades.filter(t => (t.result_net ?? 0) < 0).length;
  const sourceInfo = SOURCE_INFO[source] ?? SOURCE_INFO.unknown;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#3a6a4a', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px', padding: 0 }}>
          ← Retour au dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>IMPORT</div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Import CSV</h1>
          </div>
        </div>
      </div>

      {/* Platform badges */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        {[
          { key: 'topstep',   label: 'Topstep',   Logo: TopstepLogo,   color: '#00ff88' },
          { key: 'tradovate', label: 'Tradovate',  Logo: TradovateLogo, color: '#00aaff' },
        ].map(({ key, label, Logo, color, soon }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: `rgba(${color === '#00ff88' ? '0,255,136' : '0,170,255'},0.06)`, border: `1px solid ${color}25`, borderRadius: '6px' }}>
            <Logo size={20} />
            <span style={{ fontSize: '12px', color, fontWeight: '600' }}>{label}</span>
            {soon && <span style={{ fontSize: '9px', color: '#3a6a4a', background: 'rgba(0,255,136,0.08)', border: '1px solid #1a4a2a', padding: '1px 5px', borderRadius: '3px', letterSpacing: '1px' }}>BIENTÔT</span>}
          </div>
        ))}
      </div>

      {/* ── STEP: DROP ── */}
      {step === 'drop' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <DropZone onFile={handleFile} />
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(255,68,85,0.08)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '6px', color: '#ff4455', fontSize: '13px' }}>
              ⚠ {error}
            </div>
          )}
          {/* Instructions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(10,28,18,0.3)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ fontSize: '10px', color: '#00ff88', letterSpacing: '2px', marginBottom: '12px' }}>TOPSTEP — EXPORT CSV</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Connecte-toi sur topstep.com',
                  'Va dans "Trading History" ou "Performance"',
                  'Clique sur "Export" → sélectionne la période',
                  'Télécharge le CSV et glisse-le ici',
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#00ff88', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                    <span style={{ fontSize: '11px', color: '#8aaa90', lineHeight: '1.5' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'rgba(0,170,255,0.03)', border: '1px solid rgba(0,170,255,0.08)', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ fontSize: '10px', color: '#00aaff', letterSpacing: '2px', marginBottom: '8px' }}>TRADOVATE — EXPORT ORDERS (recommandé)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { title: 'Orders / Ordres (format détecté ✓)', steps: ['Connecte-toi sur trader.tradovate.com', 'Menu latéral → "Orders" (Ordres)', 'Filtre : Status = "Filled" + période', 'Icône export (↓) → Download CSV', 'Colonnes clés : B/S, Product, avgPrice, filledQty, Fill Time'] },
                  { title: 'Ledger (relevé de compte)', steps: ['Menu latéral → "Account" → "Activity"', 'Export CSV', 'Colonnes : Transaction ID, Cash Change Type, Amount, Contract'] },
                ].map(({ title, steps }) => (
                  <div key={title}>
                    <div style={{ fontSize: '10px', color: '#4a8aaa', marginBottom: '4px', fontWeight: '600' }}>▸ {title}</div>
                    {steps.map((s, i) => (
                      <div key={i} style={{ fontSize: '10px', color: '#6a8a9a', paddingLeft: '10px', lineHeight: '1.6' }}>• {s}</div>
                    ))}
                  </div>
                ))}
                <div style={{ fontSize: '9px', color: '#3a5a6a', padding: '6px 8px', background: 'rgba(0,170,255,0.05)', borderRadius: '3px', borderLeft: '2px solid rgba(0,170,255,0.2)' }}>
                  ℹ️ Les ordres Canceled sont ignorés automatiquement. Les frais ne sont pas dans cet export — tu peux les ajouter manuellement dans le Journal.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Source + file info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: `rgba(${sourceInfo.color === '#00ff88' ? '0,255,136' : '0,170,255'},0.06)`, border: `1px solid ${sourceInfo.color}25`, borderRadius: '8px' }}>
            <div style={{ fontSize: '20px' }}>{sourceInfo.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: sourceInfo.color, fontWeight: '700' }}>{sourceInfo.label} détecté</div>
              <div style={{ fontSize: '11px', color: '#4a7a5a' }}>{fileName} · {trades.length} trade{trades.length > 1 ? 's' : ''}</div>
            </div>
            <button onClick={() => { setStep('drop'); setTrades([]); setSource(null); setFileName(''); }} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
              Changer de fichier
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[
              { label: 'TOTAL',      value: trades.length,          color: '#c8d8c8' },
              { label: 'NOUVEAUX',   value: newTrades.length,       color: '#00ff88' },
              { label: 'DOUBLONS',   value: duplicates.size,        color: '#f0a020' },
              { label: 'WIN / LOSS', value: `${wins}W / ${losses}L`, color: '#c8d8c8' },
              { label: 'P&L NET',    value: fmt(totalNet, true),    color: pnlColor(totalNet) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '6px', padding: '10px 12px', borderTop: `2px solid ${color}` }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Duplicate warning */}
          {duplicates.size > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.3)', borderRadius: '6px', fontSize: '12px', color: '#f0a020' }}>
              ⚠ {duplicates.size} trade{duplicates.size > 1 ? 's' : ''} déjà présent{duplicates.size > 1 ? 's' : ''} dans la base (affiché{duplicates.size > 1 ? 's' : ''} en orange) — ils seront ignorés par défaut.
            </div>
          )}

          {/* Table header */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 86px 90px 60px 60px 55px 90px 75px 70px 1fr', gap: '5px', padding: '8px 10px', fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.06)', background: 'rgba(0,0,0,0.2)' }}>
              <span>#</span><span>DATE</span><span>ENTRÉE/SORTIE</span><span>PAIRE</span><span>DIR.</span><span>TAILLE</span><span>P&L NET</span><span style={{ color: '#5a4a20' }}>FRAIS</span><span>DURÉE</span><span>STATUT</span>
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px' }}>
              {trades.map((t, i) => (
                <PreviewRow key={t.external_id ?? i} trade={t} idx={i} duplicate={duplicates.has(t.external_id)} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
            {duplicates.size > 0 && (
              <button onClick={() => handleImport(false)} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid rgba(240,160,32,0.3)', background: 'rgba(240,160,32,0.08)', color: '#f0a020', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
                Tout importer (avec doublons)
              </button>
            )}
            <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
              ANNULER
            </button>
            <button onClick={() => handleImport(true)} disabled={newTrades.length === 0} style={{ padding: '10px 28px', borderRadius: '5px', background: newTrades.length === 0 ? 'rgba(10,28,18,0.4)' : 'linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,170,85,0.15))', border: `1px solid ${newTrades.length === 0 ? '#1a3a22' : 'rgba(0,255,136,0.35)'}`, color: newTrades.length === 0 ? '#2a5a32' : '#00ff88', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: newTrades.length === 0 ? 'not-allowed' : 'pointer' }}>
              IMPORTER {newTrades.length > 0 ? `${newTrades.length} TRADE${newTrades.length > 1 ? 'S' : ''}` : '(aucun nouveau)'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: IMPORTING ── */}
      {step === 'importing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '60px 0' }}>
          <div style={{ fontSize: '13px', color: '#3a6a4a', letterSpacing: '3px' }}>IMPORT EN COURS...</div>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ height: '6px', background: 'rgba(0,255,136,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#00aa55,#00ff88)', borderRadius: '3px', transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(0,255,136,0.4)' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#3a6a4a' }}>{progress}%</div>
          </div>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: result.errors === 0 ? 'rgba(0,255,136,0.12)' : 'rgba(240,160,32,0.12)', border: `2px solid ${result.errors === 0 ? '#00ff88' : '#f0a020'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: `0 0 24px ${result.errors === 0 ? 'rgba(0,255,136,0.2)' : 'rgba(240,160,32,0.2)'}` }}>
            {result.errors === 0 ? '✓' : '⚠'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8f8e8', marginBottom: '6px' }}>
              {result.errors === 0 ? 'Import réussi !' : 'Import terminé avec des erreurs'}
            </div>
            <div style={{ fontSize: '13px', color: '#4a7a5a' }}>
              {result.imported} importé{result.imported > 1 ? 's' : ''} · {result.skipped} ignoré{result.skipped > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setStep('drop'); setTrades([]); setSource(null); setFileName(''); setError(''); }} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
              Nouvel import
            </button>
            <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 28px', borderRadius: '5px', background: 'linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,170,85,0.15))', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
              VOIR LE DASHBOARD →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
