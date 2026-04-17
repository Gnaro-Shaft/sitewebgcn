const path = require('path');
const fs = require('fs/promises');
const CvData = require('../models/CvData');
const { generateCV } = require('../services/PDFGenerator');
const asyncHandler = require('../middleware/asyncHandler');

// Date de bascule : 4 aout 2026
const SWITCH_DATE = new Date('2026-08-04T00:00:00');

const CV_FILES = {
  technicien: {
    path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_Technicien_IT_2025.pdf'),
    filename: 'CV_Genaro_Nisus_Technicien_IT.pdf',
  },
  ia: {
    path: path.join(__dirname, '../public/cv/CV_Genaro_Nisus_Data_IA_2025.pdf'),
    filename: 'CV_Genaro_Nisus_Data_IA.pdf',
  },
};

// GET /api/cv/download — public, serves the right CV based on date
exports.downloadCV = asyncHandler(async (req, res) => {
  const now = new Date();
  const cv = now < SWITCH_DATE ? CV_FILES.technicien : CV_FILES.ia;

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
