const cloudinary = require('cloudinary').v2;

// SDK reads CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET from process.env
// at call time, so this works even if the env vars are set after require.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Stream a buffer (from multer memoryStorage) to Cloudinary.
// Returns { url, publicId } — the URL is the optimized delivery URL with
// f_auto/q_auto/w_800 transformations baked in, so the frontend gets a
// WebP/AVIF resized to max 800px wide without any further work.
function uploadBuffer(buffer, { folder = 'projects', publicId } = {}) {
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
