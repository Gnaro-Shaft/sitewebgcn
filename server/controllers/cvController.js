const path = require('path');
const fs = require('fs/promises');
const CvData = require('../models/CvData');
const { generateCV } = require('../services/PDFGenerator');
const asyncHandler = require('../middleware/asyncHandler');

// Single CV variant now that the portfolio is fully repositioned as
// AI Engineer (Phase 23). The Technicien IT variant + SWITCH_DATE
// bascule logic was removed — it's dead code after the pivot.
const CV_FILES = {
  fr: {
    path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_IA_ML_2025.pdf'),
    filename: 'CV_Genaro_Nisus_IA_ML.pdf',
  },
  en: {
    path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_AI_ML_2025_EN.pdf'),
    filename: 'CV_Genaro_Nisus_AI_ML_EN.pdf',
  },
};

// Normalize any incoming lang value to 'fr' or 'en'. Accepts variants
// like 'EN', 'en-US', 'fr-FR' — anything not clearly English falls back
// to French, which matches the site's default locale.
function normalizeLang(raw) {
  if (typeof raw !== 'string') return 'fr';
  const short = raw.toLowerCase().slice(0, 2);
  return short === 'en' ? 'en' : 'fr';
}

// Resolve the CV to serve for the requested language, falling back to
// the FR file if the requested EN file isn't on disk. Rationale: the EN
// PDF might not be uploaded yet — better to serve FR with a clean filename
// than to 404. Frontend is unaware of this fallback.
async function resolveCvFile(lang) {
  const primary = CV_FILES[lang];
  try {
    await fs.access(primary.path);
    return primary;
  } catch {
    // Fallback to FR if EN isn't on disk. If FR is missing too, return
    // primary anyway so caller 404s cleanly downstream.
    if (lang === 'en') {
      try {
        await fs.access(CV_FILES.fr.path);
        return CV_FILES.fr;
      } catch {
        return primary;
      }
    }
    return primary;
  }
}

// GET /api/cv/download — public, serves the right CV for ?lang=fr|en
exports.downloadCV = asyncHandler(async (req, res) => {
  const lang = normalizeLang(req.query.lang);
  const cv = await resolveCvFile(lang);

  try {
    await fs.access(cv.path);
  } catch {
    return res.status(404).json({ success: false, error: 'CV file not found' });
  }

  const pdfBuffer = await fs.readFile(cv.path);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${cv.filename}"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

// Exposed for potential unit tests — pure functions, no DB/network.
exports._normalizeLang = normalizeLang;

// GET /api/cv/data — admin, get raw CV data
exports.getCvData = asyncHandler(async (req, res) => {
  const cvData = await CvData.findOne().sort({ updatedAt: -1 });

  if (!cvData) {
    return res.status(404).json({ success: false, error: 'CV data not found' });
  }

  res.json({ success: true, data: cvData });
});

// PUT /api/cv/data — admin, create or update CV data (upsert)
exports.upsertCvData = asyncHandler(async (req, res) => {
  let cvData = await CvData.findOne().sort({ updatedAt: -1 });

  if (cvData) {
    Object.assign(cvData, req.body);
    await cvData.save();
  } else {
    cvData = await CvData.create(req.body);
  }

  res.json({ success: true, data: cvData });
});
