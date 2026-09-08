#!/usr/bin/env bash
#
# Préparation du VPS pour le tableau de bord — s'exécute SUR LE SERVEUR, en
# root. Ne pas lancer à la main : deploy/serveur/preparer.sh l'envoie et le
# lance depuis le Mac, avec les fichiers dont il a besoin dans le même dossier :
#
#   gcn-dashboard.service   unité systemd
#   Caddyfile.gcn-data      bloc Caddy, généré par generer-caddy.js
#   ci.pub                  clé publique du déploiement GitHub (utilisateur gcn)
#   admin.pub               clé publique du Mac, facultative (déployer à la main)
#
# Le VPS héberge déjà gnaro.fr (Caddy, utilisateur gnaro) : ce script s'ajoute
# à côté sans rien lui prendre. Il installe Node 20 (dépôt NodeSource), crée
# l'utilisateur gcn SANS sudo hormis le redémarrage de son propre service,
# et ajoute le bloc gcn-data.fr au Caddyfile existant, entre deux marqueurs,
# après validation. Rejouable : chaque étape vérifie l'état avant d'agir.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE=/opt/gcn-dashboard
UTILISATEUR=gcn
DEBUT='# >>> gcn-data.fr (géré par siteWeb/deploy/serveur/installer.sh) >>>'
FIN='# <<< gcn-data.fr <<<'

[ "$(id -u)" -eq 0 ] || { echo "✗ à lancer en root (sudo)." >&2; exit 1; }
for f in gcn-dashboard.service Caddyfile.gcn-data ci.pub; do
  [ -f "$ICI/$f" ] || { echo "✗ $f absent à côté de ce script." >&2; exit 1; }
done
command -v caddy >/dev/null || { echo "✗ Caddy absent : ce VPS n'est pas celui de gnaro.fr ?" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "→ Node 20"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" != "20" ]; then
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg rsync
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
fi
echo "   $(node -v) · npm $(npm -v)"

echo "→ Utilisateur $UTILISATEUR et dossiers"
id "$UTILISATEUR" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$UTILISATEUR"
install -d -o "$UTILISATEUR" -g "$UTILISATEUR" -m 750 "$BASE" "$BASE/app" "$BASE/app/logs"
# .env : créé vide s'il n'existe pas, rempli ensuite (voir README). 600 : les
# secrets ne sont lisibles que par gcn et root.
[ -f "$BASE/.env" ] || install -o "$UTILISATEUR" -g "$UTILISATEUR" -m 600 /dev/null "$BASE/.env"

install -d -o "$UTILISATEUR" -g "$UTILISATEUR" -m 700 "/home/$UTILISATEUR/.ssh"
{
  cat "$ICI/ci.pub"
  [ -f "$ICI/admin.pub" ] && cat "$ICI/admin.pub"
} | sort -u > "/home/$UTILISATEUR/.ssh/authorized_keys"
chown "$UTILISATEUR:$UTILISATEUR" "/home/$UTILISATEUR/.ssh/authorized_keys"
chmod 600 "/home/$UTILISATEUR/.ssh/authorized_keys"

echo "→ sudo : redémarrer et interroger le service, rien d'autre"
cat > /etc/sudoers.d/gcn-dashboard <<SUDO
$UTILISATEUR ALL=(root) NOPASSWD: /usr/bin/systemctl restart gcn-dashboard.service, /usr/bin/systemctl is-active gcn-dashboard.service, /usr/bin/journalctl -u gcn-dashboard.service *
SUDO
chmod 440 /etc/sudoers.d/gcn-dashboard
visudo -cf /etc/sudoers.d/gcn-dashboard >/dev/null

echo "→ Service systemd"
install -m 644 "$ICI/gcn-dashboard.service" /etc/systemd/system/gcn-dashboard.service
systemctl daemon-reload
systemctl enable gcn-dashboard.service >/dev/null 2>&1
# Pas de démarrage ici : l'application n'est pas encore déployée. Le premier
# deploy.sh la lance.

echo "→ Caddy : bloc gcn-data.fr"
CADDYFILE=/etc/caddy/Caddyfile
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if grep -qF "$DEBUT" "$CADDYFILE"; then
  # Remplace le bloc existant entre les marqueurs.
  awk -v d="$DEBUT" -v f="$FIN" -v src="$ICI/Caddyfile.gcn-data" '
    $0==d { print; while ((getline l < src) > 0) print l; skip=1; next }
    $0==f { skip=0 }
    !skip { print }' "$CADDYFILE" > "$TMP"
else
  { cat "$CADDYFILE"; echo; echo "$DEBUT"; cat "$ICI/Caddyfile.gcn-data"; echo "$FIN"; } > "$TMP"
fi
# Validation sous l'utilisateur caddy (la validation ouvre les journaux ; en
# root elle les créerait en root et le service ne pourrait plus les ouvrir).
install -o caddy -g caddy -m 644 "$TMP" /etc/caddy/Caddyfile.nouveau
if sudo -u caddy caddy validate --config /etc/caddy/Caddyfile.nouveau --adapter caddyfile >/dev/null 2>&1; then
  mv /etc/caddy/Caddyfile.nouveau "$CADDYFILE"
  systemctl reload caddy
  echo "   Caddyfile mis à jour et rechargé. gnaro.fr : $(curl -s -o /dev/null -w '%{http_code}' https://gnaro.fr/)"
else
  rm -f /etc/caddy/Caddyfile.nouveau
  echo "✗ Caddyfile invalide : l'ancien reste en place, rien n'a été rechargé." >&2
  sudo -u caddy caddy validate --config "$TMP" --adapter caddyfile 2>&1 | tail -5 >&2
  exit 1
fi

echo "✓ Serveur prêt. Suite : remplir $BASE/.env, puis deploy/deploy.sh."
