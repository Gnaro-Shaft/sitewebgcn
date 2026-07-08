# n8n sur homeserv01 — Setup complet

Guide de mise en place de l'automatisation LinkedIn Phase 24 : n8n tourne
sur homeserv01 en Tailscale-only, poll `gcn-data.fr/api/social/pending`
toutes les 5 min, poste sur LinkedIn + commente avec le lien blog, puis
notifie Fly du succès.

**Prérequis :**
- Ubuntu + Docker + docker compose plugin ✓ (déjà en place)
- Tailscale installé et enrôlé ✓ (déjà en place)
- Un compte LinkedIn perso (celui d'où partiront les posts)

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
Si tu le perds ET que tu wipes `n8n_data/`, tes credentials LinkedIn stored dans n8n sont irrécupérables.

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

## 5. Créer l'app LinkedIn Developer

C'est le morceau le plus pénible — LinkedIn a des workflows d'approbation lents pour certains produits. Mais "Share on LinkedIn" est généralement auto-approuvé pour un usage personnel.

1. Va sur https://www.linkedin.com/developers/apps
2. Clique **Create app**
3. Remplis :
   - **App name** : `GCN Blog Auto-Poster`
   - **LinkedIn Page** : ta page perso (ou une page entreprise si tu en as une). Si tu n'as pas de Page dédiée, tu peux en créer une en 30 sec sur LinkedIn.
   - **Privacy policy URL** : `https://gcn-data.fr` (ou n'importe quelle URL de ton site — LinkedIn ne vérifie pas le contenu)
   - **App logo** : n'importe quelle image PNG carrée
   - Coche les 2 checkboxes T&C
4. Clique **Create app**

### Configurer l'auth

- Onglet **Auth** :
  - **OAuth 2.0 redirect URLs** → ajoute : `https://<hostname>.<tailnet>.ts.net/rest/oauth2-credential/callback`
  - Copie **Client ID** + **Client Secret** (clique le petit œil sur secret pour révéler)

### Activer les produits

- Onglet **Products** :
  - Add **Share on LinkedIn** → généralement approuvé instantanément
  - Add **Sign In with LinkedIn using OpenID Connect** → également instant

**Note** : si tu veux poster au nom d'une Company Page (pas ton profil perso), il te faut le produit `Community Management API` qui nécessite une candidature LinkedIn avec délai. Pour un usage perso, on reste sur "Share on LinkedIn".

### Autoriser les scopes

Retourne dans **Auth** → tu devrais voir maintenant les OAuth 2.0 scopes disponibles :
- `openid`
- `profile`
- `email`
- `w_member_social` ← le scope critique pour poster

Ces scopes sont utilisables dès qu'ils apparaissent dans la liste.

## 6. Créer les credentials LinkedIn dans n8n

- Dans n8n → menu de gauche → **Credentials** → **+ Add Credential**
- Choisis **LinkedIn OAuth2 API**
- Remplis :
  - **Client ID** : ce que tu as copié depuis LinkedIn Auth
  - **Client Secret** : idem
  - **Scope** : `w_member_social openid profile email`
- Clique **Sign in with LinkedIn**
- Popup LinkedIn → login → autorise → redirection vers ton n8n → "Connected"
- Save

## 7. Créer les credentials HTTP pour l'API Fly

Pour authentifier les appels vers `gcn-data.fr/api/social/*` :

- **Credentials** → **+ Add** → **Header Auth**
- **Name** : `Fly n8n secret`
- **Header Name** : `X-N8N-Secret`
- **Header Value** : *le secret `N8N_SHARED_SECRET` que tu as ajouté aux Fly secrets*
- Save

## 8. Importer le workflow

Deux options :

**Option A — Import du JSON** (rapide)
- Menu → **Workflows** → **+ Add workflow** → menu 3 points en haut à droite → **Import from File**
- Sélectionne `workflows/linkedin-poll.json` (fourni dans ce même dossier)
- Ouvre chaque noeud pour affecter les credentials (n8n ne les importe pas — sécurité)

**Option B — Construction manuelle** (voir section 9 ci-dessous)

Une fois importé/construit :
- Clique le toggle **Active** en haut à droite → workflow armé

## 9. Structure du workflow (si tu construis manuellement)

```
[Schedule Trigger 5min]
        ↓
[HTTP Request : GET pending] ─ credentials Header Auth
        ↓
[IF count > 0] → sortie "true"
        ↓
[Split In Batches (1)]  ← itère item par item pour éviter les rate limits
        ↓
[LinkedIn : Create Post] ─ credentials LinkedIn OAuth2
   text = {{ $json.text }}
        ↓
[HTTP Request : Comment on post] ─ credentials LinkedIn OAuth2 (Custom Auth)
   POST https://api.linkedin.com/v2/socialActions/{{ $node["LinkedIn"].json.id }}/comments
   Body: {"actor":"{{ $node[LinkedIn].json.author }}","message":{"text":"{{ $node[Split].json.firstComment }}"}}
        ↓
[HTTP Request : mark-posted] ─ credentials Header Auth
   POST https://gcn-data.fr/api/social/mark-posted
   Body: {"articleId":"...","platform":"linkedin","postUrn":"...","commentUrn":"..."}

Sur erreur (Error Trigger connecté aux 3 dernières boîtes) :
[HTTP Request : mark-failed] ─ credentials Header Auth
```

Petit détail : le noeud LinkedIn Create Post renvoie un `id` qui EST l'URN du post — l'utiliser directement dans l'URL du commentaire.

## 10. Premier test

1. Sur `gcn-data.fr` admin → publie un article (ou marque un existant comme `queued` via ta Mongo Atlas directement)
2. Dans n8n → ouvre le workflow → clique **Execute Workflow** manuellement
3. Vérifie chaque noeud → clic droit sur le noeud → "Show input/output"
4. Si LinkedIn Node passe et Comment passe → vérifie sur LinkedIn que le post + commentaire sont bien là
5. Vérifie que l'article est marqué `posted` : `curl -H "X-N8N-Secret: $SECRET" https://gcn-data.fr/api/social/pending?platform=linkedin` → doit être vide

## 11. Backup

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

## 12. Troubleshooting

**"Callback URL mismatch"** en OAuth LinkedIn → vérifie que l'URL dans LinkedIn Auth EST EXACTEMENT celle demandée par n8n dans le popup. Souvent un slash final manquant.

**Workflow qui tourne mais rien ne se poste** → clique sur le noeud LinkedIn dans l'exécution → onglet Output → LinkedIn API a probablement renvoyé une erreur explicite (`403 forbidden` → scope manquant, `401 unauthorized` → token expiré → re-connect les credentials).

**n8n log spam "signature verification failed"** → tu as un LINKEDIN_WEBHOOK_URL qui traîne quelque part et fait des appels vers n8n. Nettoie.

**Basic auth loop infini** → cache navigateur, purge cookies homeserv01.YOUR-TAILNET.ts.net et retente.

## 13. Résumé des credentials à avoir sous la main

| Credential | Où c'est stocké |
|---|---|
| `N8N_ENCRYPTION_KEY` | ~/services/n8n/.env + password manager |
| `N8N_BASIC_AUTH_PASSWORD` | ~/services/n8n/.env + password manager |
| Owner account n8n (email + pwd) | password manager |
| LinkedIn Client ID + Secret | LinkedIn Developer console + password manager |
| `N8N_SHARED_SECRET` (Fly ↔ n8n) | Fly secrets + n8n Header Auth credential |

**5 secrets à gérer.** Cohérent avec la doctrine "un secret par frontière de trust".
