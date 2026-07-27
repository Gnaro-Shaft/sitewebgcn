const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  addMessage,
  deleteConversation,
  getAiContext,
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

// All conversation routes require authentication
router.use(protect);

router.get('/', getConversations);
router.get('/context', getAiContext);
router.get('/:id', getConversation);
router.post('/', createConversation);
router.patch('/:id', updateConversation);
router.post('/:id/add-message', addMessage);
router.delete('/:id', deleteConversation);

module.exports = router;
