/**
 * Service TikTok — OAuth, profil, vidéos et publication.
 *
 * Réimplémentation CommonJS de la logique TikTok (auth + analytics + publish).
 * Les tokens sont persistés dans le model TikTokAccount (un doc par niche).
 *
 * Credentials requis (variables d'environnement) :
 *   - TIKTOK_CLIENT_KEY
 *   - TIKTOK_CLIENT_SECRET
 *   - TIKTOK_REDIRECT_URI
 */
const TikTokAccount = require('../models/TikTokAccount');

// --- URLs API TikTok --------------------------------------------------------
const AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';
const PUBLISH_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const PUBLISH_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';

const SCOPES = ['user.info.basic', 'user.info.stats', 'video.list', 'video.publish'];

// --- Helpers credentials ----------------------------------------------------
function requireTikTokEnv() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error(
      'Credentials TikTok manquants — definir TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI'
    );
  }
  return { clientKey, clientSecret, redirectUri };
}

/**
 * Construit l'URL d'autorisation TikTok. Le `state` encode la niche afin que la
 * page de callback puisse identifier quel compte est en cours de connexion.
 */
function getAuthUrl(niche) {
  const { clientKey, redirectUri } = requireTikTokEnv();
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state: `niche:${niche}`,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

// --- Échange / refresh de tokens -------------------------------------------
async function postToken(body) {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(
      `TikTok token error: ${data.error || resp.status} — ${data.error_description || ''}`
    );
  }
  return data;
}

// Calcule les dates d'expiration absolues à partir des durées renvoyées par TikTok
function expiryDates(data) {
  const now = Date.now();
  return {
    expiresAt: new Date(now + data.expires_in * 1000),
    refreshExpiresAt: new Date(now + data.refresh_expires_in * 1000),
  };
}

/**
 * Échange le code OAuth (récupéré sur la page de callback) contre des tokens,
 * puis upsert le TikTokAccount correspondant à la niche.
 */
