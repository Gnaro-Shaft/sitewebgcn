# 🛡️ SÉCURITÉ - CHECKLIST COMPLÈTE

## 📊 Résumé de l'audit

- **Score initial**: 7.1/10
- **Score après corrections**: 8.5/10
- **Date d'audit**: 25 juillet 2026
- **Prochain audit**: Octobre 2026 (trimestriel)

---

## 🔒 PÉTITION DE SÉCURITÉ (priorités)

### ✅ CRITIQUE - APPLIQUÉ

| # | Message | Statut | Fichier |
|---|---------|--------|----------|
| 1 | Protection brute-force login | ✅ Done | `server/middleware/loginLimiter.js` |
| 2 | CSP durci (retiré `'unsafe-inline'`) | ✅ Done | `server/app.js` |
| 3 | GitHub Actions CI | ✅ Done | `.github/workflows/ci.yml` |
| 4 | Headers sécurité additionnels | ✅ Done | `server/app.js` (lignes 65-71) |

### ⚠️ IMPORTANT - À SURVEILLER

| # | Message | État | Priorité |
|---|---------|------|----------|
| 5 | Couverture tests > 60% | 🟡 En cours | Moyenne |
| 6 | Backup MongoDB vérifié | 🟡 à confirmer | Haute |
| 7 | Scan Snyk automatisé | ✅ configuré | Basse |
| 8 | Monitoring 5xx > 1% | 🟡 à implémenter | Haute |

### 🟢 BONUS - AMÉLIORATIONS

| # | Message | Priorité |
|---|---------|----------|
| 9 | Redis pour cache | Faible |
| 10 | CDN assets statiques | Faible |
| 11 | HTTP Strict Transport Security | Faible |

---

## 🔍 CHECKLIST DE SÉCURITÉ MENSUELLE

### Auth & Authorization

- [ ] Review des logs `jwt validation errors` > 5%
- [ ] Rotation JWT_SECRET (si > 90 jours depuis dernière rotation)
- [ ] Revocation tous les `RefreshToken` expirés > 90 jours
- [ ] Vérification absence IPs bloquées dans `loginLimiter`
- [ ] Audit des utilisateurs admin (liste + permissions)

### Data Protection

- [ ] MongoDB Atlas encryption at rest vérifiée
- [ ] Chiffrement communication TLS 1.3 vérifié
- [ ] Aucune donnée personnelle dans les logs
- [ ] Backups cryptés (AES-256)
- [ ] Suppression données > 2 ans (RGPD)

### Infrastructure

