const path = require('path');
const fs   = require('fs');

// ── Per-account DB instances ──────────────────────────────────
const instances = {};
let SQL = null;

async function initSql() {
  if (!SQL) {
    const initSqlJs = require('sql.js');
    const path = require('path');

// En prod, le wasm est dans extraResources
const wasmPath = process.env.NODE_ENV === 'development'
  ? undefined
  : path.join(process.resourcesPath, 'sql-wasm.wasm');

SQL = await initSqlJs(
  wasmPath ? { locateFile: () => wasmPath } : {}
);
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
  `);

  // Migrations
  const cols = [
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
  for (const sql of cols) { try { db.exec(sql); } catch (_) {} }
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
    const exists = getOne(db, 'SELECT id FROM trades WHERE external_id = ?', [trade.external_id]);
    if (exists) return { id: exists.id, ...trade, skipped: true };
  }
  runQ(db, dbPath, `
    INSERT INTO trades (
      external_id, date, pair, direction, entry, exit_price, stop, tp, rr,
      result, result_net, fees, commissions, size, outcome, emotion,
      screenshot, notes, entered_at, exited_at, duration, source
    ) VALUES (
      :external_id,:date,:pair,:direction,:entry,:exit_price,:stop,:tp,:rr,
      :result,:result_net,:fees,:commissions,:size,:outcome,:emotion,
      :screenshot,:notes,:entered_at,:exited_at,:duration,:source
    )
  `, {
    ':external_id':  trade.external_id  ?? null,
    ':date':         trade.date,
    ':pair':         trade.pair,
    ':direction':    trade.direction,
    ':entry':        trade.entry,
    ':exit_price':   trade.exit_price   ?? null,
    ':stop':         trade.stop         ?? null,
    ':tp':           trade.tp           ?? null,
    ':rr':           trade.rr           ?? null,
    ':result':       trade.result       ?? null,
    ':result_net':   trade.result_net   ?? null,
    ':fees':         trade.fees         ?? null,
    ':commissions':  trade.commissions  ?? null,
    ':size':         trade.size         ?? null,
    ':outcome':      trade.outcome      ?? null,
    ':emotion':      trade.emotion      ?? null,
    ':screenshot':   trade.screenshot   ?? null,
    ':notes':        trade.notes        ?? null,
    ':entered_at':   trade.entered_at   ?? null,
    ':exited_at':    trade.exited_at    ?? null,
    ':duration':     trade.duration     ?? null,
    ':source':       trade.source       ?? 'manual',
  });
  return { id: lastId(db), ...trade };
}

function updateTrade(db, dbPath, id, trade) {
  runQ(db, dbPath, `
    UPDATE trades SET
      date=:date, pair=:pair, direction=:direction,
      entry=:entry, exit_price=:exit_price, stop=:stop, tp=:tp, rr=:rr,
      result=:result, result_net=:result_net, fees=:fees, commissions=:commissions,
      size=:size, outcome=:outcome, emotion=:emotion,
      screenshot=:screenshot, notes=:notes,
      entered_at=:entered_at, exited_at=:exited_at, duration=:duration
    WHERE id=:id
  `, {
    ':date':        trade.date,        ':pair':       trade.pair,
    ':direction':   trade.direction,   ':entry':      trade.entry,
    ':exit_price':  trade.exit_price  ?? null,
    ':stop':        trade.stop        ?? null, ':tp':  trade.tp   ?? null,
    ':rr':          trade.rr          ?? null,
    ':result':      trade.result      ?? null,
    ':result_net':  trade.result_net  ?? null,
    ':fees':        trade.fees        ?? null,
    ':commissions': trade.commissions ?? null,
    ':size':        trade.size        ?? null,
    ':outcome':     trade.outcome     ?? null,
    ':emotion':     trade.emotion     ?? null,
    ':screenshot':  trade.screenshot  ?? null,
    ':notes':       trade.notes       ?? null,
    ':entered_at':  trade.entered_at  ?? null,
    ':exited_at':   trade.exited_at   ?? null,
    ':duration':    trade.duration    ?? null,
    ':id':          id,
  });
  return getTradeById(db, id);
}

function deleteTrade(db, dbPath, id) {
  runQ(db, dbPath, 'DELETE FROM trades WHERE id = ?', [id]);
}

// ── CSV IMPORT ────────────────────────────────────────────────
function importCsvTrades(db, dbPath, rows) {
  let imported = 0, skipped = 0, errors = 0;
  for (const row of rows) {
    try {
      let date = '';
      if (row.TradeDay) {
        const d = new Date(row.TradeDay);
        date = isNaN(d) ? row.TradeDay.slice(0, 10) : d.toISOString().slice(0, 10);
      } else if (row.EnteredAt) {
        date = new Date(row.EnteredAt).toISOString().slice(0, 10);
      }
      const direction = (row.Type ?? '').toUpperCase().includes('LONG') ? 'LONG' : 'SHORT';
      const pnl  = parseFloat(row.PnL)        || 0;
      const fees = parseFloat(row.Fees)        || 0;
      const comm = parseFloat(row.Commissions) || 0;
      const net  = pnl - Math.abs(fees) - Math.abs(comm);
      const outcome = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE';
      const trade = {
        external_id:  String(row.Id ?? ''),
        date,
        pair:         row.ContractName ?? 'Unknown',
        direction,
        entry:        parseFloat(row.EntryPrice)  || 0,
        exit_price:   parseFloat(row.ExitPrice)   || null,
        stop: 0, tp: 0, rr: null,
        result:       pnl,
        result_net:   Math.round(net * 100) / 100,
        fees:         Math.abs(fees),
        commissions:  Math.abs(comm),
        size:         parseFloat(row.Size)        || null,
        outcome,
        entered_at:   row.EnteredAt        ?? null,
        exited_at:    row.ExitedAt         ?? null,
        duration:     row.TradeDuration    ?? null,
        source:       'topstepx_csv',
      };
      const result = insertTrade(db, dbPath, trade);
      if (result.skipped) skipped++; else imported++;
    } catch { errors++; }
  }
  return { imported, skipped, errors };
}

// ── STATS ─────────────────────────────────────────────────────
function getStats(db) {
  const total   = getOne(db, 'SELECT COUNT(*) as n FROM trades').n ?? 0;
  const wins    = getOne(db, "SELECT COUNT(*) as n FROM trades WHERE outcome='WIN'").n ?? 0;
  const losses  = getOne(db, "SELECT COUNT(*) as n FROM trades WHERE outcome='LOSS'").n ?? 0;
  const be      = getOne(db, "SELECT COUNT(*) as n FROM trades WHERE outcome='BE'").n ?? 0;
  const totalPnl  = getOne(db, 'SELECT COALESCE(SUM(result),0) as v FROM trades').v ?? 0;
  const totalNet  = getOne(db, 'SELECT COALESCE(SUM(result_net),0) as v FROM trades').v ?? 0;
  const grossWin  = getOne(db, "SELECT COALESCE(SUM(result),0) as v FROM trades WHERE result > 0").v ?? 0;
  const grossLoss = getOne(db, "SELECT COALESCE(ABS(SUM(result)),0) as v FROM trades WHERE result < 0").v ?? 0;
  const avgRR     = getOne(db, 'SELECT COALESCE(AVG(rr),0) as v FROM trades WHERE rr IS NOT NULL').v ?? 0;
  const avgWin    = wins   > 0 ? grossWin  / wins   : 0;
  const avgLoss   = losses > 0 ? grossLoss / losses : 0;
  const totalFees = getOne(db, 'SELECT COALESCE(SUM(fees),0) as v FROM trades').v ?? 0;
  const totalComm = getOne(db, 'SELECT COALESCE(SUM(commissions),0) as v FROM trades').v ?? 0;
  const winrate   = total > 0 ? (wins / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  const recent = getAll(db, "SELECT outcome FROM trades ORDER BY date DESC, entered_at DESC LIMIT 50");
  let streak = 0;
  if (recent.length > 0) {
    const first = recent[0].outcome;
    for (const t of recent) { if (t.outcome === first) streak++; else break; }
    if (first === 'LOSS') streak = -streak;
  }

  const allPnl = getAll(db, "SELECT result FROM trades WHERE result IS NOT NULL ORDER BY date ASC");
  let peak = 0, cum = 0, maxDD = 0;
  for (const { result } of allPnl) {
    cum += result;
    if (cum > peak) peak = cum;
    const dd = peak - cum; if (dd > maxDD) maxDD = dd;
  }

  const bestTrade  = getOne(db, "SELECT * FROM trades WHERE result IS NOT NULL ORDER BY result DESC LIMIT 1");
  const worstTrade = getOne(db, "SELECT * FROM trades WHERE result IS NOT NULL ORDER BY result ASC LIMIT 1");
  const byDow = getAll(db, "SELECT strftime('%w',date) as dow, COUNT(*) as cnt, SUM(result) as pnl, SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as wins FROM trades GROUP BY dow");

  return {
    total, wins, losses, be,
    totalPnl:     Math.round(totalPnl * 100) / 100,
    totalNet:     Math.round(totalNet * 100) / 100,
    grossWin:     Math.round(grossWin * 100) / 100,
    grossLoss:    Math.round(grossLoss * 100) / 100,
    avgRR:        Math.round(avgRR * 100) / 100,
    avgWin:       Math.round(avgWin * 100) / 100,
    avgLoss:      Math.round(avgLoss * 100) / 100,
    totalFees:    Math.round((totalFees + totalComm) * 100) / 100,
    winrate:      Math.round(winrate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    streak, maxDrawdown: Math.round(maxDD * 100) / 100,
    bestTrade, worstTrade, byDow,
  };
}

// ── EMOTIONAL CHECK ───────────────────────────────────────────
function insertEmotionalCheck(db, dbPath, check) {
  runQ(db, dbPath, `
    INSERT INTO emotional_checks (date, slept_ok, frustrated, respected_plan, revenge, allowed)
    VALUES (:date,:slept_ok,:frustrated,:respected_plan,:revenge,:allowed)
  `, {
    ':date': check.date, ':slept_ok': check.slept_ok,
    ':frustrated': check.frustrated, ':respected_plan': check.respected_plan,
    ':revenge': check.revenge, ':allowed': check.allowed,
  });
  return { id: lastId(db), ...check };
}

function getTodayEmotionalCheck(db) {
  const today = new Date().toISOString().slice(0, 10);
  return getOne(db, "SELECT * FROM emotional_checks WHERE date=? ORDER BY created_at DESC LIMIT 1", [today]);
}

module.exports = { getDb, getAllTrades, getTradeById, insertTrade, updateTrade, deleteTrade, importCsvTrades, getStats, insertEmotionalCheck, getTodayEmotionalCheck };
