#!/usr/bin/env node
// health-check.js - Monitoring de santé de production
// Exécution recommandée: toutes les 5 minutes via cron ou systemd

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'https://gcn-backend-api.fly.dev';
const LOG_FILE = path.join(__dirname, 'logs/health-check.log');
const ALERT_THRESHOLD = 3; // Nombre d'échecs avant alerte
const ALERT_EMAIL = 'ops@gcn-data.fr';

// Colors
const GREEN = '\u2713';
const RED = '\u2717';
const YELLOW = '\u26a0';
const BLUE = '\u26aa';

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  
  if (!fs.existsSync(LOG_FILE)) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  }
  
  fs.appendFileSync(LOG_FILE, logLine);
  
  if (level === 'ERROR') {
    console.error(`${RED} ${message}`);
  } else if (level === 'WARNING') {
    console.warn(`${YELLOW} ${message}`);
  } else if (level === 'SUCCESS') {
    console.log(`${GREEN} ${message}`);
  } else {
    console.log(`${BLUE} ${message}`);
  }
}

function checkAPI() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    https.get(`${API_URL}/api/health`, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const json = JSON.parse(data);
          if (json.success && responseTime < 2000) {
            resolve({ 
              success: true, 
              statusCode: res.statusCode,
              responseTime,
              message: json.message
            });
          } else {
            reject(new Error(`API returned non-success: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    }).on('error', (err) => {
      const responseTime = Date.now() - startTime;
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}

function checkDockerImage() {
  try {
    const output = execSync(`fly status --app gcn-backend-api --json 2>/dev/null`, { encoding: 'utf-8' });
    const status = JSON.parse(output);
    
    const machines = status.machines.filter(m => m.state === 'started');
    if (machines.length === 0) {
      throw new Error('No running machines found');
    }
    
    return {
      success: true,
      runningMachines: machines.length,
      regions: [...new Set(machines.map(m => m.region))]
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

function getDiskUsage() {
  try {
    const output = execSync('df -h / 2>/dev/null || df -h .', { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const usageLine = lines[1];
    
    const parts = usageLine.split(/\s+/);
    const usage = parseInt(parts[4]);
    
    return {
      success: true,
      usage,
      available: parts[3]
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

function sendAlert(message, severity = 'ERROR') {
  const alertData = {
    timestamp: new Date().toISOString(),
    severity,
    message,
    checkType: 'health-check',
    url: API_URL
  };
  
  const alertFile = path.join(__dirname, 'logs/alerts.json');
  const alerts = fs.existsSync(alertFile) ? 
    JSON.parse(fs.readFileSync(alertFile, 'utf-8')) : [];
  
  alerts.push(alertData);
  
  // Garder uniquement les 100 dernières alertes
  if (alerts.length > 100) {
    alerts.splice(0, alerts.length - 100);
  }
  
  fs.writeFileSync(alertFile, JSON.stringify(alerts, null, 2));
  
  // Note: Implémenter votre système d'alerte ici (Slack webhook, email, PagerDuty...)
  // Exemple pour Slack:
  /*
  if (process.env.SLACK_WEBHOOK_URL) {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `\ud83d\udea8 *ALERT* ${severity}: ${message}`,
        username: 'Health Monitor'
      })
    });
  }
  */
  
  log(`Alert sent: ${message}`, severity);
}

async function runHealthCheck() {
  log(`Starting health check...`);
  
  const checks = {
    api: null,
    docker: null,
    disk: null,
    failures: 0
  };
  
  // Check 1: API Health
  try {
    const apiResult = await checkAPI();
    checks.api = apiResult;
    log(`API: OK (${apiResult.responseTime}ms)`, 'SUCCESS');
  } catch (err) {
    checks.api = { error: err.message };
    log(`API: FAILED - ${err.message}`, 'ERROR');
    sendAlert(`API unreachable: ${err.message}`, 'CRITICAL');
  }
  
  // Check 2: Docker/Machine status
  try {
    const dockerResult = checkDockerImage();
    checks.docker = dockerResult;
    if (dockerResult.success) {
      log(`Docker: ${dockerResult.runningMachines} machine(s) running in ${dockerResult.regions.join(', ')}`, 'SUCCESS');
    } else {
      log(`Docker: FAILED - ${dockerResult.error}`, 'ERROR');
      sendAlert(`Docker status error: ${dockerResult.error}`, 'WARNING');
    }
  } catch (err) {
    checks.docker = { error: err.message };
    log(`Docker: ERROR - ${err.message}`, 'ERROR');
  }
  
  // Check 3: Disk usage
  try {
    const diskResult = getDiskUsage();
    checks.disk = diskResult;
    if (diskResult.success && diskResult.usage < 80) {
      log(`Disk: OK (${diskResult.usage}% used, ${diskResult.available} available)`, 'SUCCESS');
    } else if (diskResult.success && diskResult.usage >= 80) {
      log(`Disk: WARNING (${diskResult.usage}% used)`, 'WARNING');
      sendAlert(`Disk usage high: ${diskResult.usage}%`, 'WARNING');
    } else {
      log(`Disk: ERROR - ${diskResult.error || 'unknown'}`, 'ERROR');
    }
  } catch (err) {
    checks.disk = { error: err.message };
    log(`Disk: ERROR - ${err.message}`, 'ERROR');
  }
  
  // Log summary
  log('\n' + '='.repeat(60));
  log('HEALTH CHECK SUMMARY');
  log('='.repeat(60));
  log(`API: ${checks.api ? 'OK' : 'FAILED'}`);
  log(`Docker: ${checks.docker && checks.docker.success ? 'OK' : 'FAILED'}`);
  log(`Disk: ${checks.disk && checks.disk.success ? 'OK' : 'FAILED'}`);
  log('='.repeat(60));
  
  // Export report
  const report = {
    timestamp: new Date().toISOString(),
    checks,
    allPassed: checks.api && checks.api.success && 
                checks.docker && checks.docker.success && 
                checks.disk && checks.disk.success && 
                checks.disk.usage < 80
  };
  
  const reportFile = path.join(__dirname, 'logs/health-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  if (!report.allPassed) {
    log('\n\u26a0\ufe0f  ONE OR MORE CHECKS FAILED - Review required!', 'ERROR');
    process.exit(1);
  }
  
  log('\n\u2705 All checks passed - System healthy!', 'SUCCESS');
  process.exit(0);
}

// Run
runHealthCheck().catch(err => {
  log(`Health check failed: ${err.message}`, 'ERROR');
  process.exit(1);
});
