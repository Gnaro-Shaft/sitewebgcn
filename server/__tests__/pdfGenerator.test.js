// Unit tests for PDFGenerator — asserts buffer generation succeeds and
// theme/lang params take effect. Doesn't validate visual output (that's
// a manual smoke test).

import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/botDb', () => ({ getBotConnection: () => null }));

const {
  generateCV,
  LIGHT_COLORS,
  DARK_COLORS,
  SECTION_LABELS,
} = require('../services/PDFGenerator');

const MINIMAL_CV = {
  fullName: 'Test User',
  title: 'Test Engineer',
  email: 'test@example.com',
  summary: 'A short summary paragraph.',
  experience: [
    {
      role: 'Test Role',
      company: 'Test Co',
      startDate: '2020',
      endDate: '2024',
      highlights: ['One bullet', 'Two bullet'],
    },
  ],
  education: [{ degree: 'Test Degree', school: 'Test School', endDate: '2019' }],
  skills: [{ category: 'Test', items: ['A', 'B', 'C'] }],
  languages: [{ name: 'English', level: 'Native' }],
  certifications: [{ name: 'Test Cert', issuer: 'Test Issuer', date: '2024' }],
};

describe('generateCV', () => {
  it('returns a non-empty PDF buffer with default options', async () => {
    const buf = await generateCV(MINIMAL_CV);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    // PDF file magic — first bytes are "%PDF"
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('works with an empty cv (no experience/education/skills)', async () => {
    const buf = await generateCV({ fullName: 'Empty', title: 'Nothing' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('accepts theme=dark without crashing', async () => {
    const buf = await generateCV(MINIMAL_CV, { theme: 'dark' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('produces different bytes for dark vs light theme', async () => {
    const light = await generateCV(MINIMAL_CV, { theme: 'light' });
    const dark = await generateCV(MINIMAL_CV, { theme: 'dark' });
    // Different colors baked into the stream → different byte lengths or content
    expect(light.equals(dark)).toBe(false);
  });

  it('produces different bytes for fr vs en lang (section titles differ)', async () => {
    const fr = await generateCV(MINIMAL_CV, { lang: 'fr' });
    const en = await generateCV(MINIMAL_CV, { lang: 'en' });
    expect(fr.equals(en)).toBe(false);
  });

  it('falls back to English labels for unknown lang', async () => {
    const bufUnknown = await generateCV(MINIMAL_CV, { lang: 'xx' });
    const bufEn = await generateCV(MINIMAL_CV, { lang: 'en' });
    // Both use the same label set → same output for same input
    expect(bufUnknown.length).toBe(bufEn.length);
  });
});

describe('projects section', () => {
  it('renders projects (produces different bytes vs same CV without projects)', async () => {
    const withProjects = await generateCV({
      ...MINIMAL_CV,
      projects: [
        {
          name: 'Test Project',
          techStack: ['Python', 'FastAPI'],
          description: 'A test project.',
          highlights: ['One highlight'],
          startDate: '2024',
          endDate: 'present',
        },
      ],
    });
    const withoutProjects = await generateCV(MINIMAL_CV);
    // The projects section adds real content — buffers must differ
    expect(withProjects.equals(withoutProjects)).toBe(false);
    expect(withProjects.length).toBeGreaterThan(withoutProjects.length);
  });

  it('does not render an empty certifications section title', async () => {
    // With certifications=[] the section header should not appear alone
    const withEmptyCerts = await generateCV({ ...MINIMAL_CV, certifications: [] });
    const withoutCertsField = await generateCV({
      ...MINIMAL_CV,
      certifications: undefined,
    });
    // Both should produce PDFs of similar structure (empty array behaves like undefined)
    expect(Math.abs(withEmptyCerts.length - withoutCertsField.length)).toBeLessThan(100);
  });
});

describe('certification type badges', () => {
  it('renders different bytes for rncp vs completion vs other', async () => {
    const withRncp = await generateCV({
      ...MINIMAL_CV,
      certifications: [{ name: 'C', issuer: 'I', date: 'D', type: 'rncp', rncpLevel: 6 }],
    });
    const withCompletion = await generateCV({
      ...MINIMAL_CV,
      certifications: [{ name: 'C', issuer: 'I', date: 'D', type: 'completion' }],
    });
    const withOther = await generateCV({
      ...MINIMAL_CV,
      certifications: [{ name: 'C', issuer: 'I', date: 'D', type: 'other' }],
    });
    expect(withRncp.equals(withCompletion)).toBe(false);
    expect(withRncp.equals(withOther)).toBe(false);
    expect(withCompletion.equals(withOther)).toBe(false);
  });

  it('accepts undefined type (defaults to no badge, same as other)', async () => {
    const noType = await generateCV({
      ...MINIMAL_CV,
      certifications: [{ name: 'C', issuer: 'I', date: 'D' }],
    });
    const other = await generateCV({
      ...MINIMAL_CV,
      certifications: [{ name: 'C', issuer: 'I', date: 'D', type: 'other' }],
    });
    // Both should render without a badge. Byte-identical comparison is
    // impossible because pdfkit embeds a per-call CreationDate — instead
    // we assert the sizes are within a small tolerance, meaning the
    // badge line was NOT added in either case.
    expect(Math.abs(noType.length - other.length)).toBeLessThan(50);
    // And both should be smaller than a version with an actual badge
    const withBadge = await generateCV({
      ...MINIMAL_CV,
      certifications: [{ name: 'C', issuer: 'I', date: 'D', type: 'rncp', rncpLevel: 6 }],
    });
    expect(withBadge.length).toBeGreaterThan(noType.length);
  });
});

describe('exported palettes and labels', () => {
  it('LIGHT_COLORS and DARK_COLORS have the required keys', () => {
    for (const palette of [LIGHT_COLORS, DARK_COLORS]) {
      expect(palette.primary).toBeDefined();
      expect(palette.accent).toBeDefined();
      expect(palette.text).toBeDefined();
      expect(palette.light).toBeDefined();
      expect(palette.line).toBeDefined();
    }
  });

  it('DARK_COLORS has a background fill, LIGHT_COLORS does not', () => {
    expect(DARK_COLORS.background).toBeTruthy();
    expect(LIGHT_COLORS.background).toBeNull();
  });

  it('SECTION_LABELS has fr + en with same keys including projects', () => {
    const frKeys = Object.keys(SECTION_LABELS.fr).sort();
    const enKeys = Object.keys(SECTION_LABELS.en).sort();
    expect(frKeys).toEqual(enKeys);
    // Projects section must exist in both languages
    expect(SECTION_LABELS.fr.projects).toBeDefined();
    expect(SECTION_LABELS.en.projects).toBeDefined();
    // Sanity: labels are non-empty strings
    for (const key of frKeys) {
      expect(SECTION_LABELS.fr[key]).toMatch(/[A-ZÀ-Ÿ]/);
      expect(SECTION_LABELS.en[key]).toMatch(/[A-Z]/);
    }
  });
});
