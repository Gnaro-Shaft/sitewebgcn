const mongoose = require('mongoose');

const cvDataSchema = new mongoose.Schema(
  {
    // One document per language. Enforced unique at index level.
    // Phase 25: enables dynamic CV generation from DB with lang selector.
    lang: {
      type: String,
      enum: ['fr', 'en'],
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      default: 'Genaro-Cedric',
    },
    title: {
      type: String,
      required: true,
      default: 'Fullstack Developer & AI Engineer',
    },
    email: String,
    phone: String,
    location: String,
    website: String,
    github: String,
    linkedin: String,
    summary: String,
    experience: [
      {
        role: { type: String, required: true },
        company: { type: String, required: true },
        location: String,
        startDate: String,
        endDate: String,
        description: String,
        highlights: [String],
      },
    ],
    education: [
      {
        degree: { type: String, required: true },
        school: { type: String, required: true },
        location: String,
        startDate: String,
        endDate: String,
        description: String,
      },
    ],
    skills: [
      {
        category: { type: String, required: true },
        items: [String],
      },
    ],
    // Phase 25 addendum: projects section — the CV's credibility layer for
    // an AI Engineer role. Distinct from Experience (which is jobs) and
    // Certifications (which must be actual credentialed certs, not tutorials).
    projects: [
      {
        name: { type: String, required: true },
        techStack: [String],
        description: String,
        link: String,      // URL to GitHub / demo / blog post
        highlights: [String],
        startDate: String,
        endDate: String,
      },
    ],
    languages: [
      {
        name: String,
        level: String,
      },
    ],
    certifications: [
      {
        name: { type: String, required: true },
        issuer: String,
        date: String,
        // Optional detail — rendered under the certification headline in the
        // PDF. Useful for bootcamps / RNCP credentials where you want to
        // enumerate the modules covered.
        description: String,
        // Explicit typology so a recruiter never confuses a state-recognized
        // RNCP title (La Capsule) with a training-provider completion
        // certificate (Jedha AI Essentials).
        //   'rncp'       → state-registered credential; rncpLevel populated
        //   'completion' → training provider certificate, no state registration
        //   'other'      → anything else (default)
        type: {
          type: String,
          enum: ['rncp', 'completion', 'other'],
          default: 'other',
        },
        rncpLevel: Number, // 5/6/7/... only meaningful when type='rncp'
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('CvData', cvDataSchema);
