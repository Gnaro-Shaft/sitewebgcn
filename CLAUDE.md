# siteWeb — tableau de bord gcn-data.fr

Application **privée** : tableau de bord d'administration derrière login.
Le portfolio public n'existe plus : `/` redirige vers `/dashboard`, et les
anciennes URL `/blog/...` sont redirigées en 301 vers gnaro.fr par Caddy
(source unique : `server/config/redirections.js`).

## Stack
- `server/` : Express 5 + MongoDB (Mongoose), JWT (access + refresh), helmet, rate limit. Entrée : `server/server.js`, routes montées dans `server/app.js`.
- `client/` : React 19 + Vite + React Router 7 + Tailwind 4. Appels API via `client/src/api/axios.js` (baseURL `/api`).
- Déploiement : service systemd `gcn-dashboard` + bloc Caddy généré par `deploy/serveur/generer-caddy.js` (Caddy partagé avec gnaro sur le VPS).

## Commandes
- `npm run dev` : serveur (nodemon) — `npm run dev --prefix client` : front Vite
- `npm test` : tests unitaires (vitest) — `npm run test:integration` : tests d'intégration
- `npm run lint` : lint du client
- `node deploy/serveur/generer-caddy.js` : régénérer le Caddyfile après toute modif des redirections

## Règles
- Les règles du CLAUDE.md global s'appliquent (pas de secrets ni de `.env` commités, fichiers de code ≤ 400 lignes). Le hook `.githooks/pre-commit` les vérifie : `git config core.hooksPath .githooks`.
- **Contrat d'API : `docs/api-contract.md`.** C'est la référence entre `server/` et `client/`.
- Toute route nouvelle est `protect` ET `adminOnly` par défaut, sauf raison écrite dans le contrat.
- Commentaires et messages d'erreur utilisateur en français.

## Orchestration (sous-agents `server` et `client`)
- Seule la session principale modifie `docs/api-contract.md`.
- Nouveau widget ou évolution d'API : 1) mettre à jour le contrat, 2) déléguer à `server`, 3) puis à `client`.
- `server` et `client` peuvent tourner en parallèle seulement si le contrat est déjà figé pour la tâche.
- Après chaque délégation : lire les résumés, `git diff`, lancer `npm test`.
- Bugs à la frontière (auth, CORS, format de données) : à traiter dans la session principale, pas délégués.
