const bcrypt = require('bcrypt');
const db = require('../db/connection');
const { BCRYPT_SALT_ROUNDS } = require('../config/env');

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

async function createUser(email, password) {
  if (getUserByEmail(email)) throw new Error('EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, subscription_status, subscription_plan)
    VALUES (?, ?, 'inactive', 'basic')
  `).run(email, passwordHash);
  return getUserById(result.lastInsertRowid);
}

function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

function createResetToken(email) {
  const user = getUserByEmail(email);
  if (!user) return null; // ne pas révéler si l'email existe
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
  const code      = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO password_reset_tokens (user_id, code, expires_at) VALUES (?, ?, ?)').run(user.id, code, expiresAt);
  return code;
}

function verifyAndConsumeResetToken(email, code) {
  const user = getUserByEmail(email);
  if (!user) throw new Error('INVALID_CODE');
  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE user_id = ? AND code = ?').get(user.id, code);
  if (!row) throw new Error('INVALID_CODE');
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(row.id);
    throw new Error('CODE_EXPIRED');
  }
  db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(row.id);
  return user;
}

async function updatePassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

module.exports = {
  getUserByEmail, getUserById, createUser, verifyPassword,
  createResetToken, verifyAndConsumeResetToken, updatePassword,
};
