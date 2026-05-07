// Optimize all PNG images in client/public/images to WebP + smaller dimensions
// Run with: node scripts/optimize-images.js
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'client', 'public', 'images');
const MAX_WIDTH = 1280; // max dimension for any image
const QUALITY = 82; // WebP quality (0-100, 80-85 = sweet spot)

async function optimizeImage(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  const base = filename.slice(0, -ext.length);

  if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
    return { filename, skipped: 'not-image' };
  }

  const stats = await fs.stat(filePath);
  const sizeBefore = stats.size;

  const webpPath = path.join(path.dirname(filePath), `${base}.webp`);

  // Read metadata to know if we need to resize
  const meta = await sharp(filePath).metadata();
  let pipeline = sharp(filePath);

  if (meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  await pipeline
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(webpPath);

  const newStats = await fs.stat(webpPath);
  const sizeAfter = newStats.size;
  const savings = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);

  return {
    filename,
    output: `${base}.webp`,
    sizeBefore: (sizeBefore / 1024).toFixed(1) + ' KB',
    sizeAfter: (sizeAfter / 1024).toFixed(1) + ' KB',
    savings: savings + '%',
    dimensions: `${meta.width}x${meta.height}`,
  };
}

(async () => {
  const files = await fs.readdir(SOURCE_DIR);
  console.log(`Found ${files.length} files in ${SOURCE_DIR}\n`);

  const results = [];
  for (const file of files) {
    const fullPath = path.join(SOURCE_DIR, file);
    try {
      const r = await optimizeImage(fullPath);
      results.push(r);
    } catch (err) {
      results.push({ filename: file, error: err.message });
    }
  }

  console.log('Results:');
  console.table(results);
})();
