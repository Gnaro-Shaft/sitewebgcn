// security-middleware.js - Middleware de protection sécurité général
const rateLimit = require('express-rate-limit');
const { createLogEntry, writeLog, analyzeLog, generateReport } = require('../scripts/security-logger');
const path = require('path');
const fs = require('fs');

// Configuration
const BLOCK_FILE = path.join(__dirname, '../logs/blocked_ips.txt');

// Charge la liste des IPs bloquées
function loadBlockedIPs() {
  if (!fs.existsSync(BLOCK_FILE)) {
    fs.writeFileSync(BLOCK_FILE, '');
    return [];
  }
  
  const content = fs.readFileSync(BLOCK_FILE, 'utf-8');
  const blockedIPs = [];
  content.split('\n').forEach(line => {
    const match = line.trim().match(/^([\d.]+).*AUTO_BLOCK/);
    if (match) {
      blockedIPs.push(match[1]);
    }
  });
  
  return blockedIPs;
}

// Middleware principal de sécurité
const securityMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const blockedIPs = loadBlockedIPs();
  
  // Vérifier si IP est bloquée
  if (blockedIPs.includes(ip)) {
    const entry = createLogEntry(ip, 'blockedIP', `IP ${ip} bloquée automatiquement`);
    writeLog(entry);
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied - IP temporarily blocked',
      retryAfter: 86400 // 24h
    });
  }
  
  // Log de sécurité pour toutes les requêtes
  const logData = {
    ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString()
  };
  
  // Surveillance des patterns de sécurité
  const patterns = {
    loginFailed: /login.*failed|authentication.*failed/i,
    tokenInvalid: /token.*invalid|jwt.*expired/i,
    rateLimit: /429|rate.*limit|too.*many/i,
    injection: /<script>|javascript:|%3Cscript/i,
  };
  
  let securityEvent = null;
  
  // Vérifier patterns de sécurité
  if (patterns.loginFailed.test(req.originalUrl)) {
    securityEvent = 'loginFailed';
  } else if (patterns.tokenInvalid.test(req.get('Authorization') || '')) {
    securityEvent = 'tokenInvalid';
  } else if (patterns.injection.test(req.originalUrl)) {
    securityEvent = 'injection';
  }
  
  if (securityEvent) {
    const entry = createLogEntry(ip, securityEvent, `Suspicious activity detected: ${req.originalUrl}`);
    writeLog(entry);
    
    // Auto-bannir si trop d'échecs (5 tentatives/heure)
    const hourlyLog = fs.readFileSync(path.join(__dirname, '../logs/security.log'), 'utf-8');
    const hourlyEvents = hourlyLog.split('\n').filter(line => {
      try {
        const logEntry = JSON.parse(line);
        return logEntry.ip === ip && 
               logEntry.type === securityEvent &&
               new Date(logEntry.timestamp) > new Date(Date.now() - 3600000);
      } catch (e) {
        return false;
      }
    }).length;
    
    if (hourlyEvents >= 5) {
      autoBlockIP(ip, 24); // Bloquer 24h
    }
  }
  
  next();
};

// Auto-bannir une IP
function autoBlockIP(ip, durationHours = 24) {
  const expiry = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  const line = `${ip} ${expiry.toISOString()} AUTO_BLOCK\n`;
  fs.appendFileSync(BLOCK_FILE, line);
  console.log(`[Security] Auto-blocked IP ${ip} until ${expiry.toISOString()}`);
}

module.exports = {
  securityMiddleware,
  loadBlockedIPs,
  autoBlockIP,
  writeLog,
  createLogEntry,
  generateReport
};
