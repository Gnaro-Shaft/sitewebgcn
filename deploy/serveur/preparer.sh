#!/usr/bin/env bash
#
# Prépare le VPS pour le tableau de bord, depuis le Mac, en une commande :
#
#   deploy/serveur/preparer.sh debian@51.91.54.101
#
# 1. crée, s'il n'existe pas, un couple de clés dédié au déploiement GitHub
#    dans ~/.ssh/gcn-ci — la privée ira dans un secret du dépôt, la publique
#    sur le serveur, pour l'utilisateur gcn seulement ;
# 2. envoie installer.sh, l'unité systemd, le bloc Caddy et les clés ;
# 3. lance installer.sh en root ;
# 4. affiche les secrets à déposer sur GitHub.
#
# Rejouable sans risque : installer.sh est idempotent.
set -euo pipefail

CIBLE="${1:-}"
[ -n "$CIBLE" ] || { echo "usage : $0 utilisateur@adresse" >&2; exit 1; }

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLE_CI="$HOME/.ssh/gcn-ci"

if [ ! -f "$CLE_CI" ]; then
  echo "→ Clé de déploiement : $CLE_CI"
  ssh-keygen -q -t ed25519 -N '' -C 'gcn-ci@github-actions' -f "$CLE_CI"
fi

ADMIN_PUB=""
for c in "$HOME/.ssh/id_ed25519.pub" "$HOME/.ssh/id_rsa.pub"; do
  [ -f "$c" ] && { ADMIN_PUB="$c"; break; }
done

echo "→ Bloc Caddy régénéré depuis la table des redirections"
node "$ICI/generer-caddy.js"

echo "→ Connexion à $CIBLE"
ssh -o ConnectTimeout=10 "$CIBLE" 'echo "   $(hostname) · $(. /etc/os-release; echo "$PRETTY_NAME")"'

echo "→ Envoi et exécution de installer.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$ICI/installer.sh" "$ICI/gcn-dashboard.service" "$ICI/Caddyfile.gcn-data" "$TMP/"
cp "$CLE_CI.pub" "$TMP/ci.pub"
[ -n "$ADMIN_PUB" ] && cp "$ADMIN_PUB" "$TMP/admin.pub"

tar -C "$TMP" -cz . | ssh "$CIBLE" \
  'sudo bash -c "rm -rf /root/gcn-prep && mkdir -p /root/gcn-prep && tar -xz -C /root/gcn-prep && bash /root/gcn-prep/installer.sh"'

HOTE="${CIBLE#*@}"
echo
echo "→ Secrets à déposer sur GitHub (Settings → Secrets and variables → Actions) :"
echo
echo "   gh secret set DEPLOY_HOST        --body '$HOTE'"
echo "   gh secret set DEPLOY_USER        --body 'gcn'"
echo "   gh secret set DEPLOY_SSH_KEY     < $CLE_CI"
echo "   ssh-keyscan -t ed25519 $HOTE 2>/dev/null | gh secret set DEPLOY_KNOWN_HOSTS"
echo
echo "   puis, quand le DNS pointe sur le serveur :"
echo "   gh variable set DEPLOY_ENABLED   --body true"
