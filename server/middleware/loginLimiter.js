const rateLimit = require('express-rate-limit');

// En test, la suite d'intégration enchaîne des dizaines d'inscriptions et de
// connexions : le limiteur renvoyait 429, le jeton devenait `undefined`, et
// les requêtes suivantes échouaient en 401. Les autres limiteurs de l'app sont
// déjà neutralisés de la même façon.
const passthrough = (req, res, next) => next();

const realLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  skipSuccessfulRequests: false, // compter même les réussites
  message: { success: false, error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes',
      retryAfter: 900
    });
  }
});

module.exports = process.env.NODE_ENV === 'test' ? passthrough : realLimiter;
