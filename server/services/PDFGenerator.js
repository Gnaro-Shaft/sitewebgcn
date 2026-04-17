const PDFDocument = require('pdfkit');

const COLORS = {
  primary: '#1a1a2e',
  accent: '#0f3460',
  text: '#333333',
  light: '#666666',
  line: '#cccccc',
};

function generateCV(cvData) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

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
  drawLine(doc);

  // --- Summary ---
  if (cvData.summary) {
    sectionTitle(doc, 'PROFILE');
    doc.fontSize(10).fillColor(COLORS.text).text(cvData.summary);
    doc.moveDown(0.5);
  }

  // --- Experience ---
  if (cvData.experience?.length) {
    sectionTitle(doc, 'EXPERIENCE');
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

  // --- Education ---
  if (cvData.education?.length) {
    sectionTitle(doc, 'EDUCATION');
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
    sectionTitle(doc, 'SKILLS');
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
    sectionTitle(doc, 'LANGUAGES');
    const langLine = cvData.languages.map((l) => `${l.name} (${l.level})`).join('  |  ');
    doc.fontSize(10).fillColor(COLORS.text).text(langLine);
    doc.moveDown(0.4);
  }

  // --- Certifications ---
  if (cvData.certifications?.length) {
    sectionTitle(doc, 'CERTIFICATIONS');
    for (const cert of cvData.certifications) {
      doc
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(cert.name, { continued: true })
        .fillColor(COLORS.light)
        .text(`  — ${cert.issuer || ''}${cert.date ? `, ${cert.date}` : ''}`);
    }
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function sectionTitle(doc, title) {
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor(COLORS.accent).text(title);
  drawLine(doc);
  doc.moveDown(0.2);
}

function drawLine(doc) {
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(0.3);
}

module.exports = { generateCV };
