const path = require('path');
const fs = require('fs/promises');
const CvData = require('../models/CvData');
const { generateCV } = require('../services/PDFGenerator');
const asyncHandler = require('../middleware/asyncHandler');

// Two-axis matrix: language × visual theme. The theme axis was added so
// visitors get a CV that matches whichever theme they're browsing in
// (Phase 23 addendum). Filenames handed to the recruiter are stripped of
// the _clair/_light/_dark suffixes — those are storage details, not
// something a hiring manager should see.
const CV_FILES = {
  fr: {
    light: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_IA_ML_2025_clair.pdf'),
      filename: 'CV_Genaro_Nisus_Ingenieur_IA_ML.pdf',
    },
    dark: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_IA_ML_2025.pdf'),
      filename: 'CV_Genaro_Nisus_Ingenieur_IA_ML.pdf',
    },
  },
  en: {
    light: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_AI_ML_2025_EN_light.pdf'),
      filename: 'CV_Genaro_Nisus_AI_ML_Engineer.pdf',
    },
    dark: {
      path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_AI_ML_2025_EN.pdf'),
      filename: 'CV_Genaro_Nisus_AI_ML_Engineer.pdf',
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

// Default theme is 'light'. Rationale: a raw link (no ?theme=) — shared
// on LinkedIn, sitting in an ATS, dropped in an email — hits the light
// version, which is the safer/more universal look for print + PDF readers
// that ignore embedded CSS. Anything not explicitly 'dark' → 'light'.
function normalizeTheme(raw) {
  if (typeof raw !== 'string') return 'light';
  return raw.toLowerCase() === 'dark' ? 'dark' : 'light';
}

// Resolve with two layers of fallback so we never 404 on a real request
// when at least one file exists:
//   1. Requested theme is missing on disk → same lang, light theme
//   2. Requested lang is missing entirely → FR light (final safety net)
// Returns null only if literally everything is missing — caller 404s.
async function resolveCvFile(lang, theme) {
  const primary = CV_FILES[lang]?.[theme];
  if (primary) {
    try { await fs.access(primary.path); return primary; } catch {}
  }
  if (theme !== 'light') {
    const lightFallback = CV_FILES[lang]?.light;
    if (lightFallback) {
      try { await fs.access(lightFallback.path); return lightFallback; } catch {}
    }
  }
  if (lang !== 'fr') {
    const frLight = CV_FILES.fr.light;
    try { await fs.access(frLight.path); return frLight; } catch {}
  }
  return null;
}

// GET /api/cv/download — public
// Query params (both optional):
//   ?lang=fr|en    default 'fr'
//   ?theme=light|dark  default 'light'
exports.downloadCV = asyncHandler(async (req, res) => {
  const lang = normalizeLang(req.query.lang);
  const theme = normalizeTheme(req.query.theme);

  const cv = await resolveCvFile(lang, theme);
  if (!cv) {
    return res.status(404).json({ success: false, error: 'CV file not found' });
  }

  // res.download() sets Content-Type: application/pdf (via extension) and
  // Content-Disposition: attachment; filename="…". The `filename` we pass
  // is the recruiter-facing name — no _clair/_light/_dark suffix leaks.
  res.download(cv.path, cv.filename);
});

// Exposed for potential unit tests — pure functions, no DB/network.
exports._normalizeLang = normalizeLang;
exports._normalizeTheme = normalizeTheme;

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
