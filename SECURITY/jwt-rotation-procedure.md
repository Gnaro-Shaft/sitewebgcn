# 🔑 ROTATION AUTOMATIQUE JWT

## 🎯 OBJECTIF

Roter `JWT_SECRET` tous les 90 jours sans interruption de service, avec periode grace de 24h pour migration des tokens actifs.

---

## ⚙️ PROCÉDURE DE ROTATION (semi-automatisée)

### Étape 1 : Préparer le nouveau secret

```bash
# Générer un nouveau secret aléatoire (min. 32 octets)
NEW_SECRET=$(openssl rand -hex 32)

echo "Nouveau JWT_SECRET généré : $NEW_SECRET"
# À sauvegarder dans un gestionnaire de secrets (1Password, Bitwarden, etc.)
```

### Étape 2 : Déployer le nouveau secret sur Fly.io

```bash
# Mettre à jour le secret sans redémarrer l'app
fly secrets set JWT_SECRET="$NEW_SECRET"

# Vérifier que le secret a été appliqué
fly secrets list | grep JWT_SECRET
```

### Étape 3 : Activer la période de grace (24h)

Pendant les 24h suivantes, le serveur **accepte les deux secrets** :

- Ancien `JWT_SECRET` : encore valide pour les tokens existants
- Nouveau `JWT_SECRET` : pour les nouveaux tokens émis

#### Implémentation dans `server/middleware/auth.js` :

```javascript
// Ajout de support multi-secret
const jwt = require('jsonwebtoken');

const getValidSecrets = () => {
  const current = process.env.JWT_SECRET;
  const legacy = process.env.JWT_SECRET_LEGACY;
  return current && legacy ? [current, legacy] : [current];
};

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authorized' });
  }

  try {
    const token = header.split(' ')[1];
    const header = jwt.decode(token, { complete: true });
    const issuedAt = header.payload.iat * 1000;
    const now = Date.now();
    const tokenAge = now - issuedAt;
    
    // Accepter tokens émis < 24h avec legacy secret
    if (tokenAge < 24 * 60 * 60 * 1000 && process.env.JWT_SECRET_LEGACY) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_LEGACY);
      req.user = await User.findById(decoded.id);
      return next();
    }
    
    // Tokens récents : vérifier avec nouveau secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token invalid' });
  }
};

module.exports = { protect, adminOnly, loginAuth };
```

### Étape 4 : Démarrer la période de transition

```bash
# Garder l'ancien secret accessible comme JWT_SECRET_LEGACY pendant 24h
fly secrets set JWT_SECRET_LEGACY="$OLD_SECRET"

# Forcer les clients à rafraîchir leurs tokens après 24h
fly ssh console --stage staging
# Dans le conteneur:
# - Inspecter Redis (si utilisé) pour invalider tokens après 24h
# - OU forcer logout utilisateur après 7 jours
```

### Étape 5 : Nettoyage final (7 jours après rotation)

```bash
# Supprimer le legacy secret
fly secrets delete JWT_SECRET_LEGACY

# Vérifier que tout fonctionne
fly logs --tail=50 | grep -i "token invalid"

# Consulter les logs d'erreurs JWT
fly ssh console --stage staging
# Logs: grep -i "jwt" /var/log/nginx/*.log
```

---

## 📅 CALENDRIER AUTOMATISÉ (cron jobs)

### Script de rotation automatique (`scripts/rotate-jwt.sh`)

```bash
#!/bin/bash
# Rotation automatique JWT - exécuté hebdomadairement
# Ajouter dans crontab: 0 3 * * 0 /app/scripts/rotate-jwt.sh

set -e

# Variables
FLY_APP_NAME="gcn-backend-api"
ROTATION_WINDOW_DAYS=90
GRACE_PERIOD_HOURS=24

# Générer nouveau secret
NEW_SECRET=$(openssl rand -hex 32)

# Sauvegarder l'ancien secret pour grace period
OLD_SECRET=$(fly secrets list | grep JWT_SECRET | awk '{print $2}')

# Déployer les deux secrets
fly secrets set JWT_SECRET="$NEW_SECRET"
fly secrets set JWT_SECRET_LEGACY="$OLD_SECRET"

echo "✅ JWT secret rotated successfully"
echo "   New: ${NEW_SECRET:0:8}..."
echo "   Legacy available for ${GRACE_PERIOD_HOURS}h"

# Planifier nettoyage automatique (7 jours après)
CRON_JO=$(date -d "+7 days" +"%H %M")
crontab -l | grep -v "rotate-jwt" \
  | sed "s/.*\$CRON_JO.*//" \
  | awk "{print \"0 $CRON_JO * * * $0\"} >> /tmp/cleanup-jwt-legacy.cron"

echo "📅 Nettoyage planifié: 7 jours après rotation"
```

