const path = require('path');
const fs = require('fs/promises');
const CvData = require('../models/CvData');
const { generateCV } = require('../services/PDFGenerator');
const asyncHandler = require('../middleware/asyncHandler');

// Date de bascule : 4 aout 2026
const SWITCH_DATE = new Date('2026-08-04T00:00:00');

const CV_FILES = {
  technicien: {
    fr: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_Technicien_IT_2025.pdf'),
      filename: 'CV_Genaro_Nisus_Technicien_IT.pdf',
    },
    en: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_Technicien_IT_2025_EN.pdf'),
      filename: 'CV_Genaro_Nisus_Technicien_IT_EN.pdf',
    },
  },
  ia: {
    fr: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_Data_IA_2025.pdf'),
      filename: 'CV_Genaro_Nisus_Data_IA.pdf',
    },
    en: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_Data_IA_2025_EN.pdf'),
      filename: 'CV_Genaro_Nisus_Data_IA_EN.pdf',
    },
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

// Resolve the CV variant to serve, with an automatic fallback to FR if
// the requested EN file isn't on disk. Rationale: the EN CV may not be
// generated yet — better to serve the FR version with the correct filename
// than to 404. Frontend is unaware of this fallback.
async function resolveCvFile(variant, lang) {
  const primary = variant[lang];
  try {
    await fs.access(primary.path);
    return primary;
  } catch {
    // Fallback to FR if EN isn't on disk. If we're already on FR and it's
    // missing too, return primary anyway so caller 404s cleanly downstream.
    if (lang === 'en') {
      try {
        await fs.access(variant.fr.path);
        return variant.fr;
      } catch {
        return primary;
      }
    }
    return primary;
  }
}

// GET /api/cv/download — public, serves the right CV based on date + ?lang
exports.downloadCV = asyncHandler(async (req, res) => {
  const now = new Date();
  const variant = now < SWITCH_DATE ? CV_FILES.technicien : CV_FILES.ia;
  const lang = normalizeLang(req.query.lang);

  const cv = await resolveCvFile(variant, lang);

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
