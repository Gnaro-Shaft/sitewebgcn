const mongoose = require('mongoose');

// One doc per TikTok account connected via OAuth.
// Keyed by `niche` — l'identifiant logique du compte (ex "business-ia").
const tikTokAccountSchema = new mongoose.Schema(
  {
    // Identifiant du compte / niche (business-ia, actu, aion, finance, motivation, productivite)
    niche: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    // Identifiant unique TikTok de l'utilisateur autorisé
    openId: {
      type: String,
    },
    // Tokens OAuth — access_token (court) + refresh_token (≈ 365 jours)
    accessToken: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    // Scopes accordés (séparés par des virgules)
    scope: {
      type: String,
    },
    // Expiration de l'access_token
    expiresAt: {
      type: Date,
    },
    // Expiration du refresh_token
    refreshExpiresAt: {
      type: Date,
    },
    // Infos de profil rafraîchies depuis l'API user/info
    displayName: {
      type: String,
    },
    avatarUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TikTokAccount', tikTokAccountSchema);
