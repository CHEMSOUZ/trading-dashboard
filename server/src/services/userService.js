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

module.exports = { getUserByEmail, getUserById, createUser, verifyPassword };
