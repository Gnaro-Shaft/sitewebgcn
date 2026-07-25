# 🚀 DÉPLOIEMENT SÉCURITÉ - GUIDE RAPIDE

## ✅ MODIFICATIONS APPLIQUÉES

| Fichier | Action | Description |
|---------|--------|-------------|
| `scripts/security-logger.js` | Créé | Analyseur CLI de logs sécurité |
| `server/middleware/securityMiddleware.js` | Créé | Middleware protection temps réel |
| `server/app.js` | Modifié | Intégration securityMiddleware |
| `SECURITY/` | Dossier | Docs complètes sécurité |
| `docs/SECURITY_MONITORING.md` | Créé | Documentation systême surveillance |

---

## 🔧 INSTALLATION (5 minutes)

### 1. Déployer le code

```bash
# Récupérer le code mis à jour
git clone https://github.com/Gnaro-Shaft/siteWeb.git
cd siteWeb

# Installer les dépendances
npm ci

# Vérifier que tout fonctionne
npm test

# Déployer sur Fly.io
fly deploy
```

### 2. Configurer les droits de fichier

```bash
# Créer le répertoire logs et lui donner les permissions
mkdir -p logs
chmod 755 logs

# Sur Fly.io (le répertoire logs créé automatiquement au démarrage)
```

### 3. Activer le logging de sécurité

Le `securityMiddleware` est déjà intégré dans `app.js`. Rien à faire.

### 4. Vérifier le fonctionnement

```bash
# Voir les logs en temps réel
fly logs --tail=50

# Analyser les événements récents
node scripts/security-logger.js analyze

# Exporter les alertes
node scripts/security-logger.js export security-alerts.json
```

---

## 📊 MONITORING (après déploiement)

### Commandes CLI quotidiennes

```bash
# Voir le rapport de sécurité actuel
node scripts/security-logger.js analyze

# Résultat attendu :
# SECURITY LOG ANALYSIS REPORT
# Generated: 2026-07-25T...
# Total events tracked: 15423
# HIGH:    127 events
# MEDIUM:  2341 events
# LOW:     13055 events
```

### Commandes hebdomadaires

```bash
# Exporter les dernières 24h d'alertes
node scripts/security-logger.js export

# Vérifier les IPs bloquées
cat logs/blocked_ips.txt

# Archiver les logs de la semaine
node scripts/security-logger.js export weekly-report.json
```

### Commandes mensuelles

```bash
# Audit complet de sécurité
npm run test:all
npm audit

# Générer un rapport complet
curl -X POST https://gcn-backend-api.fly.dev/api/audit/security-report
```

---

## 🔒 SCÉNARIOS D'URGENCE

### Attaque brute-force détectée

```bash
# Vérifier les IPs suspectes
cat logs/blocked_ips.txt | head -20

# Bannir manuellement une IP (si nécessaire)
node scripts/security-logger.js block 192.168.1.100 168

# Vérifier que l'IP est bien bloquée
node scripts/security-logger.js check 192.168.1.100
```

### Fuite de données suspectée

```bash
# Inspecter les logs
fly logs --since 1h | grep -i "data.*export"

# Analyser les tentatives d'accès
cat logs/security.log | grep -i "admin.*action"

# Débloquer une IP bloquée par erreur (suppression du bannissement)
sed -i '/^192.168.1.100/d' logs/blocked_ips.txt

# Recharger le serveur
fly ssh console --stage staging
# kill -HUP $(pgrep node)
```

### Attaque DDoS en cours

```bash
# Augmenter les limites de rate-limiting
fly secrets set RATE_LIMIT_WINDOW_MS=600000
fly secrets set RATE_LIMIT_MAX=500
fly deploy

# Activer le firewall Fly.io
fly firewall enable

# Monitorer le trafic
curl -I https://gcn-backend-api.fly.dev/api/health
```

---

## ⚙️ CONFIGURATION AVANCÉE (optionnel)

### Intégration Slack/Discord pour les alertes

```bash
# Ajouter dans .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Monitoring Prometheus (optionnel)

```bash
# Installer Prometheus exporter
npm install prom-client

# Ajouter dans server/middleware/securityMiddleware.js
const client = require('prom-client');
const collectMetrics = () => {
  const totalRequests = new client.Counter({
    name: 'security_total_requests',
    help: 'Total security events',
    labelNames: ['type', 'severity']
  });
};
```

### Logs centralisés (ELK stack)

```bash
# Configurer le shipment vers Elasticsearch
# Via Filebeat ou Fluentd
# Document: docs/SECURITY_MONITORING.md
```

---

## 📂 STRUCTURE DES FICHIERS

```
siteWeb/
├── scripts/
│   └── security-logger.js       # Analyseur CLI
│   └── rotate-jwt.sh            # Rotation JWT
├── server/
│   ├── middleware/
│   │   └── securityMiddleware.js # Middleware protection
│   └── app.js                   # Intégration securityMiddleware
├── logs/
│   ├── security.log             # Logs actifs
│   ├── blocked_ips.txt          # Listes IPs bloquées
│   └── security-YYYY-MM-DD.log.gz # Logs archivés
├── SECURITY/
│   ├── jwt-rotation-procedure.md
│   ├── security-checklist.md
│   └── rapid-reference.md
└── docs/
    └── SECURITY_MONITORING.md
```

---

## 🔄 MISES A JOUR RECOMMANDÉES

### Chaque semaine
- [ ] Examiner les alertes HIGH/MEDIUM
- [ ] Nettoyer les IPs bloquées > 30 jours
- [ ] Exporter les logs de la semaine

### Chaque mois
- [ ] Audit complet de sécurité
- [ ] Rotation JWT Secret (si > 90 jours)
- [ ] Génération rapport mensuel

### Chaque trimestre
- [ ] Pentest complet
- [ ] Mise à jour des dépendances
- [ ] Revue de la documentation

---

## 📞 SUPPORT

- **Documentation complète** : `docs/SECURITY_MONITORING.md`
- **Checklist sécurité** : `SECURITY/security-checklist.md`
- **Problèmes** : Ouvrir un issue sur GitHub
- **Urgence** : ops@gcn-data.fr

---

*Mise à jour : 25 juillet 2026*  
*Système de surveillance actif par défaut dans production*
