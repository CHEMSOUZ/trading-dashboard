const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');
const checkUsageLimit = require('../middleware/checkUsageLimit');
const controller = require('../controllers/global-profile.controller');

const router = express.Router();

router.post('/generate', requireAuth, requireActiveSubscription, checkUsageLimit, controller.generate);
router.get('/latest',    requireAuth, requireActiveSubscription, controller.latest);

module.exports = router;
