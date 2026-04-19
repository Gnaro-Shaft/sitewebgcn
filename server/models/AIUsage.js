const mongoose = require('mongoose');

// One doc per month, tracks AI API spending
const aiUsageSchema = new mongoose.Schema(
  {
    // Format: "YYYY-MM" (e.g. "2026-04")
    month: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    // Cumulative spending in USD for this month
    spendingUsd: {
      type: Number,
      default: 0,
    },
    // Count of generations
    generationCount: {
      type: Number,
      default: 0,
    },
    // Last generation timestamp
    lastGeneratedAt: Date,
  },
  { timestamps: true }
);

// Get current month key (YYYY-MM)
aiUsageSchema.statics.currentMonthKey = function () {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

// Get or create current month's usage doc
aiUsageSchema.statics.getCurrent = async function () {
  const month = this.currentMonthKey();
  const year = new Date().getUTCFullYear();
  let doc = await this.findOne({ month });
  if (!doc) {
    doc = await this.create({ month, year, spendingUsd: 0, generationCount: 0 });
  }
  return doc;
};

// Get total spending for the current year
aiUsageSchema.statics.getYearSpending = async function () {
  const year = new Date().getUTCFullYear();
  const docs = await this.find({ year });
  return docs.reduce((sum, d) => sum + (d.spendingUsd || 0), 0);
};

module.exports = mongoose.model('AIUsage', aiUsageSchema);
