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
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS mental_reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT NOT NULL UNIQUE,
      emotion      TEXT NOT NULL,
      description  TEXT NOT NULL,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start   TEXT NOT NULL UNIQUE,
      trend        TEXT NOT NULL,
      description  TEXT NOT NULL,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      color            TEXT NOT NULL,
      allocated_amount REAL NOT NULL DEFAULT 0,
      pocket           TEXT,
      sort_order       INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      amount      REAL NOT NULL,
      label       TEXT NOT NULL,
      date        TEXT NOT NULL,
      month_key   TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES budget_categories(id)
    );

    CREATE TABLE IF NOT EXISTS budget_settings (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      month_key      TEXT NOT NULL UNIQUE,
      monthly_income REAL NOT NULL DEFAULT 0,
      pocket_targets TEXT NOT NULL DEFAULT '{"essentials":50,"growth":25,"stability":15,"rewards":10}'
    );

    CREATE TABLE IF NOT EXISTS budget_subcategories (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      pocket           TEXT NOT NULL CHECK(pocket IN ('essentials','growth','stability','rewards')),
      name             TEXT NOT NULL,
      color            TEXT NOT NULL,
      allocated_amount REAL NOT NULL DEFAULT 0,
      sort_order       INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_mental_reports (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      date          TEXT NOT NULL,
      trait         TEXT NOT NULL,
      emotion_text  TEXT NOT NULL,
      patterns_text TEXT NOT NULL,
      focus_text    TEXT NOT NULL,
      trades_count  INTEGER NOT NULL,
      win_rate      REAL NOT NULL,
      pnl_net       REAL NOT NULL,
      generated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
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
    "ALTER TABLE trades ADD COLUMN rating INTEGER",
    "ALTER TABLE trades ADD COLUMN tags TEXT",
    // weekly_reports : passage du bilan IA hebdomadaire de texte libre à JSON structuré.
    // La colonne description existante est conservee comme fallback pour les entrees anterieures.
    "ALTER TABLE weekly_reports ADD COLUMN verdict_label TEXT",
    "ALTER TABLE weekly_reports ADD COLUMN patterns TEXT",
    "ALTER TABLE weekly_reports ADD COLUMN recommandation TEXT",
    "ALTER TABLE weekly_reports ADD COLUMN paragraphes TEXT",
    "ALTER TABLE budget_transactions ADD COLUMN subcategory_id INTEGER",
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
    const exists = getOne(db, 'SELECT id,entered_at,exited_at,size,duration,exit_price,fees,commissions,result_net FROM trades WHERE external_id = ?', [trade.external_id]);
    if (exists) {
      const isIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s);
      const newFees  = (trade.fees ?? 0) + (trade.commissions ?? 0);
      const hasFees  = newFees > 0;
      const missingFees = !exists.fees && !exists.commissions;
      // Auto-patch: corrige timestamps ISO manquants ET/OU frais manquants
      if ((isIso(trade.entered_at) && !isIso(exists.entered_at)) || (hasFees && missingFees)) {
        runQ(db, dbPath, `
          UPDATE trades SET
            entered_at=:ea, exited_at=:xa,
            size=COALESCE(size,:size),
            duration=COALESCE(duration,:dur),
            exit_price=COALESCE(exit_price,:ep),
            fees=CASE WHEN (fees IS NULL OR fees=0) AND :fees>0 THEN :fees ELSE fees END,
            commissions=CASE WHEN (commissions IS NULL OR commissions=0) AND :comm>0 THEN :comm ELSE commissions END,
            result_net=CASE WHEN (fees IS NULL OR fees=0) AND :fees>0 THEN :result_net ELSE result_net END
          WHERE id=:id
        `, { ':ea': trade.entered_at, ':xa': trade.exited_at ?? null,
             ':size': trade.size ?? null, ':dur': trade.duration ?? null,
             ':ep': trade.exit_price ?? null,
             ':fees': trade.fees ?? 0, ':comm': trade.commissions ?? 0,
             ':result_net': trade.result_net ?? null,
             ':id': exists.id });
        return { id: exists.id, ...trade, patched: true };
      }
      return { id: exists.id, ...trade, skipped: true };
    }
  }
  runQ(db, dbPath, `
    INSERT INTO trades (
      external_id,date,pair,direction,entry,exit_price,stop,tp,rr,
      result,result_net,fees,commissions,size,outcome,emotion,
      screenshot,notes,entered_at,exited_at,duration,source,rating,tags
    ) VALUES (
      :external_id,:date,:pair,:direction,:entry,:exit_price,:stop,:tp,:rr,
      :result,:result_net,:fees,:commissions,:size,:outcome,:emotion,
      :screenshot,:notes,:entered_at,:exited_at,:duration,:source,:rating,:tags
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
    ':rating': trade.rating ?? null, ':tags': trade.tags ?? null,
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
      entered_at=:entered_at,exited_at=:exited_at,duration=:duration,
      rating=:rating,tags=:tags
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
    ':rating': trade.rating ?? null, ':tags': trade.tags ?? null,
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
    const token = String(name).trim().split(/\s+/)[0].toUpperCase();
    const clean = token.replace(/[A-Z]{1,2}\d{1,4}$/, '').replace(/\d+$/, '') || token;
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
  const total    = getOne(db, 'SELECT COUNT(*) as n FROM trades').n ?? 0;
  const wins     = getOne(db, "SELECT COUNT(*) as n FROM trades WHERE COALESCE(result_net,result) > 0").n ?? 0;
  const losses   = getOne(db, "SELECT COUNT(*) as n FROM trades WHERE COALESCE(result_net,result) < 0").n ?? 0;
  const be       = getOne(db, "SELECT COUNT(*) as n FROM trades WHERE COALESCE(result_net,result) = 0").n ?? 0;
  const totalPnl = getOne(db, 'SELECT COALESCE(SUM(COALESCE(result_net,result)),0) as v FROM trades').v ?? 0;
  const grossWin = getOne(db, "SELECT COALESCE(SUM(COALESCE(result_net,result)),0) as v FROM trades WHERE COALESCE(result_net,result) > 0").v ?? 0;
  const grossLoss= getOne(db, "SELECT COALESCE(ABS(SUM(COALESCE(result_net,result))),0) as v FROM trades WHERE COALESCE(result_net,result) < 0").v ?? 0;
  const avgRR    = getOne(db, 'SELECT COALESCE(AVG(rr),0) as v FROM trades WHERE rr IS NOT NULL').v ?? 0;
  const avgWin   = wins   > 0 ? grossWin  / wins   : 0;
  const avgLoss  = losses > 0 ? grossLoss / losses : 0;
  const totalFees= getOne(db, 'SELECT COALESCE(SUM(fees),0)+COALESCE(SUM(commissions),0) as v FROM trades').v ?? 0;
  const winrate  = total > 0 ? (wins / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const recent   = getAll(db, "SELECT COALESCE(result_net,result) as pnl FROM trades ORDER BY date DESC, entered_at DESC LIMIT 50");
  let streak = 0;
  if (recent.length > 0) {
    const firstPos = recent[0].pnl > 0;
    for (const t of recent) { if ((t.pnl > 0) === firstPos) streak++; else break; }
    if (!firstPos) streak = -streak;
  }
  const allPnl = getAll(db, "SELECT COALESCE(result_net,result) as pnl FROM trades WHERE COALESCE(result_net,result) IS NOT NULL ORDER BY date ASC");
  let peak = 0, cum = 0, maxDD = 0;
  for (const { pnl } of allPnl) {
    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum; if (dd > maxDD) maxDD = dd;
  }
  const bestTrade  = getOne(db, "SELECT * FROM trades WHERE COALESCE(result_net,result) IS NOT NULL ORDER BY COALESCE(result_net,result) DESC LIMIT 1");
  const worstTrade = getOne(db, "SELECT * FROM trades WHERE COALESCE(result_net,result) IS NOT NULL ORDER BY COALESCE(result_net,result) ASC LIMIT 1");
  const byDow = getAll(db, "SELECT strftime('%w',date) as dow, COUNT(*) as cnt, SUM(COALESCE(result_net,result)) as pnl, SUM(CASE WHEN COALESCE(result_net,result)>0 THEN 1 ELSE 0 END) as wins FROM trades GROUP BY dow");
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

// ── MENTAL REPORTS (bilan psychologique quotidien) ───────────────
function getMentalReport(db, date) {
  return getOne(db, 'SELECT * FROM mental_reports WHERE date=?', [date]);
}
function getMentalReportsRange(db, startDate, endDate) {
  return getAll(db, 'SELECT * FROM mental_reports WHERE date>=? AND date<=? ORDER BY date ASC', [startDate, endDate]);
}
function saveMentalReport(db, dbPath, report) {
  const existing = getMentalReport(db, report.date);
  if (existing) {
    runQ(db, dbPath, `
      UPDATE mental_reports SET emotion=:emotion, description=:description, generated_at=datetime('now')
      WHERE date=:date
    `, { ':emotion': report.emotion, ':description': report.description, ':date': report.date });
  } else {
    runQ(db, dbPath, `
      INSERT INTO mental_reports (date, emotion, description) VALUES (:date, :emotion, :description)
    `, { ':date': report.date, ':emotion': report.emotion, ':description': report.description });
  }
  return getMentalReport(db, report.date);
}

// ── WEEKLY REPORTS (bilan psychologique hebdomadaire, agrège plusieurs mental_reports) ──
function getWeeklyReport(db, weekStart) {
  return getOne(db, 'SELECT * FROM weekly_reports WHERE week_start=?', [weekStart]);
}
function saveWeeklyReport(db, dbPath, report) {
  const existing = getWeeklyReport(db, report.week_start);
  const params = {
    ':trend': report.trend,
    ':description': report.description,
    ':verdict_label': report.verdict_label ?? null,
    ':patterns': report.patterns ?? null,
    ':recommandation': report.recommandation ?? null,
    ':paragraphes': report.paragraphes ?? null,
    ':week_start': report.week_start,
  };
  if (existing) {
    runQ(db, dbPath, `
      UPDATE weekly_reports SET
        trend=:trend, description=:description,
        verdict_label=:verdict_label, patterns=:patterns,
        recommandation=:recommandation, paragraphes=:paragraphes,
        generated_at=datetime('now')
      WHERE week_start=:week_start
    `, params);
  } else {
    runQ(db, dbPath, `
      INSERT INTO weekly_reports (week_start, trend, description, verdict_label, patterns, recommandation, paragraphes)
      VALUES (:week_start, :trend, :description, :verdict_label, :patterns, :recommandation, :paragraphes)
    `, params);
  }
  return getWeeklyReport(db, report.week_start);
}

// ── DAILY MENTAL REPORTS (analyse psychologique quotidienne automatique) ──
function getDailyMentalReportsForMonth(db, userId, monthKey) {
  return getAll(db, "SELECT * FROM daily_mental_reports WHERE user_id=? AND date LIKE ? ORDER BY date ASC", [userId, `${monthKey}%`]);
}
function getDailyMentalReportForDate(db, userId, date) {
  return getOne(db, 'SELECT * FROM daily_mental_reports WHERE user_id=? AND date=?', [userId, date]);
}
// Dernier rapport disponible tous jours confondus — utilisé par le portrait IA quand
// aujourd'hui n'a pas encore d'analyse (fallback "dernière analyse disponible").
function getLatestDailyMentalReport(db, userId) {
  return getOne(db, 'SELECT * FROM daily_mental_reports WHERE user_id=? ORDER BY date DESC LIMIT 1', [userId]);
}
function saveDailyMentalReport(db, dbPath, userId, date, report) {
  const existing = getDailyMentalReportForDate(db, userId, date);
  const params = {
    ':user_id': userId, ':date': date,
    ':trait': report.trait, ':emotion_text': report.emotion_text,
    ':patterns_text': report.patterns_text, ':focus_text': report.focus_text,
    ':trades_count': report.trades_count, ':win_rate': report.win_rate, ':pnl_net': report.pnl_net,
  };
  if (existing) {
    runQ(db, dbPath, `
      UPDATE daily_mental_reports SET
        trait=:trait, emotion_text=:emotion_text, patterns_text=:patterns_text, focus_text=:focus_text,
        trades_count=:trades_count, win_rate=:win_rate, pnl_net=:pnl_net,
        generated_at=datetime('now')
      WHERE user_id=:user_id AND date=:date
    `, params);
  } else {
    runQ(db, dbPath, `
      INSERT INTO daily_mental_reports (user_id, date, trait, emotion_text, patterns_text, focus_text, trades_count, win_rate, pnl_net)
      VALUES (:user_id, :date, :trait, :emotion_text, :patterns_text, :focus_text, :trades_count, :win_rate, :pnl_net)
    `, params);
  }
  return getDailyMentalReportForDate(db, userId, date);
}
function deleteDailyMentalReport(db, dbPath, userId, date) {
  runQ(db, dbPath, 'DELETE FROM daily_mental_reports WHERE user_id=? AND date=?', [userId, date]);
}

// ── BUDGET CATEGORIES (legacy, conservée pour rollback) ───────
function getBudgetCategories(db) {
  return getAll(db, 'SELECT * FROM budget_categories ORDER BY sort_order, created_at');
}

// ── BUDGET SUBCATEGORIES ───────────────────────────────────────
const VALID_POCKETS = new Set(['essentials', 'growth', 'stability', 'rewards']);

function getBudgetSubcategories(db) {
  return getAll(db, 'SELECT * FROM budget_subcategories ORDER BY pocket, sort_order, created_at');
}
function addBudgetSubcategory(db, dbPath, sub) {
  const pocket = VALID_POCKETS.has(sub.pocket) ? sub.pocket : 'essentials';
  runQ(db, dbPath, `INSERT INTO budget_subcategories (name, color, allocated_amount, pocket, sort_order) VALUES (:name, :color, :allocated_amount, :pocket, :sort_order)`, {
    ':name': sub.name, ':color': sub.color, ':allocated_amount': sub.allocated_amount ?? 0,
    ':pocket': pocket, ':sort_order': sub.sort_order ?? 0,
  });
  return getOne(db, 'SELECT * FROM budget_subcategories WHERE id=?', [lastId(db)]);
}
function updateBudgetSubcategory(db, dbPath, id, sub) {
  const pocket = VALID_POCKETS.has(sub.pocket) ? sub.pocket : 'essentials';
  runQ(db, dbPath, `UPDATE budget_subcategories SET name=:name, color=:color, allocated_amount=:allocated_amount, pocket=:pocket WHERE id=:id`, {
    ':name': sub.name, ':color': sub.color, ':allocated_amount': sub.allocated_amount ?? 0,
    ':pocket': pocket, ':id': id,
  });
  return getOne(db, 'SELECT * FROM budget_subcategories WHERE id=?', [id]);
}
function deleteBudgetSubcategory(db, dbPath, id) {
  runQ(db, dbPath, 'DELETE FROM budget_transactions WHERE subcategory_id=?', [id]);
  runQ(db, dbPath, 'DELETE FROM budget_subcategories WHERE id=?', [id]);
}

// ── BUDGET DATA MIGRATION (budget_categories → budget_subcategories) ──
// Deux passes indépendantes :
//   1. Créer les sous-catégories manquantes depuis budget_categories (si budget_subcategories vide)
//   2. Remplir subcategory_id des transactions qui l'ont encore à NULL (via mapping par nom)
function migrateBudgetData(db, dbPath) {
  try {
    const oldExists = getOne(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='budget_categories'");
    if (!oldExists) return;
    const oldCats = getAll(db, 'SELECT * FROM budget_categories ORDER BY id');
    if (oldCats.length === 0) return;

    // Passe 1 : copier les catégories → sous-catégories si la table est vide
    const newCount = (getOne(db, 'SELECT COUNT(*) as n FROM budget_subcategories') ?? { n: 0 }).n;
    if (newCount === 0) {
      const pocketCount = {};
      const defaultedCats = [];
      for (const cat of oldCats) {
        const pocket = VALID_POCKETS.has(cat.pocket) ? cat.pocket : 'essentials';
        if (!VALID_POCKETS.has(cat.pocket)) defaultedCats.push(cat.name);
        runQ(db, dbPath, `INSERT INTO budget_subcategories (name, color, allocated_amount, pocket, sort_order) VALUES (:name, :color, :allocated_amount, :pocket, :sort_order)`, {
          ':name': cat.name, ':color': cat.color, ':allocated_amount': cat.allocated_amount ?? 0,
          ':pocket': pocket, ':sort_order': cat.sort_order ?? 0,
        });
        pocketCount[pocket] = (pocketCount[pocket] || 0) + 1;
      }
      console.log('[Budget Migration] Sous-catégories créées par poche:', JSON.stringify(pocketCount));
      if (defaultedCats.length > 0) {
        console.warn('[Budget Migration] ⚠ Catégories migrées vers essentials par défaut :', defaultedCats.join(', '));
      }
    }

    // Passe 2 : remplir subcategory_id des transactions encore à NULL (mapping par nom)
    const orphanTxs = getAll(db, 'SELECT id, category_id FROM budget_transactions WHERE subcategory_id IS NULL OR subcategory_id = 0');
    if (orphanTxs.length === 0) return;

    const allSubs = getAll(db, 'SELECT id, name FROM budget_subcategories');
    const subByName = {};
    for (const s of allSubs) subByName[s.name.trim()] = s.id;

    const catById = {};
    for (const c of oldCats) catById[c.id] = c.name;

    let migratedTx = 0;
    for (const tx of orphanTxs) {
      const catName = catById[tx.category_id];
      const newSubId = catName ? subByName[catName.trim()] : undefined;
      if (newSubId) {
        runQ(db, dbPath, 'UPDATE budget_transactions SET subcategory_id=? WHERE id=?', [newSubId, tx.id]);
        migratedTx++;
      } else {
        console.warn(`[Budget Migration] ⚠ tx[${tx.id}] category_id=${tx.category_id} sans correspondance`);
      }
    }
    if (migratedTx > 0) console.log(`[Budget Migration] Transactions rattachées : ${migratedTx}`);
  } catch(e) {
    console.error('[Budget Migration] Erreur :', e.message);
  }
}

// ── BUDGET TRANSACTIONS ────────────────────────────────────────
function getBudgetTransactions(db, monthKey) {
  return getAll(db, `
    SELECT bt.*,
      bs.name  as subcategory_name,
      bs.color as subcategory_color,
      bs.pocket as subcategory_pocket
    FROM budget_transactions bt
    LEFT JOIN budget_subcategories bs ON bt.subcategory_id = bs.id
    WHERE bt.month_key = ?
    ORDER BY bt.date DESC, bt.id DESC
  `, [monthKey]);
}
function addBudgetTransaction(db, dbPath, tx) {
  const subId = tx.subcategory_id ?? tx.category_id;
  runQ(db, dbPath, `INSERT INTO budget_transactions (category_id, subcategory_id, amount, label, date, month_key) VALUES (:category_id, :subcategory_id, :amount, :label, :date, :month_key)`, {
    ':category_id': subId, ':subcategory_id': subId,
    ':amount': tx.amount, ':label': tx.label, ':date': tx.date, ':month_key': tx.month_key,
  });
  return getOne(db, 'SELECT * FROM budget_transactions WHERE id=?', [lastId(db)]);
}
function updateBudgetTransaction(db, dbPath, id, tx) {
  const subId = tx.subcategory_id ?? tx.category_id;
  runQ(db, dbPath, `UPDATE budget_transactions SET subcategory_id=:subcategory_id, category_id=:category_id, amount=:amount, label=:label, date=:date WHERE id=:id`, {
    ':subcategory_id': subId, ':category_id': subId,
    ':amount': tx.amount, ':label': tx.label, ':date': tx.date, ':id': id,
  });
  return getOne(db, 'SELECT * FROM budget_transactions WHERE id=?', [id]);
}
function deleteBudgetTransaction(db, dbPath, id) {
  runQ(db, dbPath, 'DELETE FROM budget_transactions WHERE id=?', [id]);
}

// ── BUDGET SETTINGS ────────────────────────────────────────────
function parseBudgetSettings(row) {
  if (!row) return null;
  try { row.pocket_targets = typeof row.pocket_targets === 'string' ? JSON.parse(row.pocket_targets) : row.pocket_targets; } catch(_) {}
  return row;
}
function getBudgetSettings(db, monthKey) {
  return parseBudgetSettings(getOne(db, 'SELECT * FROM budget_settings WHERE month_key=?', [monthKey]));
}
function getLatestBudgetSettings(db) {
  return parseBudgetSettings(getOne(db, 'SELECT * FROM budget_settings ORDER BY month_key DESC LIMIT 1'));
}
function updateBudgetSettings(db, dbPath, monthKey, monthly_income, pocket_targets) {
  const targets = typeof pocket_targets === 'string' ? pocket_targets : JSON.stringify(pocket_targets);
  const existing = getOne(db, 'SELECT id FROM budget_settings WHERE month_key=?', [monthKey]);
  if (existing) {
    runQ(db, dbPath, `UPDATE budget_settings SET monthly_income=:income, pocket_targets=:targets WHERE month_key=:mk`, {
      ':income': monthly_income, ':targets': targets, ':mk': monthKey,
    });
  } else {
    runQ(db, dbPath, `INSERT INTO budget_settings (month_key, monthly_income, pocket_targets) VALUES (:mk, :income, :targets)`, {
      ':mk': monthKey, ':income': monthly_income, ':targets': targets,
    });
  }
  return getBudgetSettings(db, monthKey);
}

// ── AI CONVERSATIONS ──────────────────────────────────────────
function getAiMessages(db) {
  return getAll(db, 'SELECT * FROM ai_conversations ORDER BY created_at ASC');
}
function insertAiMessage(db, dbPath, msg) {
  runQ(db, dbPath, 'INSERT INTO ai_conversations (role, content) VALUES (:role, :content)', {
    ':role': msg.role, ':content': msg.content,
  });
  return { id: lastId(db), ...msg };
}
function clearAiConversations(db, dbPath) {
  runQ(db, dbPath, 'DELETE FROM ai_conversations');
}

module.exports = {
  getDb,
  getAllTrades, getTradeById, insertTrade, updateTrade, deleteTrade,
  importCsvTrades, getStats,
  insertEmotionalCheck, getTodayEmotionalCheck,
  getDailyAnalyses, getDailyAnalysis, upsertDailyAnalysis, deleteDailyAnalysis,
  getWeeklyAnalyses, getWeeklyAnalysis, upsertWeeklyAnalysis, deleteWeeklyAnalysis,
  getMentalReport, getMentalReportsRange, saveMentalReport,
  getWeeklyReport, saveWeeklyReport,
  getDailyMentalReportsForMonth, getDailyMentalReportForDate, getLatestDailyMentalReport, saveDailyMentalReport, deleteDailyMentalReport,
  getAiMessages, insertAiMessage, clearAiConversations,
  migrateBudgetData,
  getBudgetCategories,
  getBudgetSubcategories, addBudgetSubcategory, updateBudgetSubcategory, deleteBudgetSubcategory,
  getBudgetTransactions, addBudgetTransaction, updateBudgetTransaction, deleteBudgetTransaction,
  getBudgetSettings, getLatestBudgetSettings, updateBudgetSettings,
};
