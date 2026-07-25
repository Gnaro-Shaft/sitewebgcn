#!/usr/bin/env node
// security-logger.js - Analyse des logs de sécurité en temps réel
// Utilisation: node security-logger.js

const fs = require('fs');
const path = require('path');

// Configuration
const LOG_DIR = path.join(__dirname, '../logs');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');
const RETENTION_DAYS = 90;
const MAX_LOG_SIZE_MB = 50;

// Patterns de sécurité à surveiller
const PATTERNS = {
  loginFailed: /login.*failed|authentication.*failed/i,
  tokenInvalid: /token.*invalid|jwt.*expired|jwt.*invalid/i,
  rateLimit: /429|rate.*limit|too.*many.*requests/i,
  unauthorized: /401|unauthorized|not.*authorized/i,
  forbidden: /403|forbidden|access.*denied/i,
  bruteForce: /brute.*force|login.*attempts|repeated.*login/i,
  injection: /sql.*injection|script.*xss|<script>|javascript:/i,
  ipBlacklisted: /blacklisted|banned|blocked.*ip/i,
  adminAction: /admin.*action|privileged.*access|role.*change/i,
  dataExport: /data.*export|download.*all|bulk.*export/i,
};

// Statistics tracking
let stats = {
  totalEvents: 0,
  byType: {},
  byIP: {},
  byHour: {},
  topViolators: [],
};

// Log entry structure
function createLogEntry(ip, type, message, details = {}) {
  return {
    timestamp: new Date().toISOString(),
    ip,
    type,
    message,
    details,
    severity: getSeverity(type)
  };
}

function getSeverity(type) {
  const highSeverity = ['bruteForce', 'injection', 'blacklisted'];
  const mediumSeverity = ['loginFailed', 'tokenInvalid', 'unauthorized'];
  const lowSeverity = ['rateLimit', 'forbidden'];
  
  if (highSeverity.some(p => type.includes(p))) return 'HIGH';
  if (mediumSeverity.some(p => type.includes(p))) return 'MEDIUM';
  return 'LOW';
}

function writeLog(entry) {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  
  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(SECURITY_LOG, logLine);
  
  // Rotate log if too large
  rotateLogIfNecessary();
}

function rotateLogIfNecessary() {
  const logStats = fs.statSync(SECURITY_LOG);
  const logSizeMB = logStats.size / (1024 * 1024);
  
  if (logSizeMB > MAX_LOG_SIZE_MB) {
    const backupName = `security-${new Date().toISOString().split('T')[0]}.log.gz`;
    const { execSync } = require('child_process');
    execSync(`gzip -c ${SECURITY_LOG} > ${LOG_DIR}/${backupName}`);
    fs.writeFileSync(SECURITY_LOG, '');
    console.log(`Rotated log to ${backupName}`);
  }
  
  // Clean old logs (keep 90 days)
  const oldFiles = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.gz'))
    .map(f => {
      const dateStr = f.match(/security-(\d{4}-\d{2}-\d{2})\.gz/)?.[1];
      return { file: f, date: dateStr };
    })
    .filter(f => f.date)
    .filter(f => {
      const fileDate = new Date(f.date);
      const daysOld = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysOld > RETENTION_DAYS;
    });
  
  oldFiles.forEach(f => {
    fs.unlinkSync(path.join(LOG_DIR, f.file));
    console.log(`Deleted old log: ${f.file}`);
  });
}

function analyzeLog(filename = SECURITY_LOG) {
  if (!fs.existsSync(filename)) {
    return { error: 'Security log file not found' };
  }
  
  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);
  
  const entries = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return { raw: line, error: 'Invalid JSON' };
    }
  });
  
  // Calculate statistics
  const results = {
    total: entries.length,
    bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    byType: {},
    topIPs: [],
    recentAlerts: [],
    recommendations: []
  };
  
  entries.forEach(entry => {
    if (entry.raw) return; // Skip invalid entries
    
    if (entry.severity) {
      results.bySeverity[entry.severity] = (results.bySeverity[entry.severity] || 0) + 1;
    }
    
    if (entry.type) {
      results.byType[entry.type] = (results.byType[entry.type] || 0) + 1;
    }
    
    if (entry.ip) {
      results.topIPs.push(entry.ip);
    }
    
    if (entry.severity === 'HIGH') {
      results.recentAlerts.push(entry);
    }
  });
  
  // Find top offending IPs
  const ipCounts = {};
  results.topIPs.forEach(ip => {
    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
  });
  
  results.topViolators = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, attempts: count }));
  
  // Generate recommendations
  if (results.recentAlerts.length > 5) {
    results.recommendations.push('Activer le bannissement automatique des IPs suspectes');
  }
  
  if (results.byType['loginFailed'] > 100) {
    results.recommendations.push('Vérifier si les emails de notification sont configurés pour les tentatives de connexion');
  }
  
  if (results.recentAlerts.length > 0) {
    results.recommendations.push('Inspecter les alertes récentes dans le dashboard admin');
  }
  
  return results;
}

