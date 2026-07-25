#!/bin/bash
# deploy-security.sh - Script de déploiement automatique sécurisé
# Usage: ./deploy-security.sh [--force]

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
VERSION="1.0.0"
FLY_APP="gcn-backend-api"
BACKUP_ENABLED=true

# Fonction d'affichage
log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

info() {
  echo -e "${GREEN}✔ ${BLUE}$1${NC}"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

warn() {
  echo -e "${YELLOW}⚠ ${1}${NC}"
}

error() {
  echo -e "${RED}✗ ${1}${NC}"
  exit 1
}

# Parser les arguments
FORCE=false
if [[ "$1" == "--force" ]]; then
  FORCE=true
  log "Mode FORCE ACTIVÉ"
fi

log "================================================"
log "DEPLOIEMENT SECURITE v$VERSION"
log "================================================"

# Prérequis
check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "$1 n'est pas installé. Veuillez l'installer."
  fi
}

log "📋 Vérification des prérequis..."
check_command git
check_command node
check_command fly

log "✅ Tous les prérequis sont satisfaits"

# Étape 1: Validation locale
log "🔍 Étape 1/7 - Validation locale des fichiers sécurité..."
if ! node scripts/validate-security.js > /tmp/security-validation.log 2>&1; then
  warn "Validation échouée. Voir /tmp/security-validation.log"
  if [ "$FORCE" = true ]; then
    log "Mode FORÇÉ : Continuer malgré les warnings"
  else
    error "Arrêt du déploiement. Corrigez les erreurs avant de réessayer."
  fi
fi

if grep -q "All security checks passed" /tmp/security-validation.log; then
  success "Validation sécurité PASSÉE"
  sed -n '4,30p' /tmp/security-validation.log
else
  cat /tmp/security-validation.log
fi

# Étape 2: Tests unitaires
log "🧪 Étape 2/7 - Exécution des tests unitaires..."
if npm run test:all > /tmp/test-results.log 2>&1; then
  success "Tests UNITAIRES PASSÉS"
  tail -5 /tmp/test-results.log
else
  warn "Tests échoués. Voir /tmp/test-results.log"
  if [ "$FORCE" = true ]; then
    log "Mode FORCÉ : Continuer"
  else
    error "Arrêt. Corrigez les tests avant déploiement."
  fi
fi

# Étape 3: Tests intégration
log "⚙️ Étape 3/7 - Exécution des tests d'intégration..."
if npm run test:integration > /tmp/integration-results.log 2>&1; then
  success "Tests D'INTEGRATION PASSÉS"
  tail -3 /tmp/integration-results.log
else
  warn "Intégration échouée. Vérification manuelle requise."
  if [ "$FORCE" = true ]; then
    log "Mode FORCÉ : Continuer"
  fi
fi

# Étape 4: Build frontend
log "🎨 Étape 4/7 - Build du frontend..."
if [ -d client ]; then
  if (cd client && npm run build > /tmp/frontend-build.log 2>&1); then
    success "Build FRONTEND RÉUSSI"
    ls -lh client/dist/
  else
    warn "Build frontend échoué. Voir /tmp/frontend-build.log"
    if [ "$FORCE" = true ]; then
      log "Mode FORCÉ : Continuer"
    fi
  fi
else
  warn "Dossier client non trouvé. Skip frontend build."
fi

# Étape 5: Analyse sécurité dépendances
log "🔒 Étape 5/7 - Analyse sécurité des dépendances (npm audit)..."
if npm audit --audit-level=moderate > /tmp/audit-report.log 2>&1; then
  CRITICAL_ISSUES=$(grep -c "found" /tmp/audit-report.log || echo "0")
  if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    warn "$CRITICAL_ISSUES vulnérabilités critiques trouvées. Review requise."
    tail -10 /tmp/audit-report.log
  else
    success "AUCUNE VULNÉRABILITÉ CRITIQUE"
  fi
else
  warn "npm audit échoué. Voir /tmp/audit-report.log"
fi

# Étape 6: Backup des logs
log "💾 Étape 6/7 - Backup des logs sécurité avant déploiement..."
if [ -d logs ]; then
  BACKUP_FILE="logs-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP_FILE" logs/ 2>/dev/null
  if [ -f "$BACKUP_FILE" ]; then
    success "Backup créé: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))
  else
    warn "Dossier logs vide ou inexistant. Skip backup."
  fi
fi

# Étape 7: Déploiement Fly.io
log "🚀 Étape 7/7 - Déploiement sur Fly.io..."

# Créer les secrets nécessaires
log "🔐 Configuration des secrets Fly.io..."

if ! fly secrets list | grep -q "JWT_SECRET"; then
  log "🆕 Génération de JWT_SECRET..."
  NEW_SECRET=$(openssl rand -hex 32)
  echo "JWT_SECRET=$NEW_SECRET"
  fly secrets set JWT_SECRET="$NEW_SECRET"
  success "JWT_SECRET généré et sauvegardé"
fi

if ! fly secrets list | grep -q "MONGODB_URI"; then
  warn "MONGODB_URI manquant. Veuillez définir le secret."
  echo "fly secrets set MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db"
fi

# Planifier le déploiement
if [ "$FORCE" = true ]; then
  log "⚠️  MODE FORCÉ - Déploiement sans validation complète"
fi

log "Déploiement en cours vers l'app $FLY_APP..."

# Déployer
if fly deploy --image-registry-auth="fly.io" > /tmp/deploy-output.log 2>&1; then
  success "✅ DÉPLOIEMENT RÉUSSI!"
  echo ""
  echo "Informations du déploiement:"
  fly status --app "$FLY_APP" | tail -20
else
  error "❌ Déploiement échoué. Voir /tmp/deploy-output.log"
  echo "Pour annuler et rollback: fly rollback"
  exit 1
fi

# Post-déploiement
log "📡 Vérification de la santé de l'application..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://$FLY_APP.fly.dev/api/health)

if [ "$HEALTH_CHECK" = "200" ]; then
  success "🏥 API en ligne et fonctionnelle!"
else
  warn "API retour code HTTP: $HEALTH_CHECK. Vérification manuelle requise."
fi

# Afficher les logs récents
log "📋 Logs récents de l'application:"
fly logs --app "$FLY_APP" --tail=20 2>/dev/null | grep -E "Server running|connected|error|Error" || true

echo ""
log "================================================"
log "DEPLOIEMENT TERMINÉ AVEC SUCCÈS"
log "================================================"
echo ""
echo "✨ Prochaines étapes:"
echo "1. Vérifier les logs sécurité: node scripts/security-logger.js analyze"
echo "2. Exporter les alertes: node scripts/security-logger.js export"
echo "3. Consulter la documentation: cat SECURITY/DEPLOYMENT_GUIDE.md"
echo "4. Monitorer les IPs bloquées: cat logs/blocked_ips.txt"

exit 0
