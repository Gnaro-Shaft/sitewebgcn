#!/usr/bin/env bash
#
# Mise en ligne du tableau de bord gcn-data.fr.
#
# ─────────────────────────────────────────────────────────────────────────────
# CE FICHIER EST LA SEULE COUCHE QUI CONNAÎT L'HÉBERGEUR.
#
# Depuis septembre 2026 : le VPS OVH de gnaro.fr, Node sous systemd, Caddy en
# frontal. Ce script rsync le code serveur et le client construit vers
# /opt/gcn-dashboard/app, installe les dépendances de production sur place,
# redémarre le service et contrôle la santé. Le workflow GitHub
# (.github/workflows/deploy.yml) ne sait rien de tout ça.
#
# Contrat : configuration lue dans l'environnement, jamais en dur ; échec avec
# un code non nul et un message qui nomme la cause ; rejouable.
#
#   GitHub Actions — DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS
#   À la main, depuis le Mac, avec sa propre clé SSH :
#     (cd client && npm run build) && DEPLOY_HOST=51.91.54.101 ./deploy/deploy.sh
#
# Le contrôle final interroge https://gcn-data.fr/api/health : tant que le DNS
# ne pointe pas sur le serveur, il échoue. DEPLOY_SKIP_CHECK=1 le remplace par
# un contrôle local sur le serveur, pour la période avant bascule.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SITE_URL="${DEPLOY_SITE_URL:-https://gcn-data.fr}"
DEPLOY_USER="${DEPLOY_USER:-gcn}"
APP_DIR="${DEPLOY_DIR:-/opt/gcn-dashboard/app}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ Déploiement du tableau de bord gcn-data.fr"

[ -n "${DEPLOY_HOST:-}" ] || { echo "✗ DEPLOY_HOST absent : adresse du serveur." >&2; exit 1; }
[ -f "$RACINE/client/dist/index.html" ] || { echo "✗ client/dist/index.html introuvable : construire le client d'abord (cd client && npm run build)." >&2; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "✗ rsync absent." >&2; exit 1; }

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)
NETTOYAGE=()
trap 'rm -rf "${NETTOYAGE[@]}"' EXIT
if [ -n "${DEPLOY_SSH_KEY:-}" ]; then
  [ -n "${DEPLOY_KNOWN_HOSTS:-}" ] || { echo "✗ DEPLOY_KNOWN_HOSTS absent : empreinte du serveur (ssh-keyscan)." >&2; exit 1; }
  TMP="$(mktemp -d)"; NETTOYAGE+=("$TMP")
  printf '%s\n' "$DEPLOY_SSH_KEY" > "$TMP/cle"
  printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$TMP/known_hosts"
  chmod 600 "$TMP/cle" "$TMP/known_hosts"
  SSH_OPTS+=(-i "$TMP/cle" -o IdentitiesOnly=yes -o UserKnownHostsFile="$TMP/known_hosts" -o StrictHostKeyChecking=yes)
fi
CIBLE="$DEPLOY_USER@$DEPLOY_HOST"
distant() { ssh "${SSH_OPTS[@]}" "$CIBLE" "$@"; }

# --- 1. Fichiers ---------------------------------------------------------------
# Ce qui part : le serveur, les scripts, les manifestes npm, le client construit.
# Ce qui ne part jamais : .env (hors du dossier, de toute façon), node_modules
# (installé sur place), logs/ (adresses bloquées : propriété du serveur).
echo "→ rsync vers $CIBLE:$APP_DIR"
# rsync ne crée pas les dossiers intermédiaires : au premier déploiement,
# client/ n'existe pas encore sur le serveur.
distant "mkdir -p '$APP_DIR/client/dist' '$APP_DIR/logs'"
rsync -az --delete --chmod=D750,F640 \
  --exclude 'node_modules' --exclude 'logs' --exclude '__tests__' --exclude '.env*' \
  -e "ssh ${SSH_OPTS[*]}" \
  "$RACINE/server" "$RACINE/scripts" "$RACINE/package.json" "$RACINE/package-lock.json" \
  "$CIBLE:$APP_DIR/"
rsync -az --delete --chmod=D750,F640 -e "ssh ${SSH_OPTS[*]}" \
  "$RACINE/client/dist/" "$CIBLE:$APP_DIR/client/dist/"

# --- 2. Dépendances et redémarrage --------------------------------------------
echo "→ npm ci (production) et redémarrage du service"
distant "cd '$APP_DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error && sudo /usr/bin/systemctl restart gcn-dashboard.service"

# --- 3. Contrôle ----------------------------------------------------------------
for i in 1 2 3 4 5 6 7 8 9 10; do
  if distant "sudo /usr/bin/systemctl is-active gcn-dashboard.service" >/dev/null 2>&1; then break; fi
  [ "$i" -lt 10 ] || { echo "✗ Le service ne démarre pas. Journal :" >&2; distant "sudo /usr/bin/journalctl -u gcn-dashboard.service -n 30 --no-pager" >&2; exit 1; }
  sleep 2
done
if [ "${DEPLOY_SKIP_CHECK:-}" = "1" ]; then
  code="$(distant "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/health")"
  [ "$code" = "200" ] || { echo "✗ /api/health local répond $code." >&2; exit 1; }
  echo "✓ Service actif, /api/health local en 200. Contrôle public sauté (DEPLOY_SKIP_CHECK=1)."
  exit 0
fi
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL/api/health")"
[ "$code" = "200" ] || { echo "✗ $SITE_URL/api/health répond $code." >&2; exit 1; }
echo "✓ En ligne : $SITE_URL"
