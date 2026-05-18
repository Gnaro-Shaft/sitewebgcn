import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';

// Niches autorisées pour la connexion d'un compte TikTok
const NICHES = ['business-ia', 'actu', 'aion', 'finance', 'motivation', 'productivite'];

const PRIVACY_OPTIONS = [
  { value: 'SELF_ONLY', label: 'Privé (moi seul)' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Abonnés' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Amis' },
  { value: 'PUBLIC_TO_EVERYONE', label: 'Public' },
];

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
function PublishForm({ niche, onError }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState('SELF_ONLY');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState('');

  // Convertit le fichier vidéo en base64 pour l'envoyer dans le body JSON
  const fileToBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const submit = async () => {
    if (!file) return;
    setPublishing(true);
    setResult('');
    onError('');
    try {
      const base64 = await fileToBase64(file);
      const res = await api.post('/tiktok/publish', {
        niche,
        title,
        privacyLevel: privacy,
        video: base64,
      });
      setResult(`Publication : ${res.data.data.status}`);
    } catch (e) {
      onError(e?.response?.data?.error || 'Echec de la publication');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-dark-border pt-4 space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">Fichier vidéo (mp4)</label>
        <input
          type="file"
          accept="video/mp4"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-600 dark:text-dark-muted"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">Titre / légende</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la vidéo..."
          className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">Confidentialité</label>
        <select
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value)}
          className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg"
        >
          {PRIVACY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={submit}
        disabled={publishing || !file}
        className="px-4 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-dark-bg rounded-lg transition-colors disabled:opacity-50"
      >
        {publishing ? 'Publication en cours…' : 'Publier'}
      </button>
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
