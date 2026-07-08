// Express app factory — pure config, no DB connection, no listen().
// server.js wires connectDB() + .listen(), integration tests just import app.
//
// In tests, NODE_ENV is already set to 'test' by the setup helper. dotenv
// with override: true would clobber that with whatever's in .env
// (typically 'development'), so we skip dotenv entirely in that case.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ override: true });
}
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const IS_TEST = process.env.NODE_ENV === 'test';

const app = express();

// Trust Fly.io proxy (for correct X-Forwarded-For handling)
app.set('trust proxy', 1);

// Compression (gzip / deflate / brotli)
app.use(compression({ level: 6, threshold: 1024 }));

// Helmet + strict CSP
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
        // Autorise les Object URLs (URL.createObjectURL) dans les <video> :
        // requis pour la preview de la vidéo dans /admin/tiktok.
        mediaSrc: ["'self'", "blob:"],
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
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Logging — silent in tests to keep CI output clean
if (!IS_TEST) {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use(express.json({ limit: '10mb' }));

// --- Rate limiters: disabled in tests to avoid 429 noise on rapid request bursts.
// In prod they enforce the real limits we documented.
function makeLimiter(opts) {
  return IS_TEST ? (req, res, next) => next() : rateLimit(opts);
}

const globalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many messages sent, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Dynamic sitemap + RSS (must be before SPA fallback)
app.get('/sitemap.xml', require('./controllers/sitemapController').getSitemap);
app.get('/rss.xml', require('./controllers/rssController').getRssFeed);

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
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/lighthouse', require('./routes/lighthouse'));
app.use('/api/tiktok', require('./routes/tiktok'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/bot', require('./routes/bot'));
app.use('/api/social', require('./routes/social'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');

  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  app.use('/images', express.static(path.join(distPath, 'images'), {
    maxAge: '30d',
  }));

  app.use(express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    },
  }));

  // SPA fallback for non-API routes
  app.get(/^(?!\/api).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
