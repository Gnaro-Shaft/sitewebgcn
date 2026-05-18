const TikTokAccount = require('../models/TikTokAccount');
const tiktokService = require('../services/tiktokService');

/**
 * Wrapper de handler dédié TikTok : au lieu de passer l'erreur au errorHandler
 * global (qui masque le message en "Server Error" en production), on logge le
 * message réel et on le renvoie au client. Indispensable pour diagnostiquer les
 * erreurs de l'API TikTok (init, publish, scopes…).
 */
const asyncHandler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('[tiktok]', msg);
    res.status(502).json({ success: false, error: msg });
  }
};

// Niches autorisées pour la connexion d'un compte TikTok
const ALLOWED_NICHES = ['business-ia', 'actu', 'aion', 'finance', 'motivation', 'productivite'];

// Champs sûrs renvoyés au client (jamais les tokens)
function publicAccount(doc) {
  return {
    niche: doc.niche,
    openId: doc.openId,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl,
    scope: doc.scope,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/tiktok/accounts — liste les comptes TikTok connectés
exports.getAccounts = asyncHandler(async (req, res) => {
  const accounts = await TikTokAccount.find().sort({ niche: 1 });
  res.json({ success: true, data: accounts.map(publicAccount) });
});

// GET /api/tiktok/auth-url/:niche — URL d'autorisation OAuth pour une niche
exports.getAuthUrl = asyncHandler(async (req, res) => {
  const niche = req.params.niche || req.query.niche;
  if (!niche || !ALLOWED_NICHES.includes(niche)) {
    return res.status(400).json({ success: false, error: 'Niche invalide' });
  }
  const url = tiktokService.getAuthUrl(niche);
  res.json({ success: true, data: { url } });
});

// POST /api/tiktok/connect — body { niche, code } → échange le code OAuth
exports.connectAccount = asyncHandler(async (req, res) => {
  const { niche, code } = req.body;
  if (!niche || !ALLOWED_NICHES.includes(niche)) {
    return res.status(400).json({ success: false, error: 'Niche invalide' });
  }
  if (!code) {
    return res.status(400).json({ success: false, error: 'Code OAuth manquant' });
  }
  const account = await tiktokService.exchangeCode(niche, code);
  res.json({ success: true, data: publicAccount(account) });
});

// GET /api/tiktok/profile/:niche — profil + stats (rafraîchit aussi la DB)
exports.getProfile = asyncHandler(async (req, res) => {
  const account = await TikTokAccount.findOne({ niche: req.params.niche });
  if (!account) {
    return res.status(404).json({ success: false, error: 'Compte non connecte' });
  }
  const token = await tiktokService.getValidToken(account);
  const user = await tiktokService.fetchUserInfo(token);

  // Rafraîchit displayName / avatar en DB pour les afficher sans appel API
  if (user.display_name) account.displayName = user.display_name;
  if (user.avatar_url) account.avatarUrl = user.avatar_url;
  await account.save();

  res.json({
    success: true,
    data: {
      niche: account.niche,
      openId: user.open_id || account.openId,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      likesCount: user.likes_count || 0,
      videoCount: user.video_count || 0,
    },
  });
});

// GET /api/tiktok/videos/:niche — liste des vidéos publiées + métriques
exports.getVideos = asyncHandler(async (req, res) => {
  const account = await TikTokAccount.findOne({ niche: req.params.niche });
  if (!account) {
    return res.status(404).json({ success: false, error: 'Compte non connecte' });
  }
  const token = await tiktokService.getValidToken(account);
  const videos = await tiktokService.fetchVideoList(token);
  res.json({ success: true, data: videos });
});

// POST /api/tiktok/publish — multipart/form-data { niche, title, privacyLevel, video (fichier) }
exports.publish = asyncHandler(async (req, res) => {
  const fs = require('fs');
  const { niche, title, privacyLevel } = req.body;
  if (!niche) {
    return res.status(400).json({ success: false, error: 'Niche manquante' });
  }
  if (!req.file || !req.file.path) {
    return res.status(400).json({ success: false, error: 'Fichier video manquant' });
  }
  const account = await TikTokAccount.findOne({ niche });
  if (!account) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ success: false, error: 'Compte non connecte' });
  }

  try {
    // La vidéo est sur disque (multer diskStorage) — lue une fois, puis supprimée.
    const videoBuffer = fs.readFileSync(req.file.path);
    const token = await tiktokService.getValidToken(account);
    const result = await tiktokService.publishVideo({
      accessToken: token,
      videoBuffer,
      title,
      privacyLevel,
    });
    res.json({ success: true, data: result });
  } finally {
    // Toujours nettoyer le fichier temporaire.
    fs.unlink(req.file.path, () => {});
  }
});

// DELETE /api/tiktok/:niche — déconnecte (supprime) le compte
exports.disconnect = asyncHandler(async (req, res) => {
  const account = await TikTokAccount.findOneAndDelete({ niche: req.params.niche });
  if (!account) {
    return res.status(404).json({ success: false, error: 'Compte non connecte' });
  }
  res.json({ success: true, data: { niche: req.params.niche } });
});
