const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/profile - Get current user's profile
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  
  res.json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      role: user.role,
      profile: user.profile || {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  });
});

// PATCH /api/profile - Update current user's profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const { bio, writingStyle, preferences, articleHistory } = req.body;
  
  const updateFields = {};
  
  if (bio !== undefined) {
    updateFields['profile.bio'] = bio;
  }
  
  if (writingStyle !== undefined) {
    updateFields['profile.writingStyle'] = writingStyle;
  }
  
  if (preferences !== undefined) {
    updateFields['profile.preferences'] = {
      ...req.user.profile?.preferences,
      ...preferences
    };
  }
  
  if (articleHistory !== undefined) {
    updateFields['profile.articleHistory'] = articleHistory;
  }
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateFields,
    { returnDocument: 'after', runValidators: true }
  ).select('-password');
  
  res.json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      role: user.role,
      profile: user.profile || {},
    }
  });
});

// POST /api/profile/article-feedback - Record article feedback for learning
exports.recordArticleFeedback = asyncHandler(async (req, res) => {
  const { articleId, rating, comments, modifications } = req.body;
  
  if (!articleId || !rating) {
    return res.status(400).json({ 
      success: false, 
      error: 'articleId and rating are required' 
    });
  }
  
  const user = await User.findById(req.user._id);
  
  if (!user.profile.articleHistory) {
    user.profile.articleHistory = new Map();
  }
  
  user.profile.articleHistory.set(articleId, {
    rating,
    comments,
    modifications,
    feedbackAt: new Date()
  });
  
  await user.save();
  
  res.json({ 
    success: true, 
    message: 'Feedback recorded',
    data: user.profile.articleHistory.get(articleId)
  });
});