### Crontab d'exécution

```bash
# Éditer crontab
crontab -e

# Ajouter : rotation chaque dimanche 3h AM
echo "0 3 * * 0 /app/scripts/rotate-jwt.sh >> /var/log/jwt-rotation.log 2>&1" | crontab -

# Vérifier
crontab -l
```

---

## 📊 MONITORING & ALERTING

### Logs à surveiller

```bash
# Erreurs JWT invalides > 5% des requêtes
fly logs --tail=100 | grep -i "token invalid" | wc -l

# Taux d'échecs de décodage
fly ssh console --stage staging
cd /var/log/nginx

# Alerting : si > 100 erreurs / heure
```

### Dashboard Prometheus (optionnel)

```yaml
# prometheus_alerts.yml
groups:
  - name: jwt-rotation-alerts
    rules:
      - alert: JQTSecretRotationPending
        expr: time() - secret_jwt_last_rotation_seconds > 7776000 # 90 days
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "JWT secret rotation due"

      - alert: JQTSecretValidationFailures
        expr: rate(jwt_validation_errors_total[1h]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High JWT validation errors - possible attack or rotation issue"
```

### Webhook Slack alert (extrait)

```javascript
// server/services/slackAlert.js
const sendJwtRotationAlert = (message) => {
  fetch(process.env.SLACK_WEBHOOK, {
    method: 'POST',
    body: JSON.stringify({
      text: `🔐 JWT Rotation Alert: ${message}`,
      channel: '#security-alerts'
    })
  });
};
```

---

## 🔍 CHECKLIST DE ROTATION

- [ ] Nouveau secret généré (openssl rand -hex 32)
- [ ] Nouveau secret stocké dans gestionnaire de secrets (1Password, etc.)
- [ ] Ancien secret sauvegardé comme `JWT_SECRET_LEGACY`
- [ ] Déploiement Fly.io réussi (`fly secrets list`)
- [ ] Période de grace de 24h activée
- [ ] Monitoring logs d'erreurs JWT activé
- [ ] Nettoyage `JWT_SECRET_LEGACY` planifié (7 jours)
- [ ] Documentation de la rotation (fichier `SECURITY/rotation-YYYYMMDD.md`)

---

## 🆘 SCÉNARIOS D'URGENCE

### Scénario 1 : Perte du `JWT_SECRET`

```bash
# Si JWT_SECRET est perdu (mais pas JWT_SECRET_LEGACY)

1. Vérifier backup Fly.io
   fly secrets list --all

2. Récupérer depuis backup S3 (si configuré)
   aws s3 cp s3://gcn-backups/fly-secrets/jwt-secret.txt

3. Réinstaller le secret
   fly secrets set JWT_SECRET="$RECOVERED_SECRET"

4. Forcer tous les utilisateurs à se reconnecter
   db.users.updateMany({}, { $set: { refreshToken: null } })
```

### Scénario 2 : Attaque brute-force sur login

```bash
# Vérifier logs de login échoués
fly logs --tail=500 | grep "login failed"

# Bannir IP suspect
fly ssh console --stage staging
# iptables -A INPUT -s <IP> -p tcp --dport 80 -j DROP

# Mettre en place `loginLimiter` si pas déjà fait
fly deploy --dockerfile Dockerfile

# Analyser patterns d'attaque
python scripts/analyze-login-failures.py > /var/log/login-attempts.log
```

### Scénario 3 : Fuite JWT_SECRET dans code visible

```bash
# Réaction immédiate : forcer rotation d'urgence

1. Générer nouveau secret
   NEW_SECRET=$(openssl rand -hex 32)

2. Déployer immédiat sans periode grace
   fly secrets set JWT_SECRET="$NEW_SECRET"
   
3. Invalidation tous les RefreshTokens existants
   mongo gcn-data --eval "db.tokens.deleteMany({})"

4. Notifier utilisateurs (si applicable)
   sendEmailCampaign({
     subject: "Security Update: Please log in again",
     to: "all_active_users"
   })
```

---

## 📖 DOCUMENTATION COMPLÉMENTAIRE

- [`server/middleware/auth.js`](./server/middleware/auth.js) - Implémentation
- [`BACKUP_SECURITY.md`](./BACKUP_SECURITY.md) - Policy globale
- [`AUDIT_SUMMARY.md`](./AUDIT_SUMMARY.md) - Résumé audit

---

*Mise à jour: 25 juillet 2026*  
*Prochaine révision recommandée: trimestrielle*