async function exchangeCode(niche, code) {
  const { clientKey, clientSecret, redirectUri } = requireTikTokEnv();
  const data = await postToken({
    client_key: clientKey,
    client_secret: clientSecret,
    code: String(code).trim(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const { expiresAt, refreshExpiresAt } = expiryDates(data);

  const account = await TikTokAccount.findOneAndUpdate(
    { niche },
    {
      niche,
      openId: data.open_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scope: data.scope,
      expiresAt,
      refreshExpiresAt,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return account;
}

/** Rafraîchit l'access_token d'un compte via son refresh_token, et sauvegarde. */
async function refreshToken(account) {
  const { clientKey, clientSecret } = requireTikTokEnv();
  if (account.refreshExpiresAt && Date.now() >= account.refreshExpiresAt.getTime()) {
    throw new Error(
      `Refresh token expire pour ${account.niche} — relancer l'autorisation OAuth`
    );
  }
  const data = await postToken({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
  });
  const { expiresAt, refreshExpiresAt } = expiryDates(data);

  account.accessToken = data.access_token;
  account.refreshToken = data.refresh_token;
  account.scope = data.scope;
  account.expiresAt = expiresAt;
  account.refreshExpiresAt = refreshExpiresAt;
  if (data.open_id) account.openId = data.open_id;
  await account.save();
  return account.accessToken;
}

/**
 * Retourne un access_token valide pour un compte, en le rafraîchissant
 * automatiquement s'il est expiré (marge de sécurité de 60s).
 */
async function getValidToken(account) {
  if (!account || !account.accessToken) {
    throw new Error('Compte TikTok non connecte');
  }
  const expMs = account.expiresAt ? account.expiresAt.getTime() : 0;
  if (Date.now() >= expMs - 60_000) {
    return refreshToken(account);
  }
  return account.accessToken;
}

// --- Profil & vidéos --------------------------------------------------------
/** GET /v2/user/info/ — infos de profil + stats du compte. */
async function fetchUserInfo(accessToken) {
  const fields =
    'open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count';
  const resp = await fetch(`${USER_INFO_URL}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok || (data.error && data.error.code !== 'ok')) {
    throw new Error(
      `TikTok user/info echoue: ${data.error && data.error.code} — ${
        (data.error && data.error.message) || resp.status
      }`
    );
  }
  return (data.data && data.data.user) || {};
}

/** POST /v2/video/list/ — liste des vidéos publiées + métriques. */
async function fetchVideoList(accessToken, maxCount = 20) {
  const fields =
    'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count';
  const resp = await fetch(`${VIDEO_LIST_URL}?fields=${fields}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ max_count: Math.min(maxCount, 20) }),
  });
  const data = await resp.json();
  if (!resp.ok || (data.error && data.error.code !== 'ok')) {
    throw new Error(
      `TikTok video/list echoue: ${data.error && data.error.code} — ${
        (data.error && data.error.message) || resp.status
      }`
    );
  }
  return (data.data && data.data.videos) || [];
}

// --- Publication ------------------------------------------------------------
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

// Poll le statut de publication jusqu'à un état terminal.
async function pollPublishStatus(accessToken, publishId, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const resp = await fetch(PUBLISH_STATUS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await resp.json();
    const status = data.data && data.data.status;
    if (status === 'PUBLISH_COMPLETE') return status;
    if (status === 'FAILED') {
      throw new Error(
        `TikTok publication echouee: ${(data.data && data.data.fail_reason) || 'raison inconnue'}`
      );
    }
    // SEND_TO_USER_INBOX = uploade en brouillon (mode non audite), considere OK.
    if (status === 'SEND_TO_USER_INBOX') return status;
  }
  return 'PROCESSING_TIMEOUT';
}

/**
 * Publie une vidéo via la Content Posting API (méthode FILE_UPLOAD).
 * Flow : init → upload chunked (PUT) → poll status.
 * privacyLevel défaut 'SELF_ONLY' (obligatoire tant que l'app n'est pas auditée).
 */
async function publishVideo({ accessToken, videoBuffer, title, privacyLevel }) {
  if (!videoBuffer || !videoBuffer.length) {
    throw new Error('Buffer video vide');
  }
  const videoSize = videoBuffer.length;

  // TikTok exige la vidéo en un seul chunk si < 64MB, sinon découpage.
  const chunkSize = videoSize <= 64 * 1024 * 1024 ? videoSize : CHUNK_SIZE;
  const totalChunkCount = Math.ceil(videoSize / chunkSize);

  // --- 1. INIT --------------------------------------------------------------
  const initBody = {
    post_info: {
      title: String(title || '').slice(0, 2200),
      privacy_level: privacyLevel || 'SELF_ONLY',
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount,
    },
  };

  const initResp = await fetch(PUBLISH_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(initBody),
  });
  const initData = await initResp.json();
  if (!initResp.ok || !initData.error || initData.error.code !== 'ok') {
    throw new Error(
      `TikTok init echoue: ${initData.error && initData.error.code} — ${
        (initData.error && initData.error.message) || initResp.status
      }`
    );
  }
  const { publish_id, upload_url } = initData.data;

  // --- 2. UPLOAD ------------------------------------------------------------
  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, videoSize) - 1;
    const chunk = videoBuffer.subarray(start, end + 1);
    const uploadResp = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      },
      body: new Uint8Array(chunk),
    });
    if (!uploadResp.ok && uploadResp.status !== 201 && uploadResp.status !== 206) {
      throw new Error(
        `TikTok upload chunk ${i + 1}/${totalChunkCount} echoue: HTTP ${uploadResp.status}`
      );
    }
  }

  // --- 3. POLL STATUS -------------------------------------------------------
  const status = await pollPublishStatus(accessToken, publish_id);
  return { publishId: publish_id, status };
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getValidToken,
  fetchUserInfo,
  fetchVideoList,
  publishVideo,
};
