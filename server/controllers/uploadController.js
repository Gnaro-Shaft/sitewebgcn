const asyncHandler = require('../middleware/asyncHandler');
// Namespace import (not destructured) so vi.spyOn(cloudinaryConfig, 'uploadBuffer')
// in tests actually intercepts — destructuring captures the reference at load time.
const cloudinaryConfig = require('../config/cloudinary');

// POST /api/upload/image — protected. Receives a single file as multipart
// field "image", streams it to Cloudinary, returns { url, publicId }.
// Multer middleware ran first, so by here req.file is a Buffer in memory
// with a safe mime type and size ≤ 5 MB.
exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'NO_FILE' });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return res
      .status(503)
      .json({ success: false, error: 'UPLOAD_NOT_CONFIGURED' });
  }

  try {
    const { url, publicId } = await cloudinaryConfig.uploadBuffer(req.file.buffer, {
      folder: req.body.folder || 'projects',
    });
    res.json({ success: true, data: { url, publicId } });
  } catch (err) {
    // Log full Cloudinary error to Fly logs so we can see why it failed
    // (the response only carries the short message; the SDK often attaches
    // a more useful `error.http_code` + nested `error.error.message`).
    console.error('[upload] Cloudinary upload failed:', {
      message: err.message,
      http_code: err.http_code,
      name: err.name,
      cloudinary_error: err.error,
    });
    res
      .status(502)
      .json({ success: false, error: 'CLOUDINARY_FAILED', detail: err.message });
  }
});
