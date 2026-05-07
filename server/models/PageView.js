const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
      index: true,
      maxlength: 500,
    },
    referrer: {
      type: String,
      default: '',
      maxlength: 500,
    },
    country: {
      type: String,
      default: '',
      maxlength: 4,
    },
    device: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'bot', 'unknown'],
      default: 'unknown',
    },
    browser: {
      type: String,
      default: '',
      maxlength: 40,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      maxlength: 64,
    },
    articleSlug: {
      type: String,
      default: null,
      index: true,
      maxlength: 200,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 365, // 1 year — supports yearly views
    },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);

pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ path: 1, createdAt: -1 });

module.exports = mongoose.model('PageView', pageViewSchema);
