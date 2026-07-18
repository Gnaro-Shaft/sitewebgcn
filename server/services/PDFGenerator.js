const PDFDocument = require('pdfkit');

// Phase 25: theme-aware + lang-aware PDF generation.
// Two color palettes (light/dark) and two label sets (fr/en).

const LIGHT_COLORS = {
  primary: '#1a1a2e',   // headings + name
  accent: '#0f3460',    // section titles + company/school
  text: '#333333',      // body text
  light: '#666666',     // dates + subtle details
  line: '#cccccc',      // separator
  background: null,     // no background fill for light — white paper
};

const DARK_COLORS = {
  primary: '#e8ebf0',   // headings + name — near white
  accent: '#00ff88',    // section titles — neon green matches site accent
  text: '#c9d1d9',      // body text — muted white
  light: '#8b949e',     // dates + subtle
  line: '#30363d',      // separator — dark subtle
  background: '#0d1117', // dark bg fill
};

// Section titles per language. If lang is unknown, falls back to English.
const SECTION_LABELS = {
  fr: {
    profile: 'PROFIL',
    experience: 'EXPÉRIENCE',
    education: 'FORMATION',
    projects: 'PROJETS PERSONNELS',
    skills: 'COMPÉTENCES',
    languages: 'LANGUES',
    certifications: 'CERTIFICATIONS',
  },
  en: {
    profile: 'PROFILE',
    experience: 'EXPERIENCE',
    education: 'EDUCATION',
    projects: 'PERSONAL PROJECTS',
    skills: 'SKILLS',
    languages: 'LANGUAGES',
    certifications: 'CERTIFICATIONS',
  },
};

// Badge shown ABOVE the certification headline to distinguish types at a
// glance. Renders in the accent color for RNCP (state-recognized weight),
// muted for a completion certificate (accurate but not overclaimed).
const CERT_TYPE_LABELS = {
  fr: {
    rncp: (level) => (level ? `Titre RNCP Niveau ${level}` : 'Titre RNCP'),
    completion: () => 'Certificat de complétion',
    other: () => null,
  },
  en: {
    rncp: (level) => (level ? `RNCP-registered Level ${level}` : 'RNCP-registered'),
    completion: () => 'Completion certificate',
    other: () => null,
  },
};

