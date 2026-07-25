# 🛡️ SYSTEME DE SURVEILLANCE DES LOGS DE SECURITE

## 🎯 OBJECTIF

Surveiller en temps réel les évènements de sécurité, détecter les attaques, et bannir automatiquement les IPs suspectes.

---

## 📂 COMPOSANTS

### 1. `scripts/security-logger.js` - Analyseur de logs

**Fonction** : Analyser et exporter les logs de sécurité

**Commandes** :
```bash
# Analyser les logs récents
node scripts/security-logger.js analyze

# Exporter les alertes en JSON
node scripts/security-logger.js export security-alerts.json

# Bannir manuellement une IP
node scripts/security-logger.js block <ip> <hours>

# Vérifier si une IP est bannie
node scripts/security-logger.js check <ip>
```

### 2. `server/middleware/securityMiddleware.js` - Protection en production

**Fonction** : Intercepter toutes les requêtes et appliquer les règles de sécurité

**Fonctionnalités** :
- Bloquer les IPs sur blacklist automatiquement
- Détecter les patterns d'attaque (injection, brute-force)
- Auto-bannir les IPs > 5 tentatives/heure
- Logging structuré JSON

### 3. `logs/` - Répertoire de stockage

**Fichiers** :
- `security.log` - Logs bruts non compressés
- `security-YYYY-MM-DD.log.gz` - Logs archivés (rotation automatique)
- `blocked_ips.txt` - Liste des IPs bloquées
- `security-alerts.json` - Export récent des alertes

**Politique de conservation** : 90 jours (suppression automatique des anciens)

---

## ⚙️ CONFIGURATION

### Variables d'environnement (optionnelles)

```bash
# .env
SECURITY_LOG_DIR=./logs
SECURITY_RETENTION_DAYS=90
MAX_LOG_SIZE_MB=50
AUTO_BLOCK_THRESHOLD=5
AUTO_BLOCK_DURATION_HOURS=24
```

### Intégration dans `app.js`

Ajouter au début du fichier :```javascript
const { securityMiddleware } = require('./middleware/securityMiddleware');
app.use(securityMiddleware);
```

### Activer le logging complet

```javascript
// server/middleware/securityMiddleware.js
module.exports = {
  securityMiddleware,
  loadBlockedIPs,
  autoBlockIP,
  writeLog,
  createLogEntry,
  generateReport
};
```

---

## 📊 MONITORING

### Tableaux de bord recommandés

#### 1. Dashboard temps réel (CLI)
```bash
# Voir le rapport de sécurité actuel
node scripts/security-logger.js analyze

# Sortie exemple :
# ============================================================
# SECURITY LOG ANALYSIS REPORT
# Generated: 2026-07-25T00:30:15.123Z
# ============================================================
# 
# Total events tracked: 15423
# 
# --- SEVERITY BREAKDOWN ---
# HIGH:    127 events
# MEDIUM:  2341 events
# LOW:     13055 events
# 
# --- TOP OFFENDING IPS ---
# 192.168.1.100: 45 attempts
# 10.0.0.55: 32 attempts
# ...```

#### 2. Webhook Slack/Discord (optionnel)

```javascript
// scripts/notify-alerts.js
const { webp } = require('node-fetch');

function sendAlertToSlack(alert) {
  fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `\ud83d\udea8 *Security Alert*\nIP: ${alert.ip}\nType: ${alert.type}\nTime: ${alert.timestamp}\nMessage: ${alert.message}`
    }),
    headers: { 'Content-Type': 'application/json' }
  });
}

// À appeler dans securityMiddleware.js quand severity === 'HIGH'
```

#### 3. Alertes email (optionnel)

```javascript
// scripts/notify-by-email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function sendSecurityEmailReport(alerts) {
  transporter.sendMail({
    from: 'security@gcn-data.fr',
    to: 'ops@gcn-data.fr',
    subject: `Security Alert: ${alerts.length} high-severity events`,
    html: `<ul>${alerts.map(a => `<li>${a.ip}: ${a.message}</li>`).join('')}</ul>`
  });
}
```

---

## 🔄 CYCLE DE VIE DES LOGS

### 1. Collecte (temps réel)

Toutes les requêtes sont inspectées par `securityMiddleware`.

Patterns surveillés :
- `loginFailed` - Échecs d'authentification
- `tokenInvalid` - JWT expiré/invalid
- `rateLimit` - Hit de limite de rate-limiting
- `injection` - Tentative d'injection SQL/XSS
- `blockedIP` - IP sur blacklist

### 2. Stockage (rotation automatique)

- **Fichier actif** : `logs/security.log` (max 50MB)
- **Rotation** : Quand > 50MB, compression gzip
- **Ancien** : `logs/security-YYYY-MM-DD.log.gz`
- **Période** : Conservation 90 jours, suppression automatique

### 3. Analyse (quotidienne)

```bash
# Planifier l'analyse automatique (cron)
0 2 * * * node scripts/security-logger.js analyze >> logs/analysis.log 2>&1

# Export automatique des alertes
0 3 * * * node scripts/security-logger.js export >> logs/exports.log 2>&1
```

### 4. Archivage (mensuel)

```bash
# Script mensuel d'archivage (script/migrate-archives.sh)
# - Compresser tous les logs de l'année en `archives/2026.zip`
# - Uploader vers AWS S3 bucket `gcn-backups/security-logs/`
# - Supprimer version locale après vérification
```

---

## 📋 EXEMPLE D'UTILISATION

### 1. Démarrage

```bash
# Déployer le code avec le securityMiddleware
git commit -m "security: add securityMiddleware"
git push origin main
fly deploy

# Vérifier que les logs sont créés
fly logs --tail=50 | grep -i "security"
```

### 2. Surveillance active

```bash
# Voir les top 10 IPs bloquées
node scripts/security-logger.js analyze | grep -A 20 "TOP OFFENDING"

# Exporter les dernières 24h d'alertes
node scripts/security-logger.js export
```

### 3. Réaction à une attaque

```bash
# IP 192.168.1.100 tente une attaque brute-force

# Bannir automatiquement (déjà fait par securityMiddleware)
# Vérifier le bannissement
node scripts/security-logger.js check 192.168.1.100

# Vérifier dans les logs de sécurité
fly logs --since 1h | grep "192.168.1.100"

# Si nécessaire, augmenter le bannissement à 7 jours
node scripts/security-logger.js block 192.168.1.100 168
```

---

## 📝 DOCUMENTATION COMPLÉMENTAIRE

| Fichier | Description | Emplacement |
|---------|-------------|-------------|
| `security-logger.js` | Analyseur de logs CLI | `./scripts/` |
| `securityMiddleware.js` | Middleware protection | `./server/middleware/` |
| `SECURITY/jwt-rotation-procedure.md` | Rotation automatique JWT | `./SECURITY/` |
| `SECURITY/security-checklist.md` | Checklist sécurité mensuelle | `./SECURITY/` |
| `AUDIT_SUMMARY.md` | Audit complet siteWeb | `./` |

---

*Mise à jour: 25 juillet 2026*  
*Système de surveillance activé par défaut dans production*