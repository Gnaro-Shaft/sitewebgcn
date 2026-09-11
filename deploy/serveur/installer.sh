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
# et dépose le bloc gcn-data.fr dans /etc/caddy/conf.d, que le Caddyfile de
# gnaro importe, après validation. Rejouable : chaque étape vérifie l'état
# avant d'agir.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE=/opt/gcn-dashboard
UTILISATEUR=gcn
# Marqueurs de l'ancien bloc en ligne : ils ne servent plus qu'à le retirer
# des serveurs installés avant le 11 septembre 2026.
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

echo "→ Journal système : rétention de quatorze jours"
# Express journalise chaque requête avec l'adresse IP du client (morgan,
# format combined) et ces lignes vont dans journald. Une adresse IP est une
# donnée personnelle : même durée que les journaux d'accès Caddy de gnaro.fr,
# quatorze jours, annoncée dans docs/conformite/registre-traitements.md.
# Le réglage vaut pour tout le journal de la machine.
install -d -m 755 /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/retention.conf <<JOURNAL
# Posé par siteWeb/deploy/serveur/installer.sh — voir registre des traitements.
[Journal]
MaxRetentionSec=14day
SystemMaxUse=500M
JOURNAL
systemctl restart systemd-journald
journalctl --vacuum-time=14d >/dev/null 2>&1 || true
echo "   $(systemd-analyze cat-config systemd/journald.conf 2>/dev/null | grep -E '^MaxRetentionSec' | tail -1)"

echo "→ Caddy : bloc gcn-data.fr dans conf.d"
CADDYFILE=/etc/caddy/Caddyfile
CONFD=/etc/caddy/conf.d
# Le Caddyfile principal appartient au dépôt gnaro, dont l'installeur le
# réécrit INTÉGRALEMENT. Y injecter notre bloc entre deux marqueurs, comme on
# le faisait, le condamnait à disparaître à la première mise à jour du site
# public : c'est ce qui a mis gcn-data.fr hors ligne le 11 septembre 2026,
# sans une ligne d'erreur nulle part. On écrit désormais dans conf.d, que le
# Caddyfile importe et que l'installeur de gnaro ne touche pas.
# Ordre imposé : le Caddyfile de gnaro doit déjà importer conf.d, sinon notre
# bloc y atterrirait sans être lu et le tableau de bord resterait hors ligne.
grep -qF 'import /etc/caddy/conf.d/' "$CADDYFILE" || {
  echo "✗ Le Caddyfile n'importe pas conf.d : mettre gnaro.fr à jour d'abord" >&2
  echo "  (dépôt gnaro, deploy/serveur/preparer.sh), puis relancer celui-ci." >&2
  exit 1
}
install -d -o root -g root -m 755 "$CONFD"
SAUVE=""
[ -f "$CONFD/gcn-data.caddy" ] && { SAUVE="$(mktemp)"; cp -a "$CONFD/gcn-data.caddy" "$SAUVE"; }
install -o root -g root -m 644 "$ICI/Caddyfile.gcn-data" "$CONFD/gcn-data.caddy"

TMP="$(mktemp)"
trap 'rm -f "$TMP" ${SAUVE:+"$SAUVE"}' EXIT
# Migration : retirer l'ancien bloc en ligne s'il traîne encore, sinon Caddy
# voit deux fois les mêmes adresses de site et refuse toute la configuration.
if grep -qF "$DEBUT" "$CADDYFILE"; then
  echo "   ancien bloc en ligne trouvé : retrait du Caddyfile"
  awk -v d="$DEBUT" -v f="$FIN" '
    $0==d { skip=1; next }
    $0==f { skip=0; next }
    !skip { print }' "$CADDYFILE" > "$TMP"
else
  cat "$CADDYFILE" > "$TMP"
fi

# La validation porte sur le Caddyfile candidat, qui importe le conf.d qu'on
# vient d'écrire : elle juge l'ensemble, pas notre bloc isolé. Sous
# l'utilisateur caddy (en root elle créerait les journaux en root et le
# service ne pourrait plus les ouvrir).
if sudo -u caddy caddy validate --config "$TMP" --adapter caddyfile >/dev/null 2>&1; then
  install -o root -g root -m 644 "$TMP" "$CADDYFILE"
  systemctl reload caddy
else
  # Rien ne doit rester de notre passage si la configuration est mauvaise.
  if [ -n "$SAUVE" ]; then cp -a "$SAUVE" "$CONFD/gcn-data.caddy"; else rm -f "$CONFD/gcn-data.caddy"; fi
  echo "✗ Configuration invalide : l'ancienne reste en place, rien n'a été rechargé." >&2
  sudo -u caddy caddy validate --config "$TMP" --adapter caddyfile 2>&1 | tail -5 >&2
  exit 1
fi

echo "→ Vérification des domaines servis"
# Ce Caddy est partagé. Vérifier gcn-data.fr ne suffirait pas : une
# configuration qui repart sans un voisin se recharge sans erreur et le laisse
# injoignable. On interroge donc chaque domaine déclaré, ici et dans conf.d.
sleep 2
DOMAINES="$(cat "$CADDYFILE" "$CONFD"/*.caddy 2>/dev/null \
  | grep -E '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,} \{$' | sed 's/ {$//' | sort -u || true)"
MANQUE=0
for d in $DOMAINES; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$d/" 2>/dev/null || echo 000)"
  case "$code" in
    2*|3*) echo "   $d : $code" ;;
    *)     echo "   ✗ $d : $code" >&2; MANQUE=1 ;;
  esac
done
[ "$MANQUE" -eq 0 ] || { echo "✗ Un domaine au moins ne répond plus après le rechargement." >&2; exit 1; }

echo "✓ Serveur prêt. Suite : remplir $BASE/.env, puis deploy/deploy.sh."
