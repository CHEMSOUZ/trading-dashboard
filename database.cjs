const path = require('path');
const fs   = require('fs');

const instances = {};
let SQL = null;

async function initSql() {
  if (!SQL) {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  }
  return SQL;
}

async function getDb(dbPath) {
  if (instances[dbPath]) return instances[dbPath];
  const sql = await initSql();
  let db;
  if (fs.existsSync(dbPath)) {
    db = new sql.Database(fs.readFileSync(dbPath));
  } else {
    db = new sql.Database();
  }
  instances[dbPath] = db;
  initSchema(db);
  save(db, dbPath);
  return db;
}

function save(db, dbPath) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id   TEXT UNIQUE,
      date          TEXT    NOT NULL,
      pair          TEXT    NOT NULL,
      direction     TEXT    NOT NULL,
      entry         REAL    NOT NULL,
      exit_price    REAL,
      stop          REAL,
      tp            REAL,
      rr            REAL,
      result        REAL,
      result_net    REAL,
      fees          REAL,
      commissions   REAL,
      size          REAL,
      outcome       TEXT,
      emotion       TEXT,
      screenshot    TEXT,
      notes         TEXT,
      entered_at    TEXT,
      exited_at     TEXT,
      duration      TEXT,
      source        TEXT DEFAULT 'manual',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emotional_checks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT NOT NULL,
      slept_ok        INTEGER,
      frustrated      INTEGER,
      respected_plan  INTEGER,
      revenge         INTEGER,
      allowed         INTEGER,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_analysis (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      instrument  TEXT NOT NULL DEFAULT '',
      timeframes  TEXT NOT NULL DEFAULT '[]',
      bias        TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      key_levels  TEXT NOT NULL DEFAULT '',
      screenshots TEXT NOT NULL DEFAULT '[]',
      positives   TEXT NOT NULL DEFAULT '',
      negatives   TEXT NOT NULL DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(date, instrument)
    );

    CREATE TABLE IF NOT EXISTS weekly_analysis (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start  TEXT NOT NULL,
      instrument  TEXT NOT NULL DEFAULT '',
      macro_bias  TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      key_levels  TEXT NOT NULL DEFAULT '',
      screenshots TEXT NOT NULL DEFAULT '[]',
      positives   TEXT NOT NULL DEFAULT '',
      negatives   TEXT NOT NULL DEFAULT '',
      plan        TEXT NOT NULL DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(week_start, instrument)
    );
  `);

  // Migrations for existing DBs
  const migrations = [
    "ALTER TABLE trades ADD COLUMN external_id TEXT",
    "ALTER TABLE trades ADD COLUMN exit_price REAL",
    "ALTER TABLE trades ADD COLUMN result_net REAL",
    "ALTER TABLE trades ADD COLUMN fees REAL",
    "ALTER TABLE trades ADD COLUMN commissions REAL",
    "ALTER TABLE trades ADD COLUMN size REAL",
    "ALTER TABLE trades ADD COLUMN entered_at TEXT",
    "ALTER TABLE trades ADD COLUMN exited_at TEXT",
    "ALTER TABLE trades ADD COLUMN duration TEXT",
    "ALTER TABLE trades ADD COLUMN source TEXT DEFAULT 'manual'",
  ];
  for (const sql of migrations) { try { db.exec(sql); } catch (_) {} }
}

// ── Helpers ───────────────────────────────────────────────────
function runQ(db, dbPath, sql, params = {}) {
  db.run(sql, params);
  save(db, dbPath);
}
function getAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function getOne(db, sql, params = []) {
  return getAll(db, sql, params)[0] ?? null;
}
function lastId(db) {
  return getOne(db, 'SELECT last_insert_rowid() as id').id;
}

// ── TRADES ────────────────────────────────────────────────────
function getAllTrades(db) {
  return getAll(db, 'SELECT * FROM trades ORDER BY date DESC, entered_at DESC, created_at DESC');
}
function getTradeById(db, id) {
  return getOne(db, 'SELECT * FROM trades WHERE id = ?', [id]);
}
function insertTrade(db, dbPath, trade) {
  if (trade.external_id) {
    const exists = getOne(db, 'SELECT id,entered_at,exited_at,size,duration,exit_price FROM trades WHERE external_id = ?', [trade.external_id]);
    if (exists) {
      // Auto-patch: si les nouvelles données ont un timestamp ISO mais l'existant non, on corrige
      const isIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s);
      if (isIso(trade.entered_at) && !isIso(exists.entered_at)) {
        runQ(db, dbPath, `
          UPDATE trades SET
            entered_at=:ea, exited_at=:xa,
            size=COALESCE(size,:size),
            duration=COALESCE(duration,:dur),
            exit_price=COALESCE(exit_price,:ep)
          WHERE id=:id
        `, { ':ea': trade.entered_at, ':xa': trade.exited_at ?? null,
             ':size': trade.size ?? null, ':dur': trade.duration ?? null,
             ':ep': trade.exit_price ?? null, ':id': exists.id });
        return { id: exists.id, ...trade, patched: true };
      }
      return { id: exists.id, ...trade, skipped: true };
    }
  }
  runQ(db, dbPath, `
    INSERT INTO trades (
      external_id,date,pair,direction,entry,exit_price,stop,tp,rr,
      result,result_net,fees,commissions,size,outcome,emotion,
      screenshot,notes,entered_at,exited_at,duration,source
    ) VALUES (
      :external_id,:date,:pair,:direction,:entry,:exit_price,:stop,:tp,:rr,
      :result,:result_net,:fees,:commissions,:size,:outcome,:emotion,
      :screenshot,:notes,:entered_at,:exited_at,:duration,:source
    )
  `, {
    ':external_id': trade.external_id ?? null, ':date': trade.date,
    ':pair': trade.pair, ':direction': trade.direction, ':entry': trade.entry,
    ':exit_price': trade.exit_price ?? null, ':stop': trade.stop ?? null,
    ':tp': trade.tp ?? null, ':rr': trade.rr ?? null,
    ':result': trade.result ?? null, ':result_net': trade.result_net ?? null,
    ':fees': trade.fees ?? null, ':commissions': trade.commissions ?? null,
    ':size': trade.size ?? null, ':outcome': trade.outcome ?? null,
    ':emotion': trade.emotion ?? null, ':screenshot': trade.screenshot ?? null,
    ':notes': trade.notes ?? null, ':entered_at': trade.entered_at ?? null,
    ':exited_at': trade.exited_at ?? null, ':duration': trade.duration ?? null,
    ':source': trade.source ?? 'manual',
  });
  return { id: lastId(db), ...trade };
}
function updateTrade(db, dbPath, id, trade) {
  runQ(db, dbPath, `
    UPDATE trades SET
      date=:date,pair=:pair,direction=:direction,entry=:entry,
      exit_price=:exit_price,stop=:stop,tp=:tp,rr=:rr,
      result=:result,result_net=:result_net,fees=:fees,commissions=:commissions,
      size=:size,outcome=:outcome,emotion=:emotion,
      screenshot=:screenshot,notes=:notes,
      entered_at=:entered_at,exited_at=:exited_at,duration=:duration
    WHERE id=:id
  `, {
    ':date': trade.date, ':pair': trade.pair, ':direction': trade.direction,
    ':entry': trade.entry, ':exit_price': trade.exit_price ?? null,
    ':stop': trade.stop ?? null, ':tp': trade.tp ?? null, ':rr': trade.rr ?? null,
    ':result': trade.result ?? null, ':result_net': trade.result_net ?? null,
    ':fees': trade.fees ?? null, ':commissions': trade.commissions ?? null,
    ':size': trade.size ?? null, ':outcome': trade.outcome ?? null,
    ':emotion': trade.emotion ?? null, ':screenshot': trade.screenshot ?? null,
    ':notes': trade.notes ?? null, ':entered_at': trade.entered_at ?? null,
    ':exited_at': trade.exited_at ?? null, ':duration': trade.duration ?? null,
    ':id': id,
  });
  return getTradeById(db, id);
}
function deleteTrade(db, dbPath, id) {
  runQ(db, dbPath, 'DELETE FROM trades WHERE id = ?', [id]);
}

// ── CSV IMPORT ────────────────────────────────────────────────
function importCsvTrades(db, dbPath, rows) {
  let imported = 0, skipped = 0, errors = 0;

  function parseIso(str) {
    if (!str) return null;
    try {
      const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2}:\d{2})$/);
      if (m) return new Date(`${m[3]}-${m[1]}-${m[2]}T${m[4]}${m[5]}`).toISOString();
      return new Date(str).toISOString();
    } catch { return null; }
  }
  function fmtDur(str) {
    if (!str) return null;
    const p = str.split(':');
    if (p.length < 3) return str;
    const h = parseInt(p[0], 10), mn = parseInt(p[1], 10), s = parseInt(p[2], 10);
    if (h > 0) return `${h}h ${mn}m`;
    if (mn > 0) return `${mn}m ${s}s`;
    return `${s}s`;
  }
  function normPair(name) {
    if (!name) return 'Autre';
    const clean = name.replace(/[A-Z]\d+$/, '').replace(/\d+$/, '');
    const MAP = { MNQ:'MNQ', NQ:'NQ', MES:'MES', ES:'ES', MGC:'MGC', GC:'GC', M2K:'M2K', RTY:'RTY', MCL:'MCL', CL:'CL' };
    return MAP[clean] ?? clean;
  }

  for (const row of rows) {
    try {
      const enteredAt = parseIso(row.EnteredAt);
      const exitedAt  = parseIso(row.ExitedAt);
      const date      = enteredAt ? enteredAt.slice(0, 10) : '';
      const direction = (row.Type ?? '').toLowerCase() === 'short' ? 'SHORT' : 'LONG';
      const pnlGross  = parseFloat(row.PnL) || 0;
      const fees      = Math.abs(parseFloat(row.Fees) || 0);
      const comm      = Math.abs(parseFloat(row.Commissions) || 0);
      const pnlNet    = Math.round((pnlGross - fees - comm) * 100) / 100;
      const outcome   = pnlNet > 0 ? 'WIN' : pnlNet < 0 ? 'LOSS' : 'BE';
      const sizeVal   = parseFloat(row.Size);
      const exitVal   = parseFloat(row.ExitPrice);
      const trade = {
        external_id: row.Id ? String(row.Id) : null,
        date, pair: normPair(row.ContractName), direction,
        entry:      parseFloat(row.EntryPrice) || 0,
        exit_price: !isNaN(exitVal) && exitVal !== 0 ? exitVal : null,
        stop: 0, tp: 0, rr: null,
        result: pnlGross, result_net: pnlNet,
        fees, commissions: comm,
        size:      !isNaN(sizeVal) && sizeVal !== 0 ? sizeVal : null,
        outcome,
        entered_at: enteredAt,
        exited_at:  exitedAt,
        duration:   fmtDur(row.TradeDuration),
        source:     'topstep_csv',
      };
      const result = insertTrade(db, dbPath, trade);
      if (result.skipped) skipped++; else imported++;
    } catch { errors++; }
  }
  return { imported, skipped, errors };
}

// ── STATS ─────────────────────────────────────────────────────
function getStats(db) {
  const MF = "(COALESCE(result_net,result) IS NULL OR COALESCE(result_net,result) = 0 OR ABS(COALESCE(result_net,result)) >= 10)";
  const total    = getOne(db, `SELECT COUNT(*) as n FROM trades WHERE ${MF}`).n ?? 0;
  const wins     = getOne(db, `SELECT COUNT(*) as n FROM trades WHERE COALESCE(result_net,result) > 0 AND ${MF}`).n ?? 0;
  const losses   = getOne(db, `SELECT COUNT(*) as n FROM trades WHERE COALESCE(result_net,result) < 0 AND ${MF}`).n ?? 0;
  const be       = getOne(db, `SELECT COUNT(*) as n FROM trades WHERE COALESCE(result_net,result) = 0 AND ${MF}`).n ?? 0;
  const totalPnl = getOne(db, `SELECT COALESCE(SUM(COALESCE(result_net,result)),0) as v FROM trades WHERE ${MF}`).v ?? 0;
  const grossWin = getOne(db, `SELECT COALESCE(SUM(COALESCE(result_net,result)),0) as v FROM trades WHERE COALESCE(result_net,result) > 0 AND ${MF}`).v ?? 0;
  const grossLoss= getOne(db, `SELECT COALESCE(ABS(SUM(COALESCE(result_net,result))),0) as v FROM trades WHERE COALESCE(result_net,result) < 0 AND ${MF}`).v ?? 0;
  const avgRR    = getOne(db, `SELECT COALESCE(AVG(rr),0) as v FROM trades WHERE rr IS NOT NULL AND ${MF}`).v ?? 0;
  const avgWin   = wins   > 0 ? grossWin  / wins   : 0;
  const avgLoss  = losses > 0 ? grossLoss / losses : 0;
  const totalFees= getOne(db, `SELECT COALESCE(SUM(fees),0)+COALESCE(SUM(commissions),0) as v FROM trades WHERE ${MF}`).v ?? 0;
  const winrate  = total > 0 ? (wins / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const recent   = getAll(db, `SELECT COALESCE(result_net,result) as pnl FROM trades WHERE ${MF} ORDER BY date DESC, entered_at DESC LIMIT 50`);
  let streak = 0;
  if (recent.length > 0) {
    const firstPos = recent[0].pnl > 0;
    for (const t of recent) { if ((t.pnl > 0) === firstPos) streak++; else break; }
    if (!firstPos) streak = -streak;
  }
  const allPnl = getAll(db, `SELECT COALESCE(result_net,result) as pnl FROM trades WHERE COALESCE(result_net,result) IS NOT NULL AND ${MF} ORDER BY date ASC`);
  let peak = 0, cum = 0, maxDD = 0;
  for (const { pnl } of allPnl) {
    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum; if (dd > maxDD) maxDD = dd;
  }
  const bestTrade  = getOne(db, `SELECT * FROM trades WHERE COALESCE(result_net,result) IS NOT NULL AND ${MF} ORDER BY COALESCE(result_net,result) DESC LIMIT 1`);
  const worstTrade = getOne(db, `SELECT * FROM trades WHERE COALESCE(result_net,result) IS NOT NULL AND ${MF} ORDER BY COALESCE(result_net,result) ASC LIMIT 1`);
  const byDow = getAll(db, `SELECT strftime('%w',date) as dow, COUNT(*) as cnt, SUM(COALESCE(result_net,result)) as pnl, SUM(CASE WHEN COALESCE(result_net,result)>0 THEN 1 ELSE 0 END) as wins FROM trades WHERE ${MF} GROUP BY dow`);
  return {
    total, wins, losses, be,
    totalPnl: Math.round(totalPnl*100)/100,
    totalNet: Math.round(totalPnl*100)/100,
    grossWin: Math.round(grossWin*100)/100,
    grossLoss: Math.round(grossLoss*100)/100,
    avgRR: Math.round(avgRR*100)/100,
    avgWin: Math.round(avgWin*100)/100,
    avgLoss: Math.round(avgLoss*100)/100,
    totalFees: Math.round(totalFees*100)/100,
    winrate: Math.round(winrate*10)/10,
    profitFactor: Math.round(profitFactor*100)/100,
    streak, maxDrawdown: Math.round(maxDD*100)/100,
    bestTrade, worstTrade, byDow,
  };
}

// ── EMOTIONAL CHECK ───────────────────────────────────────────
function insertEmotionalCheck(db, dbPath, check) {
  runQ(db, dbPath, `INSERT INTO emotional_checks (date,slept_ok,frustrated,respected_plan,revenge,allowed) VALUES (:date,:slept_ok,:frustrated,:respected_plan,:revenge,:allowed)`, {
    ':date': check.date, ':slept_ok': check.slept_ok,
    ':frustrated': check.frustrated, ':respected_plan': check.respected_plan,
    ':revenge': check.revenge, ':allowed': check.allowed,
  });
  return { id: lastId(db), ...check };
}
function getTodayEmotionalCheck(db) {
  const today = new Date().toISOString().slice(0,10);
  return getOne(db, "SELECT * FROM emotional_checks WHERE date=? ORDER BY created_at DESC LIMIT 1", [today]);
}

// ── DAILY ANALYSIS ────────────────────────────────────────────
function getDailyAnalyses(db) {
  return getAll(db, 'SELECT * FROM daily_analysis ORDER BY date DESC');
}
function getDailyAnalysis(db, date, instrument) {
  return getOne(db, 'SELECT * FROM daily_analysis WHERE date=? AND instrument=?', [date, instrument]);
}
function upsertDailyAnalysis(db, dbPath, analysis) {
  const existing = getDailyAnalysis(db, analysis.date, analysis.instrument);
  if (existing) {
    runQ(db, dbPath, `
      UPDATE daily_analysis SET
        timeframes=:timeframes, bias=:bias, notes=:notes,
        key_levels=:key_levels, screenshots=:screenshots,
        positives=:positives, negatives=:negatives,
        updated_at=datetime('now')
      WHERE date=:date AND instrument=:instrument
    `, {
      ':timeframes':  analysis.timeframes  ?? '[]',
      ':bias':        analysis.bias        ?? '',
      ':notes':       analysis.notes       ?? '',
      ':key_levels':  analysis.key_levels  ?? '',
      ':screenshots': analysis.screenshots ?? '[]',
      ':positives':   analysis.positives   ?? '',
      ':negatives':   analysis.negatives   ?? '',
      ':date':        analysis.date,
      ':instrument':  analysis.instrument,
    });
    return getDailyAnalysis(db, analysis.date, analysis.instrument);
  } else {
    runQ(db, dbPath, `
      INSERT INTO daily_analysis (date,instrument,timeframes,bias,notes,key_levels,screenshots,positives,negatives)
      VALUES (:date,:instrument,:timeframes,:bias,:notes,:key_levels,:screenshots,:positives,:negatives)
    `, {
      ':date':        analysis.date,
      ':instrument':  analysis.instrument,
      ':timeframes':  analysis.timeframes  ?? '[]',
      ':bias':        analysis.bias        ?? '',
      ':notes':       analysis.notes       ?? '',
      ':key_levels':  analysis.key_levels  ?? '',
      ':screenshots': analysis.screenshots ?? '[]',
      ':positives':   analysis.positives   ?? '',
      ':negatives':   analysis.negatives   ?? '',
    });
    return getDailyAnalysis(db, analysis.date, analysis.instrument);
  }
}
function deleteDailyAnalysis(db, dbPath, id) {
  runQ(db, dbPath, 'DELETE FROM daily_analysis WHERE id=?', [id]);
}

// ── WEEKLY ANALYSIS ───────────────────────────────────────────
function getWeeklyAnalyses(db) {
  return getAll(db, 'SELECT * FROM weekly_analysis ORDER BY week_start DESC');
}
function getWeeklyAnalysis(db, weekStart, instrument) {
  return getOne(db, 'SELECT * FROM weekly_analysis WHERE week_start=? AND instrument=?', [weekStart, instrument]);
}
function upsertWeeklyAnalysis(db, dbPath, analysis) {
  const existing = getWeeklyAnalysis(db, analysis.week_start, analysis.instrument);
  if (existing) {
    runQ(db, dbPath, `
      UPDATE weekly_analysis SET
        macro_bias=:macro_bias, notes=:notes, key_levels=:key_levels,
        screenshots=:screenshots, positives=:positives, negatives=:negatives,
        plan=:plan, updated_at=datetime('now')
      WHERE week_start=:week_start AND instrument=:instrument
    `, {
      ':macro_bias':  analysis.macro_bias  ?? '',
      ':notes':       analysis.notes       ?? '',
      ':key_levels':  analysis.key_levels  ?? '',
      ':screenshots': analysis.screenshots ?? '[]',
      ':positives':   analysis.positives   ?? '',
      ':negatives':   analysis.negatives   ?? '',
      ':plan':        analysis.plan        ?? '',
      ':week_start':  analysis.week_start,
      ':instrument':  analysis.instrument,
    });
    return getWeeklyAnalysis(db, analysis.week_start, analysis.instrument);
  } else {
    runQ(db, dbPath, `
      INSERT INTO weekly_analysis (week_start,instrument,macro_bias,notes,key_levels,screenshots,positives,negatives,plan)
      VALUES (:week_start,:instrument,:macro_bias,:notes,:key_levels,:screenshots,:positives,:negatives,:plan)
    `, {
      ':week_start':  analysis.week_start,
      ':instrument':  analysis.instrument,
      ':macro_bias':  analysis.macro_bias  ?? '',
      ':notes':       analysis.notes       ?? '',
      ':key_levels':  analysis.key_levels  ?? '',
      ':screenshots': analysis.screenshots ?? '[]',
      ':positives':   analysis.positives   ?? '',
      ':negatives':   analysis.negatives   ?? '',
      ':plan':        analysis.plan        ?? '',
    });
    return getWeeklyAnalysis(db, analysis.week_start, analysis.instrument);
  }
}
function deleteWeeklyAnalysis(db, dbPath, id) {
  runQ(db, dbPath, 'DELETE FROM weekly_analysis WHERE id=?', [id]);
}

module.exports = {
  getDb,
  getAllTrades, getTradeById, insertTrade, updateTrade, deleteTrade,
  importCsvTrades, getStats,
  insertEmotionalCheck, getTodayEmotionalCheck,
  getDailyAnalyses, getDailyAnalysis, upsertDailyAnalysis, deleteDailyAnalysis,
  getWeeklyAnalyses, getWeeklyAnalysis, upsertWeeklyAnalysis, deleteWeeklyAnalysis,
};
