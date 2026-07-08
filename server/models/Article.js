const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    excerpt: {
      type: String,
      maxlength: 300,
    },
    tags: {
      type: [String],
      default: [],
    },
    published: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    // Per-platform status of the LinkedIn/X publication queue. Status values:
    //   'pending'  — never queued (default, article is only on the blog)
    //   'queued'   — publish clicked, waiting for n8n to poll and post
    //   'posted'   — successfully posted, postUrn stored for backref
    //   'failed'   — n8n reported failure with error message
    // The old boolean flag has been migrated to `status === 'posted'` reads.
    socialPosted: {
      linkedin: {
        status: {
          type: String,
          enum: ['pending', 'queued', 'posted', 'failed'],
          default: 'pending',
        },
        queuedAt: Date,
        postedAt: Date,
        postUrn: String,      // URN LinkedIn du post (renvoyé par leur API)
        commentUrn: String,   // URN du firstComment
        error: String,        // message si status='failed'
      },
      x: {
        status: {
          type: String,
          enum: ['pending', 'queued', 'posted', 'failed'],
          default: 'pending',
        },
        queuedAt: Date,
        postedAt: Date,
        postUrn: String,
        error: String,
      },
    },
    views: {
      type: Number,
      default: 0,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generate slug from title if not provided
articleSchema.pre('save', async function () {
  if (!this.isModified('title') && this.slug) return;

  let slug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure unique slug
  const existing = await mongoose.model('Article').findOne({ slug, _id: { $ne: this._id } });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  this.slug = slug;
});

module.exports = mongoose.model('Article', articleSchema);
