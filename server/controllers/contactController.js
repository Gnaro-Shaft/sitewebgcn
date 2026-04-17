const { sendContactEmail } = require('../services/EmailService');
const asyncHandler = require('../middleware/asyncHandler');

// POST /api/contact
exports.sendContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  const result = await sendContactEmail({ name, email, subject, message });

  res.json({
    success: true,
    message: 'Message sent successfully',
    previewUrl: process.env.NODE_ENV !== 'production' ? result.previewUrl : undefined,
  });
});
