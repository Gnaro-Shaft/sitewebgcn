const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: errors.array().map((e) => e.msg).join(', '),
    });
  }
  next();
};

// Contact form validation
const validateContact = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('subject').optional().trim().isLength({ max: 200 }).withMessage('Subject too long'),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 }).withMessage('Message too long (max 5000 chars)'),
  handleValidation,
];

// Auth login validation
const validateLogin = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
];

// Auth register validation
const validateRegister = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidation,
];

// Project validation
const validateProject = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('githubUrl').optional().trim().isURL().withMessage('Invalid GitHub URL'),
  body('liveUrl').optional().trim().isURL().withMessage('Invalid live URL'),
  body('stack').optional().isArray().withMessage('Stack must be an array'),
  handleValidation,
];

// Article validation
const validateArticle = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 300 }),
  body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 50000 }),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  handleValidation,
];

module.exports = {
  validateContact,
  validateLogin,
  validateRegister,
  validateProject,
  validateArticle,
};