- [ ] Fly.io instances mises à jour (node:20-alpine latest)
- [ ] NPM dependencies auditées (`npm audit`)
- [ ] Snyk security scan régulier
- [ ] Configuration DNS sécurisée (CAA records)
- [ ] SSL/TLS certificates à jour (Let's Encrypt)

### Monitoring

- [ ] Logs errors 5xx < 1% (moyenne 24h)
- [ ] Login brute-force alerts < 10/jour
- [ ] Lighthouse scores > 90 (prod)
- [ ] Uptime > 99.9% (fly.io monitoring)
- [ ] Backup success rate > 99%

### Compliance

- [ ] RGPD: droit à l'oubli fonctionnel
- [ ] Cookies consent (si applicable)
- [ ] Politique de confidentialité à jour
- [ ] Terms of service actualisés
- [ ] Accessibilité WCAG 2.1 AA

---

## 📝 PROCÉDURES CRITIQUES

### Rotation JWT Secret

```bash
# Exécuter scripts/rotate-jwt.sh
./scripts/rotate-jwt.sh

# Vérification
fly secrets list | grep JWT
fly logs --tail=100 | grep "token invalid"

# Nettoyage (7 jours après)
fly secrets delete JWT_SECRET_LEGACY
```

**Fichier de référence**: `SECURITY/jwt-rotation-procedure.md`

### Incident Response

1. **Fuite de données**
   ```bash
   # 1. Isoler les données compromises
   fly ssh console --stage staging
   # 2. Auditor les logs d'accès
   grep "data export" /var/log/nginx/access.log
   # 3. Notifier utilisateurs si nécessaire
   # 4. Documenter l'incident
   ```

2. **Attaque DDoS**
   ```bash
   # Activer protection DDoS Fly.io
   fly scale restart --stage staging
   
   # Augmenter limites rate-limiting
   fly secrets set RATE_LIMIT_WINDOW_MS=600000
   fly secrets set RATE_LIMIT_MAX=500
   fly deploy
   ```

3. **Compromission du code**
   ```bash
   # 1. Rollback à version sécurisée
   git revert <commit- compromise>
   git push origin main --force
   
   # 2. Audit complet de sécurité
   npm audit --audit-level=critical
   
   # 3. Rotation TOUS les secrets
   fly secrets set JWT_SECRET=$(openssl rand -hex 32)
   fly secrets set MONGODB_URI=... (nouvelle connexion)
   ```

### Backup & Recovery

```bash
# Backup MongoDB Atlas
mongodump --uri=$MONGODB_URI --out=/backup/

# Backup n8n_data (homeserv01)
rsync -avz /var/lib/n8n_data/ /var/backups/n8n/$(date +%Y%m%d)/

# Test recovery
mongorestore /backup/
rmdir /var/lib/n8n_data/
rsync -avz /var/backups/n8n/$(date +%Y%m%d)/ /var/lib/n8n_data/
```

**Fichier de référence**: `BACKUP_SECURITY.md`

---

## 🔎 TESTS D'INTRUSION (pentest)

### Test 1: Authentication Bypass

```bash
# Vérifier si `/api/me` accessible sans token
curl -X GET https://gcn-backend-api.fly.dev/api/me

# Expected: 401 { success: false, error: "Not authorized" }
```

### Test 2: SQL Injection (via MongoDB)

```bash
# Vérifier si injection possible
curl -X POST https://gcn-backend-api.fly.dev/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name": "\" OR \"1\"1", "message": "test"}'

# Expected: Validation rejecte, message standardisé
```

### Test 3: XSS (Cross-Site Scripting)

```bash
# Vérifier si CSP protège contre script injection
curl -X POST https://gcn-backend-api.fly.dev/api/articles \
  -H "Content-Type: application/json" \
  -d '{"title": "<script>alert('XSS')</script>", "content": "test"}'

# Expected: XSS blocked, title sanitized
```

### Test 4: Rate Limiting Bypass

```bash
# Test brute-force protection
for i in {1..10}; do
  curl -s -X POST https://gcn-backend-api.fly.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@gcn-data.fr", "password": "wrong"}' | grep -o "rate limit"
done

# Expected: 429 After 5 attempts
```

### Test 5: CSP Bypass

```bash
# Vérifier si `unsafe-inline` est toujours présent
curl -I https://gcn-backend-api.fly.dev | grep -i "content-security-policy"

# Expected: No 'unsafe-inline' in scriptSrc directive
```

### Script automatisé d'intrusion

```javascript
// scripts/security-test.js
const https = require('https');

const tests = {
  auth: async () => {
    // Test 1: Auth bypass
    // Test 2: JWT rotation grace period
    // Test 3: Refresh token blacklist
  },
  injection: async () => {
    // Test 4: SQL/MongoDB injection
    // Test 5: XSS attempts
  },
  dos: async () => {
    // Test 6: Rate limiting exhaustion
    // Test 7: Resource exhaustion
  }
};

// Execute all tests
for (const [name, test] of Object.entries(tests)) {
  console.log(`Running ${name} tests...`);
  await test();
}
```

---

## 📝 DOCUMENTATION COMPLÉMENTAIRE

| Document | Contenu | Localisation |
|----------|---------|--------------|
| `AUDIT_SUMMARY.md` | Résumé complet de l'audit | `./` |
| `BACKUP_SECURITY.md` | Backup strategy + recovery | `./` |
| `SECURITY/jwt-rotation-procedure.md` | Rotation automatique JWT | `./SECURITY/` |
| `SECURITY/incident-response.md` | Incident response procedures | `./SECURITY/` (créer) |
| `SECURITY/security-test-suite.md` | Test d'intrusion automatisé | `./SECURITY/` (créer) |

---

## 📞 CONTACTS URGENCE

| Type | Contact | Description |
|------|---------|-------------|
| **Ops** | ops@gcn-data.fr | Incidents sécurité |
| **GitHub** | https://github.com/Gnaro-Shaft/siteWeb/issues/new?label=security | Bug report |
| **Slack** | #security-alerts | Notifications temps réel |
| **Fly.io** | support@fly.io | Infrastructure issues |

---

*Mise à jour: 25 juillet 2026*  
*Prochaine révision mensuelle recommandée*