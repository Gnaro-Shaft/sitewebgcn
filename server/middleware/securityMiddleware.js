// security-middleware.js - Middleware de protection sécurité général
const { createLogEntry, writeLog, generateReport } = require('../../scripts/security-logger');
const path = require('path');
const fs = require('fs');

// Un seul dossier de logs pour tout le module : la racine du dépôt.
// Avant, BLOCK_FILE pointait sur server/logs/ et la lecture du journal sur
// logs/ — deux dossiers différents, dont un que seul le Dockerfile créait.
// Résultat : ça marchait en prod et cassait après un clone frais.
const LOG_DIR = path.join(__dirname, '../../logs');
const BLOCK_FILE = path.join(LOG_DIR, 'blocked_ips.txt');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');

function ensureLogDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* dossier déjà présent ou disque en lecture seule — on n'échoue pas pour ça */
  }
}

// Cache mémoire de la liste d'IP bloquées.
// Sans lui, chaque requête HTTP déclenchait un readFileSync — de l'I/O disque
// synchrone dans le chemin critique de toutes les réponses.
let blockedCache = { at: 0, ips: [] };
const CACHE_TTL_MS = 30_000;

// Charge la liste des IPs bloquées, en ignorant celles dont le blocage a expiré.
// Le fichier stocke « <ip> <expiry ISO> AUTO_BLOCK » ; l'expiration était
// écrite mais jamais relue, donc les blocages étaient de fait permanents.
function loadBlockedIPs({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - blockedCache.at < CACHE_TTL_MS) {
    return blockedCache.ips;
  }

  let content = '';
  try {
    content = fs.readFileSync(BLOCK_FILE, 'utf-8');
  } catch {
    // Fichier absent : personne n'est bloqué. On ne le crée pas ici — c'est
    // le rôle de autoBlockIP, et écrire depuis une lecture est un piège.
    blockedCache = { at: now, ips: [] };
    return [];
  }

  const ips = [];
  for (const line of content.split('\n')) {
    const match = line.trim().match(/^([\d.a-fA-F:]+)\s+(\S+)\s+AUTO_BLOCK/);
    if (!match) continue;
    const [, ip, expiry] = match;
    const expiresAt = Date.parse(expiry);
    // Blocage encore valide, ou date illisible (on préfère bloquer)
    if (Number.isNaN(expiresAt) || expiresAt > now) ips.push(ip);
  }

  blockedCache = { at: now, ips };
  return ips;
}

// Compte les événements d'un type donné pour une IP sur la dernière heure.
// Lire tout le journal à chaque événement suspect coûte cher quand le fichier
// grossit — on ne lit que la fin.
function countRecentEvents(ip, type) {
  let content = '';
  try {
    content = fs.readFileSync(SECURITY_LOG, 'utf-8');
  } catch {
    return 0;
  }
  const since = Date.now() - 3600_000;
  const lines = content.split('\n');
  const tail = lines.slice(-2000); // borne haute, suffisant pour une heure
  let n = 0;
  for (const line of tail) {
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e.ip === ip && e.type === type && Date.parse(e.timestamp) > since) n++;
    } catch {
      /* ligne corrompue ignorée */
    }
  }
  return n;
}

// Middleware principal de sécurité
const securityMiddleware = (req, res, next) => {
  // Désactivé en test : il écrit sur disque à chaque requête, ce qui rendait
  // toute la suite d'intégration rouge après un clone frais.
  if (process.env.NODE_ENV === 'test') return next();

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  if (loadBlockedIPs().includes(ip)) {
    writeLog(createLogEntry(ip, 'blockedIP', `IP ${ip} bloquée automatiquement`));
    return res.status(403).json({
      success: false,
      error: 'Access denied - IP temporarily blocked',
      retryAfter: 86400,
    });
  }

  // Surveillance des patterns de sécurité
  const patterns = {
    tokenInvalid: /token.*invalid|jwt.*expired/i,
    injection: /<script|javascript:|%3Cscript/i,
  };

  let securityEvent = null;
  if (patterns.tokenInvalid.test(req.get('Authorization') || '')) {
    securityEvent = 'tokenInvalid';
  } else if (patterns.injection.test(req.originalUrl)) {
    securityEvent = 'injection';
  }

  if (securityEvent) {
    writeLog(createLogEntry(ip, securityEvent, `Suspicious activity detected: ${req.originalUrl}`));
    if (countRecentEvents(ip, securityEvent) >= 5) {
      autoBlockIP(ip, 24);
    }
  }

  next();
};

// Auto-bannir une IP
function autoBlockIP(ip, durationHours = 24) {
  const expiry = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  ensureLogDir();
  try {
    fs.appendFileSync(BLOCK_FILE, `${ip} ${expiry.toISOString()} AUTO_BLOCK\n`);
    blockedCache.at = 0; // invalide le cache pour une prise en compte immédiate
    console.log(`[Security] Auto-blocked IP ${ip} until ${expiry.toISOString()}`);
  } catch (err) {
    console.error('[Security] Impossible d\'écrire le blocage:', err.message);
  }
}

module.exports = {
  securityMiddleware,
  loadBlockedIPs,
  autoBlockIP,
  writeLog,
  createLogEntry,
  generateReport,
  // exposés pour les tests
  _BLOCK_FILE: BLOCK_FILE,
  _LOG_DIR: LOG_DIR,
};
