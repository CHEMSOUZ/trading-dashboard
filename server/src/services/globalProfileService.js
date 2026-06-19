const db = require('../db/connection');

function getByMonth(userId, monthKey) {
  return db.prepare(`
    SELECT * FROM global_trader_profile WHERE user_id = ? AND month_key = ?
  `).get(userId, monthKey);
}

function getLatest(userId) {
  return db.prepare(`
    SELECT * FROM global_trader_profile WHERE user_id = ? ORDER BY month_key DESC LIMIT 1
  `).get(userId);
}

function deleteByMonth(userId, monthKey) {
  db.prepare(`DELETE FROM global_trader_profile WHERE user_id = ? AND month_key = ?`).run(userId, monthKey);
}

function getById(id) {
  return db.prepare(`SELECT * FROM global_trader_profile WHERE id = ?`).get(id);
}

function insert(userId, monthKey, data) {
  const result = db.prepare(`
    INSERT INTO global_trader_profile
      (user_id, generated_at, month_key, trade_count, identity, strengths, weaknesses, priority, wr_evolution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    new Date().toISOString(),
    monthKey,
    data.tradeCount,
    data.identity,
    JSON.stringify(data.strengths),
    JSON.stringify(data.weaknesses),
    data.priority,
    JSON.stringify(data.wrEvolution),
  );
  return getById(result.lastInsertRowid);
}

// Les colonnes strengths/weaknesses/wr_evolution sont stockees en JSON texte
// (pas de support natif des arrays en SQLite) -- on les deserialise ici pour
// que le reste du backend ne manipule jamais des chaines JSON brutes.
function toClientShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    generatedAt: row.generated_at,
    monthKey: row.month_key,
    tradeCount: row.trade_count,
    identity: row.identity,
    strengths: JSON.parse(row.strengths),
    weaknesses: JSON.parse(row.weaknesses),
    priority: row.priority,
    wrEvolution: JSON.parse(row.wr_evolution),
  };
}

module.exports = { getByMonth, getLatest, deleteByMonth, insert, toClientShape };
