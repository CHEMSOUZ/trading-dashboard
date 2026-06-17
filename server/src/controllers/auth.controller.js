const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const userService = require('../services/userService');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    subscription_status: user.subscription_status,
    subscription_plan: user.subscription_plan,
  };
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || password.length < 8) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Email et mot de passe (8 caracteres minimum) requis.',
      });
    }

    const user = await userService.createUser(email.toLowerCase().trim(), password);
    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (e) {
    if (e.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'Un compte existe deja avec cet email.' });
    }
    next(e);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Email et mot de passe requis.' });
    }

    const user = userService.getUserByEmail(email.toLowerCase().trim());
    const valid = user ? await userService.verifyPassword(user, password) : false;
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect.' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (e) {
    next(e);
  }
}

module.exports = { register, login };
