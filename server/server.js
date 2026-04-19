require('dotenv').config({ override: true });
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { connectBotDB } = require('./config/botDb');
const errorHandler = require('./middleware/errorHandler');

// Connect to MongoDB (both clusters)
connectDB();
connectBotDB();

const app = express();

// Trust Fly.io proxy (for correct X-Forwarded-For handling)
app.set('trust proxy', 1);

// Middleware — Security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://api.coingecko.com",
          "https://api.github.com",
          "https://github-contributions-api.jogruber.de",
          "https://api.hyperliquid.xyz",
        ],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS — restrict to known origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://gcn-data.fr',
  'https://www.gcn-data.fr',
  'https://gcn-backend-api.fly.dev',
  'http://localhost:5173',
  'http://localhost:5001',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting — global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300, // 300 requests per 15 min
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Rate limiting — auth (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // 10 login attempts per 15 min
  message: { success: false, error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting — contact (anti-spam)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 messages per hour
  message: { success: false, error: 'Too many messages sent, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/contact', contactLimiter, require('./routes/contact'));
app.use('/api/cv', require('./routes/cv'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/trading', require('./routes/trading'));
app.use('/api/github', require('./routes/github'));
app.use('/api/ai', require('./routes/ai'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // All non-API routes → React app (SPA fallback)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
