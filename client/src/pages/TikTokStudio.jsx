import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';

// Niches autorisées pour la connexion d'un compte TikTok
const NICHES = ['business-ia', 'actu', 'aion', 'finance', 'motivation', 'productivite'];

// Labels FR pour les codes privacy renvoyés par creator_info.privacy_level_options.
// On NE garde PAS de liste statique : seules les options autorisées par TikTok
// pour ce créateur précis sont affichées (conformité Content Sharing Guidelines).
const PRIVACY_LABELS = {
  SELF_ONLY: 'Privé (moi seul)',
  FOLLOWER_OF_CREATOR: 'Abonnés',
  MUTUAL_FOLLOW_FRIENDS: 'Amis',
  PUBLIC_TO_EVERYONE: 'Public',
};

export default function TikTokStudio() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // État du formulaire de connexion d'un nouveau compte
  const [connectNiche, setConnectNiche] = useState(NICHES[0]);
  const [connectCode, setConnectCode] = useState('');
  const [connecting, setConnecting] = useState(false);

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/tiktok/accounts')
      .then((res) => setAccounts(res.data.data || []))
      .catch(() => setError('Impossible de charger les comptes TikTok'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Ouvre l'URL d'autorisation OAuth dans un nouvel onglet
  const openAuth = async () => {
    try {
      const res = await api.get(`/tiktok/auth-url/${connectNiche}`);
      window.open(res.data.data.url, '_blank', 'noopener');
    } catch {
      setError("Impossible de generer l'URL d'autorisation");
    }
  };

  // Valide le code OAuth collé par l'utilisateur
  const submitCode = async () => {
    if (!connectCode.trim()) return;
    setConnecting(true);
    setError('');
    try {
      await api.post('/tiktok/connect', {
        niche: connectNiche,
        code: connectCode.trim(),
      });
      setConnectCode('');
      fetchAccounts();
    } catch (e) {
      setError(e?.response?.data?.error || 'Echec de la connexion du compte');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg2/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
              G<span className="text-accent">.</span>
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-accent dark:text-dark-muted">
              Dashboard
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">TikTok Studio</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">TikTok Studio</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-muted">
            Connectez vos comptes TikTok, consultez les statistiques et publiez vos vidéos.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Connexion d'un nouveau compte */}
        <div className="mb-8 bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-5">
          <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">Connecter un compte</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">Niche</label>
              <select
                value={connectNiche}
                onChange={(e) => setConnectNiche(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg"
              >
                {NICHES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={openAuth}
              className="px-4 py-1.5 text-sm font-medium border border-gray-200 dark:border-dark-border hover:border-accent hover:text-accent text-gray-600 dark:text-dark-muted rounded-lg transition-colors"
            >
              1. Ouvrir l'autorisation TikTok
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3 mt-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
                2. Coller le code récupéré sur la page de callback
              </label>
              <input
                type="text"
                value={connectCode}
                onChange={(e) => setConnectCode(e.target.value)}
                placeholder="code OAuth..."
                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg"
              />
            </div>
            <button
              onClick={submitCode}
              disabled={connecting || !connectCode.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-dark-bg rounded-lg transition-colors disabled:opacity-50"
            >
              {connecting ? 'Validation…' : 'Valider'}
            </button>
          </div>
        </div>

        {/* Liste des comptes connectés */}
        {loading && <div className="text-gray-400 dark:text-dark-muted">Loading…</div>}

        {!loading && accounts.length === 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg text-sm">
            Aucun compte TikTok connecté pour l'instant.
          </div>
        )}

        {!loading && accounts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((acc) => (
              <AccountCard key={acc.niche} account={acc} onDisconnect={fetchAccounts} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// --- Carte d'un compte connecté --------------------------------------------
function AccountCard({ account, onDisconnect }) {
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [cardError, setCardError] = useState('');

  // Charge le profil + stats au montage de la carte
  useEffect(() => {
    api
      .get(`/tiktok/profile/${account.niche}`)
      .then((res) => setProfile(res.data.data))
      .catch(() => setCardError('Profil indisponible (token expiré ?)'));
  }, [account.niche]);

  const loadVideos = async () => {
    setBusy(true);
    setCardError('');
    try {
      const res = await api.get(`/tiktok/videos/${account.niche}`);
      setVideos(res.data.data || []);
    } catch (e) {
      setCardError(e?.response?.data?.error || 'Impossible de charger les vidéos');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(`Déconnecter le compte "${account.niche}" ?`)) return;
    setBusy(true);
    try {
      await api.delete(`/tiktok/${account.niche}`);
      onDisconnect();
    } catch {
      setCardError('Echec de la déconnexion');
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-5">
      {/* En-tête : avatar + nom + niche */}
      <div className="flex items-center gap-3">
        {(profile?.avatarUrl || account.avatarUrl) ? (
          <img
            src={profile?.avatarUrl || account.avatarUrl}
            alt=""
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-dark-bg3 flex items-center justify-center text-gray-400 text-lg">
            {account.niche[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-semibold text-gray-900 dark:text-dark-text">
            {profile?.displayName || account.displayName || account.niche}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted font-mono">{account.niche}</div>
        </div>
      </div>

      {/* Stats du compte */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat label="Followers" value={profile?.followerCount} />
        <Stat label="Likes" value={profile?.likesCount} />
        <Stat label="Vidéos" value={profile?.videoCount} />
      </div>

      {cardError && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400">{cardError}</div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={loadVideos}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-dark-border hover:border-accent hover:text-accent text-gray-600 dark:text-dark-muted rounded-lg transition-colors disabled:opacity-50"
        >
          Voir les vidéos
        </button>
        <button
          onClick={() => setShowPublish((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-dark-border hover:border-accent hover:text-accent text-gray-600 dark:text-dark-muted rounded-lg transition-colors"
        >
          Publier une vidéo
        </button>
        <button
          onClick={disconnect}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-dark-border hover:border-red-500 hover:text-red-500 text-gray-600 dark:text-dark-muted rounded-lg transition-colors disabled:opacity-50"
        >
          Déconnecter
        </button>
      </div>

      {/* Formulaire de publication */}
      {showPublish && (
        <PublishForm niche={account.niche} onError={setCardError} />
      )}

      {/* Liste des vidéos */}
      {videos && (
        <div className="mt-4 border-t border-gray-100 dark:border-dark-border pt-4">
          {videos.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-dark-muted">Aucune vidéo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 dark:text-dark-muted uppercase tracking-wider">
                  <th className="py-2">Titre</th>
                  <th className="py-2 text-right">Vues</th>
                  <th className="py-2 text-right">Likes</th>
                  <th className="py-2 text-right">Comm.</th>
                  <th className="py-2 text-right">Partages</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id} className="border-t border-gray-100 dark:border-dark-border">
                    <td className="py-2 text-gray-700 dark:text-dark-text truncate max-w-[160px]">
                      {v.title || '(sans titre)'}
                    </td>
                    <td className="py-2 text-right text-accent font-medium">{v.view_count ?? 0}</td>
                    <td className="py-2 text-right text-gray-500 dark:text-dark-muted">{v.like_count ?? 0}</td>
                    <td className="py-2 text-right text-gray-500 dark:text-dark-muted">{v.comment_count ?? 0}</td>
                    <td className="py-2 text-right text-gray-500 dark:text-dark-muted">{v.share_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// --- Formulaire de publication ---------------------------------------------
// PublishForm — conforme aux Content Sharing Guidelines TikTok 2026 :
// - Affiche creator_info (nickname/avatar) à chaque post
// - Privacy dropdown SANS valeur par défaut (sélection manuelle obligatoire)
// - Interaction settings (Comment/Duet/Stitch) non cochés par défaut, greyed
//   si désactivés au niveau du compte
// - Commercial Content Disclosure toggle (off par défaut)
// - Distinction Brand Organic (« Ma marque ») vs Branded Content (« Contenu
//   sponsorisé »), avec contrainte privacy ≠ SELF_ONLY pour Branded Content
// - Music Usage Confirmation déclaration avant publish (consentement explicite)
// - Preview vidéo avant publish
// - Hashtags éditables dans le titre
function PublishForm({ niche, onError }) {
  // Fichiers + contenu
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);

  // Infos créateur (fetch à l'ouverture)
  const [creatorInfo, setCreatorInfo] = useState(null);
  const [creatorInfoError, setCreatorInfoError] = useState('');

  // Privacy — pas de valeur par défaut (exigence TikTok UX)
  const [privacy, setPrivacy] = useState('');

  // Interaction settings — tous décochés par défaut. State = `allow*` (= ce que
  // l'user veut autoriser). À l'envoi : disable_* = !allow_*.
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);

  // Commercial content disclosure
  const [commercialDisclosure, setCommercialDisclosure] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);

  // Consentement utilisateur explicite avant publish
  const [consent, setConsent] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState('');

  // --- Fetch creator info quand la niche change ---
  useEffect(() => {
    if (!niche) return;
    setCreatorInfo(null);
    setCreatorInfoError('');
    api
      .get(`/tiktok/creator-info/${niche}`)
      .then((res) => setCreatorInfo(res.data.data))
      .catch((e) => setCreatorInfoError(e?.response?.data?.error || 'Erreur creator_info'));
  }, [niche]);

  // --- Video preview via Object URL ---
  useEffect(() => {
    if (!file) { setPreviewUrl(null); setVideoDuration(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setVideoDuration(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // --- File picker / drag-drop : .mp4 + .txt auto-chargés ---
  const applySlotFiles = async (files) => {
    const mp4 = files.find((f) => f.name.toLowerCase().endsWith('.mp4'));
    const txt = files.find((f) => f.name.toLowerCase().endsWith('.txt'));
    if (mp4) setFile(mp4);
    if (txt) {
      const text = await txt.text();
      setTitle(text.trim().slice(0, 2200));
    }
  };

  // --- Dérivés ---
  const privacyOptions = (creatorInfo?.privacy_level_options || []).map((v) => ({
    value: v,
    label: PRIVACY_LABELS[v] || v,
  }));
  const commentDisabledAtAccount = creatorInfo?.comment_disabled || false;
  const duetDisabledAtAccount = creatorInfo?.duet_disabled || false;
  const stitchDisabledAtAccount = creatorInfo?.stitch_disabled || false;
  const brandedContentForcesPublic = brandedContent && privacy === 'SELF_ONLY';
  const commercialDiscloseValid = !commercialDisclosure || yourBrand || brandedContent;

  // 1c — La vidéo doit respecter la durée max retournée par creator_info.
  const maxDurationSec = creatorInfo?.max_video_post_duration_sec || null;
  const videoTooLong =
    !!videoDuration && !!maxDurationSec && videoDuration > maxDurationSec;

  // Texte de déclaration légale (Music Usage Confirmation, ou + Branded Content
  // Policy selon les options sélectionnées) — exigence TikTok.
  const declarationText =
    commercialDisclosure && brandedContent
      ? 'En postant, vous acceptez la Branded Content Policy et la Music Usage Confirmation de TikTok.'
      : 'En postant, vous acceptez la Music Usage Confirmation de TikTok.';

  const canPublish =
    !!file &&
    !!privacy &&
    commercialDiscloseValid &&
    !brandedContentForcesPublic &&
    !videoTooLong &&
    consent &&
    !publishing;

  // Tooltip d'aide pour le bouton publish (exigence doc TikTok 3a : si commercial
  // disclosure on et aucune option cochée, hover doit prompt l'utilisateur).
  const publishHint =
    commercialDisclosure && !yourBrand && !brandedContent
      ? "You need to indicate if your content promotes yourself, a third party, or both."
      : videoTooLong
      ? `La vidéo dépasse la durée max autorisée pour ce compte (${maxDurationSec}s).`
      : !consent
      ? 'Coche la déclaration TikTok avant de publier.'
      : '';

  const submit = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setResult('');
    onError('');
    try {
      const form = new FormData();
      form.append('niche', niche);
      form.append('title', title);
      form.append('privacyLevel', privacy);
      form.append('disableComment', String(!allowComment));
      form.append('disableDuet', String(!allowDuet));
      form.append('disableStitch', String(!allowStitch));
      form.append('brandContentToggle', String(brandedContent));
      form.append('brandOrganicToggle', String(yourBrand));
      form.append('video', file);
      const res = await api.post('/tiktok/publish', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // 5d — Doc TikTok : prévenir l'utilisateur que la vidéo peut mettre
      // quelques minutes à apparaître sur le profil après publication.
      setResult(
        `Publication : ${res.data.data.status}. ` +
          'La vidéo peut prendre quelques minutes à apparaître sur le profil TikTok.'
      );
    } catch (e) {
      onError(e?.response?.data?.error || 'Echec de la publication');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-dark-border pt-4 space-y-3">
      {/* Bannière créateur (creator_info) — affichage obligatoire à chaque post */}
      {creatorInfo ? (
        <div className="flex items-center gap-3 p-3 bg-accent/10 border border-accent/20 rounded-lg">
          {creatorInfo.creator_avatar_url && (
            <img
              src={creatorInfo.creator_avatar_url}
              alt=""
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              Publication vers{' '}
              <span className="text-accent">
                @{creatorInfo.creator_username || creatorInfo.creator_nickname}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-dark-muted">
              {creatorInfo.creator_nickname}
              {creatorInfo.max_video_post_duration_sec
                ? ` · durée max ${creatorInfo.max_video_post_duration_sec}s`
                : ''}
            </div>
          </div>
        </div>
      ) : creatorInfoError ? (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-xs">
          ⚠️ Impossible de charger les infos créateur : {creatorInfoError}
        </div>
      ) : (
        <div className="p-3 bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg text-xs text-gray-500 dark:text-dark-muted">
          Chargement des infos créateur…
        </div>
      )}

      {/* File picker / drag-drop */}
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
          Fichiers du slot (.mp4 + .txt)
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const items = Array.from(e.dataTransfer.items || []);
            const files = [];
            for (const it of items) {
              if (it.kind !== 'file') continue;
              const entry = it.webkitGetAsEntry?.();
              if (entry && entry.isDirectory) {
                await new Promise((resolve) => {
                  const reader = entry.createReader();
                  reader.readEntries((entries) => {
                    Promise.all(entries.map((ent) => new Promise((res) => {
                      if (ent.isFile) ent.file((f) => { files.push(f); res(); });
                      else res();
                    }))).then(resolve);
                  });
                });
              } else {
                const f = it.getAsFile();
                if (f) files.push(f);
              }
            }
            await applySlotFiles(files);
          }}
          className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-3 hover:border-accent transition-colors"
        >
          <input
            type="file"
            multiple
            accept="video/mp4,.txt,text/plain"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              await applySlotFiles(files);
            }}
            className="w-full text-sm text-gray-600 dark:text-dark-muted"
          />
          <p className="text-[10px] text-gray-400 dark:text-dark-muted mt-2">
            📂 <strong>Cmd+clic</strong> pour le <code>.mp4</code> + le <code>.txt</code>, ou <strong>glisse-dépose</strong> le dossier du slot ici.
          </p>
          <p className="text-[11px] mt-2 min-h-[14px]">
            {file && <span className="text-green-600 dark:text-accent">✓ {file.name}</span>}
            {file && title && <span className="text-gray-400 mx-1">·</span>}
            {title && <span className="text-green-600 dark:text-accent">✓ caption ({title.length} chars)</span>}
          </p>
        </div>
      </div>

      {/* Preview vidéo (exigence TikTok : preview avant publish) */}
      {previewUrl && (
        <div>
          <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
            Prévisualisation
            {videoDuration && (
              <span className="ml-2 text-gray-400">
                ({videoDuration.toFixed(1)}s
                {maxDurationSec ? ` / max ${maxDurationSec}s` : ''})
              </span>
            )}
          </label>
          <video
            src={previewUrl}
            controls
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
            className="w-full max-w-[280px] rounded-lg border border-gray-200 dark:border-dark-border bg-black"
          />
          {videoTooLong && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ Vidéo plus longue que la durée max ({maxDurationSec}s) autorisée par ce compte. Réduis la durée avant publication.
            </p>
          )}
        </div>
      )}

      {/* Titre + hashtags */}
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
          Titre / caption + hashtags
          <span className="ml-2 text-gray-400">{title.length}/2200</span>
        </label>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 2200))}
          placeholder="Caption accrocheuse… #hashtag1 #hashtag2"
          rows={4}
          className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg resize-y font-mono"
        />
      </div>

      {/* Privacy — PAS DE valeur par défaut (exigence TikTok) */}
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
          Qui peut voir cette publication ? <span className="text-red-500">*</span>
        </label>
        <select
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value)}
          disabled={!creatorInfo}
          className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg disabled:opacity-50 min-w-[200px]"
        >
          <option value="">— Sélectionner une option —</option>
          {privacyOptions.map((o) => (
            <option
              key={o.value}
              value={o.value}
              disabled={brandedContent && o.value === 'SELF_ONLY'}
            >
              {o.label}
              {brandedContent && o.value === 'SELF_ONLY'
                ? ' (indisponible pour Branded Content)'
                : ''}
            </option>
          ))}
        </select>
        {brandedContentForcesPublic && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ La visibilité ne peut pas être privée pour un Branded Content. Choisis Public, Amis ou Abonnés.
          </p>
        )}
      </div>

      {/* Interaction settings — tous décochés par défaut, greyed si désactivés au compte */}
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
          Interactions autorisées
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <label className={`flex items-center gap-1.5 ${commentDisabledAtAccount ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={allowComment}
              disabled={commentDisabledAtAccount}
              onChange={(e) => setAllowComment(e.target.checked)}
            />
            Autoriser les commentaires
          </label>
          <label className={`flex items-center gap-1.5 ${duetDisabledAtAccount ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={allowDuet}
              disabled={duetDisabledAtAccount}
              onChange={(e) => setAllowDuet(e.target.checked)}
            />
            Autoriser les Duets
          </label>
          <label className={`flex items-center gap-1.5 ${stitchDisabledAtAccount ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={allowStitch}
              disabled={stitchDisabledAtAccount}
              onChange={(e) => setAllowStitch(e.target.checked)}
            />
            Autoriser les Stitch
          </label>
        </div>
      </div>

      {/* Commercial Content Disclosure */}
      <div className="border border-gray-200 dark:border-dark-border rounded-lg p-3 space-y-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={commercialDisclosure}
            onChange={(e) => {
              setCommercialDisclosure(e.target.checked);
              if (!e.target.checked) {
                setYourBrand(false);
                setBrandedContent(false);
              }
            }}
            className="mt-0.5"
          />
          <span className="text-sm font-medium">
            Cette publication promeut une marque, un produit ou un service
          </span>
        </label>
        {commercialDisclosure && (
          <div className="pl-6 space-y-1.5 text-sm">
            <label className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={yourBrand}
                onChange={(e) => setYourBrand(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Ma marque</strong> — je fais la promo de moi-même ou de ma propre entreprise.
                {yourBrand && (
                  <span className="block text-[11px] text-gray-500 dark:text-dark-muted mt-0.5">
                    Étiquetée « Promotional content » sur TikTok.
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={brandedContent}
                onChange={(e) => setBrandedContent(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Contenu sponsorisé</strong> — je fais la promo d'une autre marque ou d'un tiers.
                {brandedContent && (
                  <span className="block text-[11px] text-gray-500 dark:text-dark-muted mt-0.5">
                    Étiquetée « Paid partnership ». Visibilité « privé » indisponible.
                  </span>
                )}
              </span>
            </label>
            {!commercialDiscloseValid && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                ⚠️ Tu dois indiquer si le contenu promeut toi-même, un tiers, ou les deux.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Consentement explicite avant publish */}
      <div className="border-l-2 border-accent pl-3 py-1">
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span>{declarationText}</span>
        </label>
      </div>

      {/* Bouton publier — title (hover tooltip) requis par exigence doc 3a */}
      <div>
        <button
          onClick={submit}
          disabled={!canPublish}
          title={publishHint}
          className="px-4 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-dark-bg rounded-lg transition-colors disabled:opacity-50"
        >
          {publishing ? 'Publication en cours…' : 'Publier sur TikTok'}
        </button>
        {!canPublish && !publishing && file && (
          <p className="text-[10px] text-gray-400 dark:text-dark-muted mt-1">
            {!privacy
              ? '→ choisis une visibilité'
              : !commercialDiscloseValid
              ? '→ indique le type de contenu commercial'
              : brandedContentForcesPublic
              ? '→ change la visibilité (Branded Content ≠ privé)'
              : videoTooLong
              ? `→ vidéo trop longue (max ${maxDurationSec}s)`
              : !consent
              ? '→ accepte la déclaration TikTok'
              : ''}
          </p>
        )}
      </div>

      {result && (
        <div className="text-xs text-green-600 dark:text-accent">{result}</div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-dark-bg3 rounded-lg p-2 text-center">
      <div className="text-lg font-bold text-gray-900 dark:text-dark-text">
        {value != null ? value : '—'}
      </div>
      <div className="text-xs text-gray-500 dark:text-dark-muted">{label}</div>
    </div>
  );
}
