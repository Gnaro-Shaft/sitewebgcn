#!/usr/bin/env node
// validate-security.js - Script de validation des modifications de sécurité

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const checks = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition, message, fix = null) {
  checks.push({ name, condition, message, fix });
  if (condition) {
    console.log('\u2705 ' + name);
    passed++;
  } else {
    console.log('\u274c ' + name);
    console.log('   ' + message);
    if (fix) console.log('   Fix: ' + fix);
    failed++;
  }
}

function warn(name, message) {
  console.log('\u26a0\ufe0f ' + name);
  console.log('   ' + message);
  warnings++;
}

console.log('\n' + '='.repeat(60));
console.log('SECURITY VALIDATION CHECKS');
console.log('Generated:', new Date().toISOString());
console.log('='.repeat(60));

// 1. Verify core security files exist
check(
  'securityMiddleware exists',
  fs.existsSync(path.join(ROOT, 'server/middleware/securityMiddleware.js')),
  'File not found. Run: git pull origin main'
);

check(
  'security-logger.js exists',
  fs.existsSync(path.join(ROOT, 'scripts/security-logger.js')),
  'File not found. Run: git pull origin main'
);

check(
  'SECURITY folder exists',
  fs.existsSync(path.join(ROOT, 'SECURITY')),
  'Folder not found. Expected documentation missing.'
);

check(
  'logs directory exists',
  fs.existsSync(path.join(ROOT, 'logs')),
  'Create with: mkdir -p logs && chmod 755 logs'
);

check(
  'blocked_ips.txt exists in logs',
  fs.existsSync(path.join(ROOT, 'logs', 'blocked_ips.txt')),
  'Create with: touch logs/blocked_ips.txt'
);

// 2. Verify app.js integrates securityMiddleware
const appJs = fs.readFileSync(path.join(ROOT, 'server/app.js'), 'utf-8');

check(
  'securityMiddleware imported in app.js',
  appJs.indexOf('securityMiddleware') !== -1,
  'Add: const securityMiddleware = require(\'./middleware/securityMiddleware\').securityMiddleware'
);

check(
  'securityMiddleware applied in app.js',
  appJs.indexOf('app.use(securityMiddleware)') !== -1,
  'Add: app.use(securityMiddleware) after express.json()'
);

// Verify scriptSrc does NOT contain 'unsafe-inline' (but styleSrc CAN contain it)
const scriptSrcMatch = appJs.match(/scriptSrc:\s*\[([^\]]+)\]/);
if (scriptSrcMatch) {
  const scriptSrcContent = scriptSrcMatch[1];
  const hasUnsafeInScriptSrc = scriptSrcContent.indexOf('unsafe-inline') !== -1;
  
  check(
    'CSP scriptSrc hardened (no unsafe-inline)',
    !hasUnsafeInScriptSrc,
    'Remove unsafe-inline from scriptSrc directive in Helmet config'
  );
} else {
  check(
    'CSP scriptSrc configuration found',
    false,
    'scriptSrc directive not found in Helmet config'
  );
}

// 3. Verify auth.js security
const authJs = fs.readFileSync(path.join(ROOT, 'server/middleware/auth.js'), 'utf-8');

check(
  'loginAuth middleware exists',
  authJs.indexOf('loginAuth') !== -1 || authJs.indexOf('loginLimiter') !== -1,
  'Create loginLimiter.js or update auth.js to use loginAuth'
);

// 4. Verify package.json dependencies
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

check(
  'express-rate-limit installed',
  packageJson.dependencies && packageJson.dependencies['express-rate-limit'],
  'Install: npm install express-rate-limit'
);

check(
  'helmet installed',
  packageJson.dependencies && packageJson.dependencies.helmet,
  'Install: npm install helmet'
);

// 5. Verify CI/CD
const ciYml = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf-8');

check(
  'GitHub Actions CI exists',
  ciYml.indexOf('test:') !== -1 && ciYml.indexOf('npm run test') !== -1,
  'Create .github/workflows/ci.yml with test job'
);

check(
  'Snyk security scan configured',
  ciYml.indexOf('snyk') !== -1 || ciYml.indexOf('Snyk') !== -1,
  'Add Snyk action to CI workflow'
);

// 6. Check logs configuration
const logsDir = path.join(ROOT, 'logs');
if (fs.existsSync(logsDir)) {
  const files = fs.readdirSync(logsDir);
  
  if (files.filter(function(f) { return f.endsWith('.log.gz'); }).length > 0) {
    warn(
      'Log rotation active',
      files.filter(function(f) { return f.endsWith('.log.gz'); }).length + ' archived logs found'
    );
  } else {
    warn(
      'No archived logs yet',
      'Expected after log rotation (90-day retention)'
    );
  }
  
  if (fs.existsSync(path.join(logsDir, 'blocked_ips.txt'))) {
    const blockedContent = fs.readFileSync(path.join(logsDir, 'blocked_ips.txt'), 'utf-8');
    const blockedIPs = blockedContent.split('\n').filter(function(l) { return l.trim(); }).length;
    
    if (blockedIPs > 0) {
      console.log('\ud83d\udd12 ' + blockedIPs + ' IPs currently blocked');
    } else {
      console.log('\u2705 No IPs currently blocked');
    }
  }
} else {
  console.log('\u26a0\ufe0f logs directory not found - will be created on first request');
}

// 7. Check package-lock.json versioned
check(
  'package-lock.json exists',
  fs.existsSync(path.join(ROOT, 'package-lock.json')),
  'Run: npm install to generate'
);

check(
  'client/package-lock.json exists',
  fs.existsSync(path.join(ROOT, 'client/package-lock.json')),
  'Run: cd client && npm install'
);

// 8. Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log('Passed:  ' + passed + ' checks');
console.log('Failed:  ' + failed + ' checks');
console.log('Warnings: ' + warnings + ' warnings');
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n\u274c ' + failed + ' security checks failed. Please fix before deploying to production.');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\u26a0\ufe0f ' + warnings + ' warnings. Please review before deploying.');
  process.exit(0);
} else {
  console.log('\u2705 All security checks passed! Ready for production.');
  process.exit(0);
}
