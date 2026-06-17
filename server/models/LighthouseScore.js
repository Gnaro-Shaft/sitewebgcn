const mongoose = require('mongoose');

// One document per Lighthouse run. We keep history so we can show trends
// later if we want. /api/lighthouse/latest just returns the most recent.
const lighthouseScoreSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, index: true },
    // 'mobile' or 'desktop' — Lighthouse scores differ significantly between
    // form factors, so we store one document per device per run.
    strategy: {
      type: String,
      enum: ['mobile', 'desktop'],
      required: true,
      index: true,
    },
    performance: { type: Number, required: true }, // 0-100
    seo: { type: Number, required: true },
    accessibility: { type: Number, required: true },
    bestPractices: { type: Number, required: true },
    // Raw response metadata for debugging
    lighthouseVersion: { type: String },
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Compound index used by the "latest per strategy" query
lighthouseScoreSchema.index({ url: 1, strategy: 1, fetchedAt: -1 });

module.exports = mongoose.model('LighthouseScore', lighthouseScoreSchema);
