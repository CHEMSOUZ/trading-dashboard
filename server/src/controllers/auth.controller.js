const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const userService  = require('../services/userService');
const emailService = require('../services/emailService');

function validatePassword(password) {
  if (!password || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[a-zA-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une lettre.';
  if (!/\d/.test(password))       return 'Le mot de passe doit contenir au moins un chiffre.';
  return null;
}

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
    if (!email || !password) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Email et mot de passe requis.' });
    }
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: 'INVALID_INPUT', message: pwError });

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

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Email requis.' });

    const code = userService.createResetToken(email.toLowerCase().trim());
    if (code) {
      try {
        await emailService.sendResetCode(email.toLowerCase().trim(), code);
      } catch(e) {
        if (e.message === 'EMAIL_NOT_CONFIGURED') {
          return res.status(503).json({ error: 'EMAIL_NOT_CONFIGURED', message: 'Le service email n\'est pas configuré sur le serveur.' });
        }
        return res.status(500).json({ error: 'EMAIL_SEND_FAILED', message: 'Impossible d\'envoyer l\'email. Vérifiez la configuration SMTP.' });
      }
    }
    // Toujours renvoyer 200 même si l'email n'existe pas (évite l'énumération)
    res.json({ ok: true, message: 'Si un compte existe avec cet email, un code a été envoyé.' });
  } catch(e) { next(e); }
}

async function resetPassword(req, res, next) {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Email, code et nouveau mot de passe requis.' });
    }
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: 'INVALID_INPUT', message: pwError });
    let user;
    try {
      user = userService.verifyAndConsumeResetToken(email.toLowerCase().trim(), code.trim());
    } catch(e) {
      if (e.message === 'CODE_EXPIRED')  return res.status(400).json({ error: 'CODE_EXPIRED',  message: 'Ce code a expiré. Faites une nouvelle demande.' });
      if (e.message === 'MAX_ATTEMPTS')  return res.status(400).json({ error: 'MAX_ATTEMPTS',  message: 'Trop de tentatives incorrectes. Faites une nouvelle demande de code.' });
      return res.status(400).json({ error: 'INVALID_CODE', message: 'Code incorrect.' });
    }
    await userService.updatePassword(user.id, newPassword);
    res.json({ ok: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch(e) { next(e); }
}

module.exports = { register, login, forgotPassword, resetPassword };