// Generate a PDF from a CvData document. Returns a Promise<Buffer>.
// Options: { theme: 'light'|'dark' (default light), lang: 'fr'|'en' (default en) }
function generateCV(cvData, { theme = 'light', lang = 'en' } = {}) {
  const COLORS = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const LABELS = SECTION_LABELS[lang] || SECTION_LABELS.en;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // Paint dark background over the whole first page BEFORE anything else.
  // pdfkit doesn't have a native "page background" — we draw a filled rect
  // covering the media box, then restore drawing state.
  if (COLORS.background) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.background);
    // Also register a pageAdded handler so subsequent pages get the fill
    doc.on('pageAdded', () => {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.background);
    });
  }

  // --- Header ---
  doc
    .fontSize(24)
    .fillColor(COLORS.primary)
    .text(cvData.fullName, { align: 'center' });

  doc
    .fontSize(12)
    .fillColor(COLORS.accent)
    .text(cvData.title, { align: 'center' });

  doc.moveDown(0.3);

  // Contact line
  const contactParts = [
    cvData.email,
    cvData.phone,
    cvData.location,
    cvData.website,
    cvData.github,
    cvData.linkedin,
  ].filter(Boolean);

  if (contactParts.length) {
    doc
      .fontSize(9)
      .fillColor(COLORS.light)
      .text(contactParts.join('  |  '), { align: 'center' });
  }

  doc.moveDown(0.5);
  drawLine(doc, COLORS);

  // --- Summary ---
  if (cvData.summary) {
    sectionTitle(doc, LABELS.profile, COLORS);
    doc.fontSize(10).fillColor(COLORS.text).text(cvData.summary);
    doc.moveDown(0.5);
  }

  // --- Experience ---
  if (cvData.experience?.length) {
    sectionTitle(doc, LABELS.experience, COLORS);
    for (const exp of cvData.experience) {
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
      doc.fontSize(11).fillColor(COLORS.primary).text(exp.role, { continued: true });
      doc.fontSize(10).fillColor(COLORS.light).text(`  ${dates}`, { align: 'right' });
      doc.fontSize(10).fillColor(COLORS.accent).text(exp.company + (exp.location ? ` — ${exp.location}` : ''));

      if (exp.description) {
        doc.fontSize(9).fillColor(COLORS.text).text(exp.description);
      }
      if (exp.highlights?.length) {
        for (const h of exp.highlights) {
          doc.fontSize(9).fillColor(COLORS.text).text(`  •  ${h}`, { indent: 10 });
        }
      }
      doc.moveDown(0.4);
    }
  }

  // --- Projects ---
  // Placed right after Experience: projects reinforce the AI Engineer
  // credibility — the recruiter reads job history, then immediately sees
  // the personal work that proves technical depth.
  if (cvData.projects?.length) {
    sectionTitle(doc, LABELS.projects, COLORS);
    for (const proj of cvData.projects) {
      const dates = [proj.startDate, proj.endDate].filter(Boolean).join(' - ');
      doc.fontSize(11).fillColor(COLORS.primary).text(proj.name, { continued: true });
      if (dates) doc.fontSize(10).fillColor(COLORS.light).text(`  ${dates}`, { align: 'right' });
      else doc.text('');
      if (proj.techStack?.length) {
        doc.fontSize(9).fillColor(COLORS.accent).text(proj.techStack.join(' · '));
      }
      if (proj.description) {
        doc.fontSize(9).fillColor(COLORS.text).text(proj.description);
      }
      if (proj.highlights?.length) {
        for (const h of proj.highlights) {
          doc.fontSize(9).fillColor(COLORS.text).text(`  •  ${h}`, { indent: 10 });
        }
      }
      if (proj.link) {
        doc.fontSize(9).fillColor(COLORS.light).text(proj.link);
      }
      doc.moveDown(0.4);
    }
  }

  // --- Education ---
  if (cvData.education?.length) {
    sectionTitle(doc, LABELS.education, COLORS);
    for (const edu of cvData.education) {
      const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
      doc.fontSize(11).fillColor(COLORS.primary).text(edu.degree, { continued: true });
      doc.fontSize(10).fillColor(COLORS.light).text(`  ${dates}`, { align: 'right' });
      doc.fontSize(10).fillColor(COLORS.accent).text(edu.school + (edu.location ? ` — ${edu.location}` : ''));
      if (edu.description) {
        doc.fontSize(9).fillColor(COLORS.text).text(edu.description);
      }
      doc.moveDown(0.4);
    }
  }

  // --- Skills ---
  if (cvData.skills?.length) {
    sectionTitle(doc, LABELS.skills, COLORS);
    for (const skill of cvData.skills) {
      doc
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(`${skill.category}: `, { continued: true })
        .fillColor(COLORS.text)
        .text(skill.items?.join(', ') || '');
    }
    doc.moveDown(0.4);
  }

  // --- Languages ---
  if (cvData.languages?.length) {
    sectionTitle(doc, LABELS.languages, COLORS);
    const langLine = cvData.languages.map((l) => `${l.name} (${l.level})`).join('  |  ');
    doc.fontSize(10).fillColor(COLORS.text).text(langLine);
    doc.moveDown(0.4);
  }

  // --- Certifications ---
  if (cvData.certifications?.length) {
    sectionTitle(doc, LABELS.certifications, COLORS);
    const typeLabels = CERT_TYPE_LABELS[lang] || CERT_TYPE_LABELS.en;
    for (const cert of cvData.certifications) {
      // Render the type badge above the headline — RNCP in accent to signal
      // the higher weight, completion in muted to signal accurate but lesser
      // credential. 'other' (or absent) → no badge, keeping the layout clean.
      const type = cert.type || 'other';
      const badgeFn = typeLabels[type] || typeLabels.other;
      const badgeText = badgeFn(cert.rncpLevel);
      if (badgeText) {
        const badgeColor = type === 'rncp' ? COLORS.accent : COLORS.light;
        doc.fontSize(8).fillColor(badgeColor).text(badgeText.toUpperCase());
      }
      doc
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(cert.name, { continued: true })
        .fillColor(COLORS.light)
        .text(`  — ${cert.issuer || ''}${cert.date ? `, ${cert.date}` : ''}`);
      if (cert.description) {
        doc.fontSize(9).fillColor(COLORS.text).text(cert.description);
      }
      doc.moveDown(0.3);
    }
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function sectionTitle(doc, title, COLORS) {
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor(COLORS.accent).text(title);
  drawLine(doc, COLORS);
  doc.moveDown(0.2);
}

function drawLine(doc, COLORS) {
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(0.3);
}

module.exports = {
  generateCV,
  LIGHT_COLORS,
  DARK_COLORS,
  SECTION_LABELS,
  CERT_TYPE_LABELS,
};
