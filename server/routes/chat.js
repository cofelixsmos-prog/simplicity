const express = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/session');
const { chatLimiter, enhanceLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/message', requireAuth, chatLimiter, chatController.sendMessage);
router.post('/local/start', requireAuth, chatLimiter, chatController.startLocalMessage);
router.post('/local/finish', requireAuth, chatLimiter, chatController.finishLocalMessage);
router.post('/enhance', requireAuth, enhanceLimiter, chatController.enhanceReply);
router.get('/conversations', requireAuth, chatController.listConversations);
router.get('/conversations/:id', requireAuth, chatController.getConversation);
router.patch('/conversations/:id/title', requireAuth, chatController.updateConversationTitle);
router.delete('/conversations', requireAuth, chatController.deleteAllConversations);
router.delete('/conversations/:id', requireAuth, chatController.deleteConversation);

module.exports = router;
