const cloudinary = require('cloudinary').v2;

// Stream a buffer (from multer memoryStorage) to Cloudinary.
// Returns { url, publicId } — the URL is the optimized delivery URL with
// f_auto/q_auto/w_800 transformations baked in, so the frontend gets a
// WebP/AVIF resized to max 800px wide without any further work.
function uploadBuffer(buffer, { folder = 'projects', publicId } = {}) {
  // Re-apply config on every call so env vars set after module load
  // (e.g. Fly secrets, late dotenv) are picked up. Cheap, idempotent.
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          { width: 800, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
