const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives, reessayez plus tard.' },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives, reessayez dans 15 minutes.' },
});

router.post('/register',         authLimiter,  authController.register);
router.post('/login',            authLimiter,  authController.login);
router.post('/forgot-password',  resetLimiter, authController.forgotPassword);
router.post('/reset-password',   resetLimiter, authController.resetPassword);

module.exports = router;
