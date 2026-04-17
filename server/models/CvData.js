const mongoose = require('mongoose');

const cvDataSchema = new mongoose.Schema(
  {
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
    languages: [
      {
        name: String,
        level: String,
      },
    ],
    certifications: [
      {
        name: String,
        issuer: String,
        date: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('CvData', cvDataSchema);
