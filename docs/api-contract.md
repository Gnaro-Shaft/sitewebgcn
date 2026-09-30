# Contrat d'API — siteWeb (gcn-data.fr)

> Référence entre `server/` et `client/`. **Seule la session principale le modifie.**
> Généré le 2026-09-30 à partir de `server/app.js` et `server/routes/*.js`.
> Les formes JSON détaillées sont à compléter au fil des évolutions (section « Formes de réponse »).

## Conventions
- Préfixe : `/api` (client : `client/src/api/axios.js`).
- Succès : `{ success: true, ... }` — Erreur : `{ success: false, error: "message" }`.
- Auth : JWT access token en `Authorization: Bearer …` ; renouvellement via `/api/auth/refresh`.
- Niveaux : **public** · **protect** (tout utilisateur connecté) · **admin** (`protect` + `adminOnly`) · **cron** (en-tête `x-cron-secret`).
- Limites : `globalLimiter` sur `/api`, `authLimiter` sur `/api/auth`.

## Routes

| Méthode | Route | Accès | Consommée par (client) |
|---|---|---|---|
| POST | /auth/register | public ⚠️ | — |
| POST | /auth/login | public | context/AuthContext |
| POST | /auth/refresh | public (cookie refresh) | context/AuthContext |
| POST | /auth/logout | public | context/AuthContext |
| GET | /auth/me | protect | context/AuthContext |
| GET | /dashboard/widgets | protect | pages/Dashboard |
| PATCH | /dashboard/widgets | protect | pages/Dashboard |
| GET | /trading/trades?limit= | protect ⚠️ | widgets/TradesWidget |
| GET | /trading/trades/open | protect ⚠️ | widgets/TradesWidget |
| GET | /trading/performance?days= | protect ⚠️ | widgets/PerformanceWidget |
| GET | /trading/signals?limit= | protect ⚠️ | widgets/SignalsWidget |
| GET | /trading/decisions?… | protect ⚠️ | widgets/DecisionLogWidget |
| GET | /bot/status | protect ⚠️ | widgets/BotStatusWidget |
| GET | /lighthouse/latest | public | widgets/LighthouseWidget |
| POST | /lighthouse/refresh | cron (+ 1 appel / 30 min) | cron externe |
| GET | /gnaro/drafts | admin | pages/AdminGnaro |
| PATCH | /gnaro/drafts/:fichier/publish | admin | pages/AdminGnaro |
| DELETE | /gnaro/drafts/:fichier | admin | pages/AdminGnaro |
| GET | /gnaro/citations | admin | widgets/CitationsWidget, CitationsGrille |
| GET | /gnaro/sujets | admin | widgets/SujetsWidget |
| GET | /audience/resume | admin | pages/AdminAudience, AudienceWidget |
| GET | /tiktok/accounts | protect ⚠️ | pages/TikTokStudio |
| GET | /tiktok/auth-url/:niche | protect ⚠️ | pages/TikTokStudio |
| POST | /tiktok/connect | protect ⚠️ | pages/TikTokStudio |
| GET | /tiktok/profile/:niche | protect ⚠️ | pages/TikTokStudio |
| GET | /tiktok/videos/:niche | protect ⚠️ | pages/TikTokStudio |
| GET | /tiktok/creator-info/:niche | protect ⚠️ | pages/TikTokStudio |
| POST | /tiktok/publish (multipart `video`) | protect ⚠️ | pages/TikTokStudio |
| POST | /tiktok/upload-draft (multipart `video`) | protect ⚠️ | pages/TikTokStudio |
| DELETE | /tiktok/:niche | protect ⚠️ | pages/TikTokStudio |

## ⚠️ Point de sécurité ouvert (constaté le 2026-09-30, non corrigé)
`POST /auth/register` est public et crée un compte `role: user`. Or les routes marquées ⚠️
ne demandent que `protect` : **n'importe qui peut créer un compte puis lire les trades,
les signaux, le statut du bot, et piloter TikTok (connecter, publier, déconnecter).**
Correction proposée : fermer `/auth/register` (ou le limiter à une variable d'env), et passer
toutes les routes ⚠️ en `adminOnly`. À valider avant toute nouvelle fonctionnalité.

## Formes de réponse
À documenter route par route lors de la prochaine modification de chacune
(exemple JSON réel + champs obligatoires).
