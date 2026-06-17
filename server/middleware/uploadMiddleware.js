const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

// File stays in memory as a Buffer — no disk writes on Fly machines.
// fileFilter rejects bad mime types BEFORE the body is streamed, so an
// attacker can't burn bandwidth uploading 5 MB of garbage.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('INVALID_MIME'));
    }
    cb(null, true);
  },
}).single('image');

// Wrap multer to translate its raw errors into clean JSON responses
// with stable error codes the frontend can show as i18n keys.
function uploadImageMiddleware(req, res, next) {
  uploadImage(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'TOO_LARGE' });
    }
    if (err.message === 'INVALID_MIME') {
      return res.status(415).json({ success: false, error: 'INVALID_TYPE' });
    }
    return res.status(400).json({ success: false, error: 'UPLOAD_FAILED' });
  });
}

module.exports = { uploadImageMiddleware, MAX_BYTES, ALLOWED_MIME };