function generateReport() {
  const report = analyzeLog();
  
  console.log('\n' + '='.repeat(60));
  console.log('SECURITY LOG ANALYSIS REPORT');
  console.log('Generated:', new Date().toISOString());
  console.log('='.repeat(60));
  
  console.log(`\nTotal events tracked: ${report.total}`);
  
  if (report.error) {
    console.log(`\nError: ${report.error}`);
    return;
  }
  
  console.log(`\n--- SEVERITY BREAKDOWN ---`);
  console.log(`HIGH:    ${report.bySeverity.HIGH} events`);
  console.log(`MEDIUM:  ${report.bySeverity.MEDIUM} events`);
  console.log(`LOW:     ${report.bySeverity.LOW} events`);
  
  if (Object.keys(report.byType).length > 0) {
    console.log(`\n--- EVENT TYPES ---`);
    Object.entries(report.byType).forEach(([type, count]) => {
      console.log(`${type}: ${count} events`);
    });
  }
  
  if (results.topViolators.length > 0) {
    console.log(`\n--- TOP OFFENDING IPS ---`);
    results.topViolators.slice(0, 5).forEach(({ ip, attempts }) => {
      console.log(`${ip}: ${attempts} attempts`);
    });
  }
  
  if (results.recentAlerts.length > 0) {
    console.log(`\n--- RECENT HIGH SEVERITY ALERTS ---`);
    results.recentAlerts.slice(0, 3).forEach(({ timestamp, ip, message }) => {
      console.log(`[${timestamp}] ${ip}: ${message}`);
    });
  }
  
  if (results.recommendations.length > 0) {
    console.log(`\n--- RECOMMENDATIONS ---`);
    results.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  return report;
}

function exportAlerts(outputFile = 'security-alerts.json') {
  const report = analyzeLog();
  const alerts = report.recentAlerts;
  
  const exportData = {
    generated: new Date().toISOString(),
    summary: {
      totalAlerts: alerts.length,
      highSeverity: report.bySeverity.HIGH,
      topViolators: results.topViolators.slice(0, 10)
    },
    alerts: alerts
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
  console.log(`\nExported ${alerts.length} alerts to ${outputFile}`);
  
  return exportData;
}

function autoBlockIP(ip, durationHours = 24) {
  const blockFile = path.join(LOG_DIR, 'blocked_ips.txt');
  const now = new Date();
  const expiry = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  
  const blockEntry = `${ip} ${expiry.toISOString()} AUTO_BLOCK\n`;
  fs.appendFileSync(blockFile, blockEntry);
  
  console.log(`Auto-blocked IP ${ip} until ${expiry.toISOString()}`);
  
  return true;
}

function checkBlockList(ip) {
  const blockFile = path.join(LOG_DIR, 'blocked_ips.txt');
  if (!fs.existsSync(blockFile)) {
    return false;
  }
  
  const lines = fs.readFileSync(blockFile, 'utf-8').split('\n');
  return lines.some(line => line.startsWith(ip));
}

// CLI entry point
const args = process.argv.slice(2);

if (args[0] === 'analyze') {
  generateReport();
} else if (args[0] === 'export') {
  exportAlerts(args[1] || 'security-alerts.json');
} else if (args[0] === 'block' && args[1]) {
  autoBlockIP(args[1], parseInt(args[2]) || 24);
} else if (args[0] === 'check' && args[1]) {
  const blocked = checkBlockList(args[1]);
  console.log(`IP ${args[1]} ${blocked ? 'BLOCKED' : 'not blocked'}`);
} else {
  console.log('Security Logger - Usage:');
  console.log('  node security-logger.js analyze      # Analyze logs');
  console.log('  node security-logger.js export [file] # Export alerts to JSON');
  console.log('  node security-logger.js block <ip>   # Manually block IP');
  console.log('  node security-logger.js check <ip>   # Check if IP is blocked');
  console.log('\nLog file is automatically rotated and cleaned (90-day retention)');
}
