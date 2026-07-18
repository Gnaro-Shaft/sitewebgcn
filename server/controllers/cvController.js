const path = require('path');
const fs = require('fs/promises');
const asyncHandler = require('../middleware/asyncHandler');

// Namespace imports so vi.spyOn in tests can intercept at runtime — learned
// this pattern the hard way in Phases 17, 19, 24 (destructured refs are
// captured at load time and mocks miss them).
const CvData = require('../models/CvData');
const PDFGenerator = require('../services/PDFGenerator');

// Static PDF fallback map — used only when no CvData is in Mongo for the
// requested lang. Filenames handed to the recruiter drop the internal
// _clair/_light/_dark suffixes.
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

function normalizeLang(raw) {
  if (typeof raw !== 'string') return 'fr';
  const short = raw.toLowerCase().slice(0, 2);
  return short === 'en' ? 'en' : 'fr';
}

function normalizeTheme(raw) {
  if (typeof raw !== 'string') return 'light';
  return raw.toLowerCase() === 'dark' ? 'dark' : 'light';
}

// Two-layer fallback across the static file matrix.
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

// Recruiter-facing filename per language (drops the internal suffixes).
function filenameFor(lang) {
  return lang === 'en'
    ? 'CV_Genaro_Nisus_AI_ML_Engineer.pdf'
    : 'CV_Genaro_Nisus_Ingenieur_IA_ML.pdf';
}

// GET /api/cv/download — public
// Query params (both optional):
//   ?lang=fr|en          default 'fr'
//   ?theme=light|dark    default 'light'
//
// Strategy:
//   1. Try dynamic generation from CvData in Mongo for this lang
//      → always-fresh CV, no static file to maintain
//   2. If no CvData for this lang → fall back to the static PDF matrix
//      → ensures the download endpoint never breaks during migration
exports.downloadCV = asyncHandler(async (req, res) => {
  const lang = normalizeLang(req.query.lang);
  const theme = normalizeTheme(req.query.theme);

  // Try dynamic path first
  const cvData = await CvData.findOne({ lang });
  if (cvData) {
    const pdfBuffer = await PDFGenerator.generateCV(cvData, { theme, lang });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameFor(lang)}"`,
      'Content-Length': pdfBuffer.length,
      // Cache-Control: no-store — the CV can change any time via admin UI,
      // so don't let CDNs or browsers cache a stale version.
      'Cache-Control': 'no-store',
    });
    return res.send(pdfBuffer);
  }

  // Fallback: static file matrix (previous behavior)
  const cv = await resolveCvFile(lang, theme);
  if (!cv) {
    return res.status(404).json({ success: false, error: 'CV file not found' });
  }
  res.download(cv.path, cv.filename);
});

exports._normalizeLang = normalizeLang;
exports._normalizeTheme = normalizeTheme;
exports._filenameFor = filenameFor;

// GET /api/cv/data?lang=fr — admin, get raw CV data for a language
exports.getCvData = asyncHandler(async (req, res) => {
  const lang = normalizeLang(req.query.lang);
  const cvData = await CvData.findOne({ lang });

  if (!cvData) {
    return res.status(404).json({ success: false, error: 'CV data not found', lang });
  }

  res.json({ success: true, data: cvData });
});

// PUT /api/cv/data?lang=fr — admin, upsert CV data for a language
exports.upsertCvData = asyncHandler(async (req, res) => {
  const lang = normalizeLang(req.query.lang);
  // Never let the client override the discriminating lang field.
  const payload = { ...(req.body || {}), lang };

  const cvData = await CvData.findOneAndUpdate(
    { lang },
    { $set: payload },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, data: cvData });
});
