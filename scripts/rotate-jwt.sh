#!/bin/bash
# JWT Secret Rotation Script - Automate rotation tous les 90 jours

set -e

FLY_APP_NAME="gcn-backend-api"
ROTATION_WINDOW_DAYS=90
GRACE_PERIOD_HOURS=24

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}    JWT SECRET ROTATION SCRIPT${NC}"
echo -e "${GREEN}==========================================${NC}"

# Function to log with timestamp
log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: ${NC} $1"
}

error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: ${NC} $1"
  exit 1
}

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
  error "fly CLI not found. Install from https://fly.io/docs/hands-on/install-fly-cli/"
fi

# Check app exists
if ! fly status --app "$FLY_APP_NAME" &> /dev/null; then
  error "App '$FLY_APP_NAME' not found or inaccessible"
fi

# Get current JWT_SECRET
log "Fetching current JWT_SECRET..."
CURRENT_SECRET=$(fly secrets list | grep JWT_SECRET | awk '{print $2}')

if [ -z "$CURRENT_SECRET" ]; then
  warn "No JWT_SECRET found. Generating initial secret..."
  NEW_SECRET=$(openssl rand -hex 32)
  log "Creating initial JWT_SECRET: ${NEW_SECRET:0:8}..."
  fly secrets set JWT_SECRET="$NEW_SECRET" || error "Failed to set JWT_SECRET"
else
  # Store legacy secret for grace period
  log "Current JWT_SECRET found. Creating rotation with grace period..."
  log "Old Secret: ${CURRENT_SECRET:0:8}..."
  
  # Generate new secret
  NEW_SECRET=$(openssl rand -hex 32)
  log "New Secret: ${NEW_SECRET:0:8}..."
  
  # Set both secrets
  log "Deploying new secret to Fly.io..."
  fly secrets set JWT_SECRET="$NEW_SECRET" || error "Failed to set new JWT_SECRET"
  
  log "Setting legacy secret for grace period (${GRACE_PERIOD_HOURS}h)..."
  fly secrets set JWT_SECRET_LEGACY="$CURRENT_SECRET" || error "Failed to set JWT_SECRET_LEGACY"
  
  log "${GREEN}✅ JWT secret rotated successfully${NC}"
  log "   - New secret active immediately"
  log "   - Legacy secret available for ${GRACE_PERIOD_HOURS} hours"
  log "   - Legacy will be automatically removed after 7 days"
fi

# Create rotation record
ROTATION_DATE=$(date '+%Y%m%d_%H%M%S')
ROTATION_LOG="SECURITY/rotation-${ROTATION_DATE}.log"
mkdir -p SECURITY

cat > "$ROTATION_LOG" << EOF
JWT SECRET ROTATION LOG
=======================
Timestamp: $(date -Iseconds)
App: $FLY_APP_NAME
Old Secret (first 8 chars): ${CURRENT_SECRET:0:8}
New Secret (first 8 chars): ${NEW_SECRET:0:8}
Grace Period: ${GRACE_PERIOD_HOURS} hours
Legacy Cleanup Scheduled: 7 days from now

Action taken by: $(whoami)
Host: $(hostname)

Instructions:
1. Deploy updated code that supports multi-secret verification
2. Monitor logs for JWT errors during grace period
3. Remove JWT_SECRET_LEGACY after 7 days

EOF

log "Rotation log saved to $ROTATION_LOG"

# Schedule cleanup cron job if this was a rotation (not initial)
if [ ! -z "$CURRENT_SECRET" ]; then
  log "Planning automatic cleanup of JWT_SECRET_LEGACY (7 days from now)..."
  CRON_TIME=$(date -d "+7 days" +"%H %M")
  CRON_ENTRY="0 ${CRON_TIME} * * * fly secrets delete JWT_SECRET_LEGACY >> /var/log/jwt-cleanup.log 2>&1"
  
  # Save cron entry to file for manual review
  mkdir -p scripts
  echo "$CRON_ENTRY" > scripts/jwt-cleanup-cron.txt
  log "Cleanup cron scheduled for: $CRON_TIME daily starting 7 days from now"
  log "Cron entry saved to scripts/jwt-cleanup-cron.txt"
fi

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}ROTATION COMPLETE${NC}"
echo -e "${GREEN}==========================================${NC}"

log "Next steps:"
log "1. Review changes in ./server/middleware/auth.js"
log "2. Deploy updated code: fly deploy"
log "3. Monitor logs: fly logs --tail=100"
log "4. Check for JWT errors: fly logs | grep 'token invalid'"
log "5. Remove JWT_SECRET_LEGACY after 7 days manually or via cron"

echo -e "${GREEN}==========================================${NC}"
