# 🔐 BACKUP & SECURITY POLICY

## Backup Strategy

### MongoDB Atlas
- Auto-backup quotidien activé sur Enterprise cluster
- RPO: 24h, RTO: 4h
- Localisation: AWS EU-West-3 (fr-par-1)
- Chiffrement: AES-256 au repos

### n8n_data (homeserv01)
- **Quotidien**: Snapshot compressé dans /var/backups/n8n/
- **Hebdomadaire**: Sync vers AWS S3 `gcn-backups/n8n/YYYY/MM/DD/`
- **Mensuel**: Archive hors ligne (cold storage)

```bash
#!/bin/bash
# scripts/backup-n8n.sh
DATE=$(date +%Y%m%d)
rsync -avz /var/lib/n8n_data/ /var/backups/n8n/$DATE/
aws s3 sync /var/backups/n8n/ s3://gcn-backups/n8n/ --delete
```

### Client Build Artifacts
- `client/dist/` versionné avec tag Git (v1.0.0, v1.1.0...)
- Conservation: 10 dernières versions
- Stockage: Fly.io volumes + GitHub Releases

---

## Security Checklist

### Audit hebdomadaire (automatisé)
```
- [ ] NPM audit --audit-level=moderate
- [ ] Rotation JWT_SECRET si > 90 jours
- [ ] Revocation tous les RefreshTokens expirés
- [ ] Review logs erreurs 5xx > 1%
```

### Rotation JWT_SECRET
- Fréquence: Tous les 90 jours
- Procédure:
  1. Générer nouveau secret (openssl rand -hex 32)
  2. Déployer sur Fly.io (`fly secrets set JWT_SECRET=...`)
  3. Forcer refresh token tous les clients (24h grace period)
  4. Documenter dans file `/SECURITY/rotation-YYYYMMDD.md`

### Monitoring alerting
- LighthouseScore > 90 sur prod × 3 jours → Slack alert
- 5xx error rate > 1% × 10min → PagerDuty
- Login brute-force > 10 IPs → IP blacklist automat.

---

## Recovery Procedures

### MongoDB restore
```bash
# Depuis MongoDB Compass ou CLI
mongodump --uri=$MONGODB_URI --out=/restore/
mongorestore /restore/
```

### n8n_data restore
```bash
cd /opt/n8n
docker-compose down
rsync -avz /var/backups/n8n/latest/ /var/lib/n8n_data/
docker-compose up -d
```

### Build rollback
```bash
fly ssh console --stage staging
# git checkout <tag>
npm ci && npm run build
fly deploy --dockerfile Dockerfile.fly
```

---

## Contact d'urgence

- **Ops**: ops@gcn-data.fr
- **GitHub Issues**: https://github.com/Gnaro-Shaft/siteWeb/issues/new?label=security
- **Slack**: #security-alerts (accès Tailscale requis)
