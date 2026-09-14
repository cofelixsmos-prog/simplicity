const express = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/session');
const { chatLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/message', requireAuth, chatLimiter, chatController.sendMessage);

module.exports = router;
