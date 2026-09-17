const express = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/session');
const { chatLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/message', requireAuth, chatLimiter, chatController.sendMessage);
router.post('/local/start', requireAuth, chatLimiter, chatController.startLocalMessage);
router.post('/local/finish', requireAuth, chatLimiter, chatController.finishLocalMessage);
router.get('/conversations', requireAuth, chatController.listConversations);
router.get('/conversations/:id', requireAuth, chatController.getConversation);
router.delete('/conversations/:id', requireAuth, chatController.deleteConversation);

module.exports = router;
