# Registre des traitements — gcn-data.fr (tableau de bord)

Tenu au titre de l'article 30 du RGPD. Responsable : Genaro-Cédric Nisus,
EURL Gnaro. Mis à jour le 8 septembre 2026, à la suppression du site public
(gnaro.fr l'a remplacé le 2 septembre 2026).

Le tableau de bord est un espace personnel, à utilisateur unique, derrière un
login. Il ne reçoit aucun visiteur et n'a plus de formulaire public.

## Traitements en cours

| Traitement | Données | Personnes | Finalité | Base légale | Conservation | Sous-traitant |
| --- | --- | --- | --- | --- | --- | --- |
| Compte administrateur | e-mail, mot de passe haché (bcrypt), rôle, configuration des widgets | le responsable lui-même | authentification et personnalisation du tableau de bord | intérêt légitime (exploitation de son propre outil) | durée de vie du compte | MongoDB Atlas (AWS, UE) |
| Jetons de session | jeton de rafraîchissement, date d'expiration | idem | maintien de la session | idem | expiration automatique (index TTL) | MongoDB Atlas |
| Comptes TikTok connectés | identifiant de compte, jetons OAuth, date d'expiration | idem, comptes qu'il administre | publication de vidéos depuis le studio | consentement (OAuth) | jusqu'à déconnexion du compte | MongoDB Atlas, TikTok |
| Journal de sécurité | adresse IP des requêtes bloquées, horodatage | tiers émettant des requêtes hostiles | protection contre la force brute et les abus | intérêt légitime (sécurité) | à fixer, voir écart n° 1 | aucun (fichier local au serveur) |
| Journal des requêtes | adresse IP, chemin, agent utilisateur de chaque requête (morgan → journald) | toute personne joignant le serveur | diagnostic et sécurité | intérêt légitime | 14 jours (journald, `MaxRetentionSec`, posé par l'installateur) | aucun (VPS OVH) |

Sans donnée personnelle, hors registre : projets (titres, liens publics),
scores Lighthouse, données du bot de trading (positions, signaux), brouillons
gnaro.fr (fichiers Markdown du dépôt, aucune donnée de personne).

## Sous-traitants

| Sous-traitant | Rôle | Localisation | Statut |
| --- | --- | --- | --- |
| MongoDB Atlas | base de données | AWS, région UE | DPA standard MongoDB, à archiver |
| Cloudinary | images des projets (aucune donnée de personne) | UE/US selon le compte | à vérifier |
| Fly.io, puis VPS OVH | hébergement de l'application | Paris (cdg), puis France (OVH) | DPA Fly standard ; OVH : contrat hébergeur |
| GitHub | code, déploiement, appel hebdomadaire Lighthouse | US | aucune donnée de personne transmise |

## Traitements supprimés le 8 septembre 2026

Ces traitements appartenaient au site public. Le code a été retiré
(commits bdb6038, 0c2ed81), les données purgées d'Atlas le même jour.

| Traitement | Données qu'il contenait | Sort |
| --- | --- | --- |
| Mesure d'audience (pageviews) | chemin, référent, pays, appareil, navigateur, identifiant de session pseudonyme ; TTL 90 jours | collection supprimée |
| Assistant de rédaction IA (conversations, aiusages, profil rédactionnel) | conversations avec le modèle, compteurs d'usage, préférences de style | collections supprimées, sous-document `profile` retiré de l'utilisateur ; aucune donnée de tiers n'était envoyée au modèle, seulement les brouillons du responsable |
| CV dynamique (cvdatas) | parcours, formations, certifications du responsable | collection supprimée ; le CV vit sur gnaro.fr |
| Blog (articles) | textes, aucune donnée de personne hors l'auteur | exportés en Markdown hors dépôt, collection supprimée |
| Formulaire de contact | nom, e-mail, message — envoyés par e-mail, jamais stockés en base | route supprimée |
| File LinkedIn | identifiants de posts, aucune donnée de personne | supprimée avec le blog |

## Écarts connus

1. **Journal de sécurité** : le fichier des adresses bloquées n'a pas de
   durée de conservation définie ni de purge. À fixer à la migration sur le
   VPS (rotation, 14 jours comme les journaux Caddy de gnaro.fr).
2. **Sauvegardes Atlas** : si des instantanés existent, ils contiennent les
   collections purgées jusqu'à expiration de leur rétention. À vérifier dans
   la console Atlas ; `BACKUP_SECURITY.md` décrit une sauvegarde qui n'a pas
   été confirmée.
3. **Journaux applicatifs sur Fly** : l'ancien site a journalisé des
   adresses IP (morgan, format combined). Les machines Fly sont éphémères,
   les journaux disparaissent avec elles ; à confirmer à l'arrêt de Fly.
   Sur le VPS, le même journal est borné à quatorze jours depuis le
   8 septembre 2026.

## Droits des personnes

Seule personne concernée par les données en base : le responsable lui-même.
Pour les adresses IP du journal de sécurité, aucune identification n'est
possible sans les données de l'opérateur ; demande à traiter par suppression
de la ligne concernée.
