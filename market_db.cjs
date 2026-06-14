const path = require('path');
const fs   = require('fs');

let SQL      = null;
let marketDb = null;
let mdbPath  = null;

async function initSql() {
  if (!SQL) { SQL = await require('sql.js')(); }
  return SQL;
}

async function init(userData) {
  if (marketDb) return marketDb;
  await initSql();
  mdbPath  = path.join(userData, 'market_analyses.db');
  marketDb = fs.existsSync(mdbPath)
    ? new SQL.Database(fs.readFileSync(mdbPath))
    : new SQL.Database();
  marketDb.exec(`
    CREATE TABLE IF NOT EXISTS market_ai_analyses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT NOT NULL,
      date         TEXT NOT NULL,
      content      TEXT NOT NULL DEFAULT '',
      market_data  TEXT NOT NULL DEFAULT '{}',
      generated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(type, date)
    );
  `);
  flush();
  return marketDb;
}

function flush() {
  if (!marketDb || !mdbPath) return;
  fs.writeFileSync(mdbPath, Buffer.from(marketDb.export()));
}

function getAll() {
  if (!marketDb) return [];
  const stmt = marketDb.prepare('SELECT * FROM market_ai_analyses ORDER BY date DESC, type ASC');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function upsert(type, date, content, marketData) {
  if (!marketDb) return null;
  const prev = getOne(type, date);
  if (prev) {
    marketDb.run(`UPDATE market_ai_analyses SET content=?, market_data=?, generated_at=datetime('now') WHERE type=? AND date=?`,
      [content, JSON.stringify(marketData ?? {}), type, date]);
  } else {
    marketDb.run(`INSERT INTO market_ai_analyses (type, date, content, market_data) VALUES (?,?,?,?)`,
      [type, date, content, JSON.stringify(marketData ?? {})]);
  }
  flush();
  return getOne(type, date);
}

function getOne(type, date) {
  if (!marketDb) return null;
  const stmt = marketDb.prepare('SELECT * FROM market_ai_analyses WHERE type=? AND date=?');
  stmt.bind([type, date]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function deleteById(id) {
  if (!marketDb) return;
  marketDb.run('DELETE FROM market_ai_analyses WHERE id=?', [id]);
  flush();
}

module.exports = { init, getAll, upsert, getOne, deleteById };
