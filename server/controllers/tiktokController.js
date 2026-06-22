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

// GET /api/tiktok/creator-info/:niche — infos du créateur pour pré-remplir l'UI
// publish conformément aux Content Sharing Guidelines TikTok.
exports.getCreatorInfo = asyncHandler(async (req, res) => {
  const account = await TikTokAccount.findOne({ niche: req.params.niche });
  if (!account) {
    return res.status(404).json({ success: false, error: 'Compte non connecte' });
  }
  const token = await tiktokService.getValidToken(account);
  const info = await tiktokService.fetchCreatorInfo(token);
  res.json({ success: true, data: info });
});

// POST /api/tiktok/publish — multipart/form-data
// Body: { niche, title, privacyLevel, disableComment, disableDuet, disableStitch,
//         brandContentToggle, brandOrganicToggle, video (fichier) }
exports.publish = asyncHandler(async (req, res) => {
  const fs = require('fs');
  const {
    niche,
    title,
    privacyLevel,
    disableComment,
    disableDuet,
    disableStitch,
    brandContentToggle,
    brandOrganicToggle,
  } = req.body;
  if (!niche) {
    return res.status(400).json({ success: false, error: 'Niche manquante' });
  }
  if (!privacyLevel) {
    return res.status(400).json({
      success: false,
      error: 'privacy_level requis (selection utilisateur explicite)',
    });
  }
  if (!req.file || !req.file.path) {
    return res.status(400).json({ success: false, error: 'Fichier video manquant' });
  }
  const account = await TikTokAccount.findOne({ niche });
  if (!account) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ success: false, error: 'Compte non connecte' });
  }

  // Helper : 'true' / true → true, sinon false (formdata envoie tout en string)
  const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';

  try {
    const videoBuffer = fs.readFileSync(req.file.path);
    const token = await tiktokService.getValidToken(account);
    const result = await tiktokService.publishVideo({
      accessToken: token,
      videoBuffer,
      title,
      privacyLevel,
      disableComment: truthy(disableComment),
      disableDuet: truthy(disableDuet),
      disableStitch: truthy(disableStitch),
      brandContentToggle: truthy(brandContentToggle),
      brandOrganicToggle: truthy(brandOrganicToggle),
    });
    res.json({ success: true, data: result });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// POST /api/tiktok/upload-draft — multipart/form-data { niche, video (fichier) }
// Upload en BROUILLON TikTok : pas de title/privacy ici, le créateur finalise
// depuis l'app TikTok. Pas de restriction unaudited_client.
exports.uploadDraft = asyncHandler(async (req, res) => {
  const fs = require('fs');
  const { niche } = req.body;
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
    const videoBuffer = fs.readFileSync(req.file.path);
    const token = await tiktokService.getValidToken(account);
    const result = await tiktokService.uploadToInbox({
      accessToken: token,
      videoBuffer,
    });
    res.json({ success: true, data: result });
  } finally {
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
