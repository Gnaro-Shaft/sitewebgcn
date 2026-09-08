# n8n sur homeserv01 — installation

n8n tourne sur homeserv01 en Tailscale-only. Ce document couvre son
installation : dossier, `.env`, démarrage, exposition HTTPS, sauvegarde.

**Ce que n8n fait tourner** est documenté dans le dépôt du site qu'il sert,
`gnaro/deploy/n8n/` : brouillon d'article, proposition de post et bilan
LinkedIn, veille. Tous parlent au Mac ou à Telegram, aucun n'appelle
gcn-data.fr.

> **Historique.** n8n a été installé en août 2026 (phase 24) pour une file
> LinkedIn qui interrogeait `gcn-data.fr/api/social/pending` toutes les
> cinq minutes. Cette file a été supprimée le 8 septembre 2026 avec le blog
> de gcn-data.fr, devenu tableau de bord personnel ; le workflow n'existe
> plus dans n8n et les identifiants LinkedIn créés pour lui (app
> « GCN Blog Auto-Poster », credential Header Auth « Fly n8n secret »)
> peuvent être révoqués.

**Prérequis :**
- Ubuntu + Docker + docker compose plugin ✓ (déjà en place)
- Tailscale installé et enrôlé ✓ (déjà en place)

---

## 1. Créer le dossier + le .env

Sur homeserv01, dans le dossier où tu veux (par exemple `~/services/n8n`) :

```bash
mkdir -p ~/services/n8n && cd ~/services/n8n
# Copie ces 2 fichiers depuis le repo siteWeb :
scp <ton-mac>:~/siteWeb/homeserv01/docker-compose.yml .
scp <ton-mac>:~/siteWeb/homeserv01/.env.example .env
```

Édite le `.env` :

```bash
# Générer les 2 secrets
openssl rand -hex 32   # → colle dans N8N_ENCRYPTION_KEY
openssl rand -hex 16   # → colle dans N8N_BASIC_AUTH_PASSWORD

# Trouver ton hostname Tailscale
tailscale status | head -2
# → colle la première colonne dans N8N_HOSTNAME (format: <machine>.<tailnet>.ts.net)
```

**⚠️ Sauvegarde `N8N_ENCRYPTION_KEY` ailleurs (password manager).**
Si tu le perds ET que tu wipes `n8n_data/`, les credentials stockés dans n8n (Telegram, jetons vers le Mac) sont irrécupérables.

## 2. Démarrer n8n

```bash
docker compose up -d
docker compose logs -f n8n  # ctrl+c pour sortir
```

Vérifie que le container tourne :

```bash
docker compose ps
# STATUS doit être "Up X seconds"
```

À ce stade, n8n écoute sur `127.0.0.1:5678` **seulement**. Il n'est accessible ni depuis internet, ni depuis Tailscale. Étape suivante : exposer via Tailscale Serve.

## 3. Exposer n8n via Tailscale Serve (HTTPS)

`tailscale serve` fait 2 choses cruciales :
- **Proxy HTTPS** depuis `https://<hostname>.<tailnet>.ts.net` vers `http://127.0.0.1:5678`
- **Certificat Let's Encrypt automatique** géré par Tailscale (pas de conf certbot à faire)

```bash
sudo tailscale serve --https 443 --bg http://127.0.0.1:5678
sudo tailscale serve status
```

Tu devrais voir :

```
https://homeserv01.YOUR-TAILNET.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:5678
```

Depuis ton laptop (sur Tailscale), ouvre `https://<hostname>.<tailnet>.ts.net` dans un browser. Basic auth prompt → user/pass du `.env`. Tu tombes sur l'écran de premier run n8n.

## 4. Premier run n8n

- Owner account (l'utilisateur admin de n8n, distinct du basic auth) : email + password → note-les
- n8n te propose une usage overview → skip
- Tu es dans le dashboard n8n

## 5. Backup

Nightly cron sur homeserv01 :

```bash
# ~/services/n8n/backup.sh
#!/usr/bin/env bash
set -e
DEST=~/backups/n8n
mkdir -p "$DEST"
STAMP=$(date +%F)
tar -czf "$DEST/n8n-$STAMP.tgz" -C ~/services/n8n n8n_data .env
# garde 30 jours
find "$DEST" -name 'n8n-*.tgz' -mtime +30 -delete
```

```bash
chmod +x ~/services/n8n/backup.sh
crontab -e
# ajoute :
0 4 * * * /home/YOU/services/n8n/backup.sh >> /home/YOU/services/n8n/backup.log 2>&1
```

## 6. Troubleshooting

**Basic auth loop infini** → cache navigateur, purge cookies homeserv01.YOUR-TAILNET.ts.net et retente.

## 7. Résumé des credentials à avoir sous la main

| Credential | Où c'est stocké |
|---|---|
| `N8N_ENCRYPTION_KEY` | ~/services/n8n/.env + password manager |
| `N8N_BASIC_AUTH_PASSWORD` | ~/services/n8n/.env + password manager |
| Owner account n8n (email + pwd) | password manager |

**3 secrets à gérer.** Les identifiants propres à chaque workflow sont
listés dans `gnaro/deploy/n8n/README.md`.
