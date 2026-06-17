const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');
const checkUsageLimit = require('../middleware/checkUsageLimit');
const aiController = require('../controllers/ai.controller');

const router = express.Router();

router.post('/chat', requireAuth, requireActiveSubscription, checkUsageLimit, aiController.chat);

module.exports = router;
