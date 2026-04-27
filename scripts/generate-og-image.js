// Generate the OG image (1200x630) for social previews
// Run with: node scripts/generate-og-image.js
const sharp = require('sharp');
const path = require('path');

const W = 1200;
const H = 630;
const ACCENT = '#00ff88';
const BG = '#0a0a0a';
const TEXT = '#e8e8e8';
const MUTED = '#888888';

// SVG composition with the GCN branding
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.15" />
      <stop offset="60%" stop-color="${ACCENT}" stop-opacity="0.04" />
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${ACCENT}" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Dark background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Subtle grid overlay -->
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <!-- Glow behind logo -->
  <circle cx="${W/2}" cy="${H/2 - 40}" r="280" fill="url(#glow)"/>

  <!-- Decorative Matrix-like vertical lines (left + right) -->
  <g opacity="0.25" font-family="monospace" font-size="14" fill="${ACCENT}">
    <text x="60"   y="80">01</text>
    <text x="60"   y="160">10</text>
    <text x="60"   y="240">11</text>
    <text x="60"   y="320">00</text>
    <text x="60"   y="400">01</text>
    <text x="60"   y="480">10</text>
    <text x="60"   y="560">11</text>

    <text x="${W-90}" y="80">11</text>
    <text x="${W-90}" y="160">00</text>
    <text x="${W-90}" y="240">10</text>
    <text x="${W-90}" y="320">01</text>
    <text x="${W-90}" y="400">11</text>
    <text x="${W-90}" y="480">00</text>
    <text x="${W-90}" y="560">10</text>
  </g>

  <!-- Main logo: GCN: with cursor -->
  <text x="${W/2}" y="${H/2 - 20}"
        font-family="'Press Start 2P', 'Courier New', monospace"
        font-size="120"
        font-weight="900"
        fill="${ACCENT}"
        text-anchor="middle"
        style="filter: drop-shadow(0 0 30px ${ACCENT}80);">GCN<tspan fill="#ff3333">:</tspan><tspan fill="${ACCENT}">_</tspan></text>

  <!-- Name -->
  <text x="${W/2}" y="${H/2 + 70}"
        font-family="-apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="36"
        font-weight="700"
        fill="${TEXT}"
        text-anchor="middle">Genaro-Cedric NISUS</text>

  <!-- Tagline -->
  <text x="${W/2}" y="${H/2 + 120}"
        font-family="-apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="22"
        font-weight="500"
        fill="${ACCENT}"
        text-anchor="middle">Developpeur Fullstack &amp; Ingenieur IA</text>

  <!-- Bottom bar -->
  <line x1="60" y1="${H-60}" x2="${W-60}" y2="${H-60}" stroke="${ACCENT}" stroke-opacity="0.3" stroke-width="2"/>

  <!-- Domain bottom-left -->
  <text x="60" y="${H-30}"
        font-family="-apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="16"
        font-weight="600"
        fill="${ACCENT}">gcn-data.fr</text>

  <!-- Tags bottom-right -->
  <text x="${W-60}" y="${H-30}"
        font-family="monospace"
        font-size="14"
        fill="${MUTED}"
        text-anchor="end">React · Node · MongoDB · Claude AI</text>
</svg>`;

const outputPath = path.join(__dirname, '..', 'client', 'public', 'og-image.png');

sharp(Buffer.from(svg))
  .png({ quality: 95, compressionLevel: 9 })
  .toFile(outputPath)
  .then((info) => {
    console.log(`✓ OG image generated: ${outputPath}`);
    console.log(`  Size: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(1)} KB`);
  })
  .catch((err) => {
    console.error('Failed to generate OG image:', err);
    process.exit(1);
  });
