const Conversation = require('../models/Conversation');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/conversations - Get user's conversations
exports.getConversations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, archived, tag } = req.query;
  
  const filter = { user: req.user._id, archived: archived === 'true' };
  
  if (type) {
    filter.type = type;
  }
  
  if (tag) {
    filter.tags = { $in: tag.split(',') };
  }
  
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;
  
  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-messages'), // Don't return full messages in list
    Conversation.countDocuments(filter)
  ]);
  
  res.json({
    success: true,
    count: conversations.length,
    total,
    page: pageNum,
    data: conversations
  });
});

// GET /api/conversations/:id - Get single conversation
exports.getConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user._id
  });
  
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  
  res.json({ success: true, data: conversation });
});

// POST /api/conversations - Create conversation
exports.createConversation = asyncHandler(async (req, res) => {
  const { title, messages, type, tags, summary, contextNotes } = req.body;
  
  const conversation = await Conversation.create({
    user: req.user._id,
    title: title || 'Nouvelle conversation',
    messages: messages || [],
    type: type || 'general',
    tags: tags || [],
    summary: summary || '',
    contextNotes: contextNotes || {},
  });
  
  res.status(201).json({ success: true, data: conversation });
});

// PATCH /api/conversations/:id - Update conversation
exports.updateConversation = asyncHandler(async (req, res) => {
  const { title, messages, summary, tags, archived, contextNotes } = req.body;
  
  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    {
      ...(title !== undefined && { title }),
      ...(messages !== undefined && { messages }),
      ...(summary !== undefined && { summary }),
      ...(tags !== undefined && { tags }),
      ...(archived !== undefined && { archived }),
      ...(contextNotes !== undefined && { contextNotes }),
    },
    { returnDocument: 'after', runValidators: true }
  );
  
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  
  res.json({ success: true, data: conversation });
});

// POST /api/conversations/:id/add-message - Add message to conversation
exports.addMessage = asyncHandler(async (req, res) => {
  const { role, content } = req.body;
  
  if (!role || !content) {
    return res.status(400).json({ success: false, error: 'Role and content are required' });
  }
  
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user._id
  });
  
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  
  conversation.addMessage(role, content);
  await conversation.save();
  
  res.json({ success: true, data: conversation });
});

// DELETE /api/conversations/:id - Delete conversation
exports.deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id
  });
  
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  
  res.json({ success: true, data: {} });
});

// GET /api/conversations/context - Get conversation context for AI
exports.getAiContext = asyncHandler(async (req, res) => {
  const { limit = 5, type } = req.query;
  
  const filter = { user: req.user._id, archived: false };
  if (type) {
    filter.type = type;
  }
  
  const conversations = await Conversation.find(filter)
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .select('title summary tags type contextNotes updatedAt');
  
  const context = conversations.map(c => c.extractAiContext());
  
  res.json({ success: true, data: context });
});
