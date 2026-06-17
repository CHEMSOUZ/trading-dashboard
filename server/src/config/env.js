const path = require('path');
require('dotenv').config();

const REQUIRED = ['JWT_SECRET', 'ANTHROPIC_API_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  DATABASE_PATH: process.env.DATABASE_PATH
    ? path.resolve(__dirname, '..', '..', process.env.DATABASE_PATH)
    : path.resolve(__dirname, '..', '..', 'data', 'app.db'),
};
