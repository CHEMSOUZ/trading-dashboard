const db = require('./connection');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      email                TEXT NOT NULL UNIQUE,
      password_hash        TEXT NOT NULL,
      subscription_status  TEXT NOT NULL DEFAULT 'inactive',
      subscription_plan    TEXT NOT NULL DEFAULT 'basic',
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tokens_used  INTEGER NOT NULL,
      endpoint     TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created
      ON usage_logs(user_id, created_at);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code       TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS global_trader_profile (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      generated_at  TEXT NOT NULL,
      month_key     TEXT NOT NULL,
      trade_count   INTEGER NOT NULL,
      identity      TEXT NOT NULL,
      strengths     TEXT NOT NULL,
      weaknesses    TEXT NOT NULL,
      priority      TEXT NOT NULL,
      wr_evolution  TEXT NOT NULL,
      UNIQUE(user_id, month_key)
    );
  `);

  // Migration installs existantes : colonne attempts absente avant cette version
  try {
    db.exec('ALTER TABLE password_reset_tokens ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
  } catch (_) {}
}

module.exports = migrate;
