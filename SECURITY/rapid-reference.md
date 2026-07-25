# 📋 RAPID SECURITY REFERENCE

## 🚀 Commandes journalières

```bash
# Check JWT validation errors
fly logs --tail=100 | grep -i "token invalid" | wc -l

# Monitor login failures (brute-force detection)
fly logs --tail=200 | grep -i "login" | grep -i "failed"

# Check rate limit hits
fly logs --tail=100 | grep -i "429" | wc -l

# Monitor 5xx errors
curl -I https://gcn-backend-api.fly.dev/api/health
```

## 🔑 Rotation JWT (tous les 90 jours)

```bash
./scripts/rotate-jwt.sh
# Verify
curl -I https://gcn-backend-api.fly.dev/api/health
```

## 📝 Checklists rapides

### Before deployment
- [ ] `npm run test:all` passes
- [ ] `npm audit` no critical vulnerabilities
- [ ] Docker build succeeds
- [ ] Fly deploy succeeds

### After incident
- [ ] Document incident in `SECURITY/incidents/YYYYMMDD-*.md`
- [ ] Rotate compromised secrets
- [ ] Notify stakeholders
- [ ] Update checklist if procedures changed

## 📂 Fichiers clés

| Fichier | Purpose | Location |
|---------|---------|----------|
| `AUDIT_SUMMARY.md` | Audit complet | `./` |
| `BACKUP_SECURITY.md` | Backup + recovery | `./` |
| `SECURITY/jwt-rotation-procedure.md` | Rotation JWT | `./SECURITY/` |
| `SECURITY/security-checklist.md` | Checklists mensuelles | `./SECURITY/` |
| `scripts/rotate-jwt.sh` | Script rotation automatique | `./scripts/` |
| `.github/workflows/ci.yml` | GitHub Actions CI | `./.github/workflows/` |

---

*Reference last updated: 25 July 2026*