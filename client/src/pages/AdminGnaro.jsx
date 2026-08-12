// Relecture et publication des brouillons de gnaro.fr.
//
// Les articles ne sont pas en base : ce sont des fichiers Markdown du dépôt
// Git du site. Cette page est une télécommande, pas un éditeur — on relit, on
// publie ou on supprime. Pour retoucher le texte, on édite le fichier.
//
// Le bouton « Publier » reste inactif tant que les points à vérifier ne sont
// pas cochés. Ce n'est pas une politesse : le pipeline a supprimé l'étape de
// pull request, et cette case est ce qui reste du garde-fou contre un chiffre
// inventé par le modèle.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Markdown from 'react-markdown';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminGnaro() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [brouillons, setBrouillons] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [choisi, setChoisi] = useState(null);
  const [coches, setCoches] = useState({});
  const [enCours, setEnCours] = useState(false);

  // Chargement initial. Pas de setState synchrone dans le corps de l'effet
  // (rendu en cascade), et une garde contre l'écriture après démontage.
  useEffect(() => {
    let vivant = true;
    api
      .get('/gnaro/drafts')
      .then((res) => { if (vivant) setBrouillons(res.data.data || []); })
      .catch((e) => { if (vivant) setErreur(e.response?.data?.error || e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, []);

  // Rechargement explicite : après une publication, une suppression, ou un
  // clic de l'utilisateur. Repartir de zéro est ici le comportement voulu.
  const charger = useCallback(() => {
    setChargement(true);
    setErreur(null);
    api
      .get('/gnaro/drafts')
      .then((res) => setBrouillons(res.data.data || []))
      .catch((e) => setErreur(e.response?.data?.error || e.message))
      .finally(() => setChargement(false));
  }, []);

  // Les cases repartent à zéro à chaque changement d'article : on ne valide
  // jamais un texte avec les cases cochées sur un autre.
  const selectionner = (a) => { setChoisi(a); setCoches({}); };

  const resteAVerifier = choisi
    ? choisi.aVerifier.filter((_, i) => !coches[i]).length
    : 0;
  const publiable = choisi && resteAVerifier === 0 && !enCours;

  const publier = async () => {
    if (!choisi || !publiable) return;
    setEnCours(true);
    try {
      await api.patch(`/gnaro/drafts/${encodeURIComponent(choisi.fichier)}/publish`, {
        sha: choisi.sha,
      });
      setChoisi(null);
      charger();
    } catch (e) {
      alert('Publication impossible : ' + (e.response?.data?.error || e.message));
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async () => {
    if (!choisi) return;
    if (!confirm(`Supprimer définitivement « ${choisi.titre} » ?\n\nLe fichier reste retrouvable dans l'historique Git.`)) return;
    setEnCours(true);
    try {
      await api.delete(`/gnaro/drafts/${encodeURIComponent(choisi.fichier)}`, {
        data: { sha: choisi.sha },
      });
      setChoisi(null);
      charger();
    } catch (e) {
      alert('Suppression impossible : ' + (e.response?.data?.error || e.message));
    } finally {
      setEnCours(false);
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
            <Link to="/dashboard" className="text-sm text-gray-400 dark:text-dark-muted hover:text-accent">Dashboard</Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">gnaro.fr</span>
          </div>
          <button
            onClick={() => { navigate('/'); setTimeout(() => logout(), 10); }}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-red-500 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {erreur && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {erreur}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
              Brouillons ({brouillons.length})
            </h2>
            {chargement ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-bg3 animate-pulse" />
                ))}
              </div>
            ) : brouillons.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-dark-muted italic">
                Aucun brouillon en attente.
              </p>
            ) : (
              <div className="space-y-2">
                {brouillons.map((a) => (
                  <button
                    key={a.fichier}
                    onClick={() => selectionner(a)}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      choisi?.fichier === a.fichier
                        ? 'border-accent bg-accent/5'
                        : 'border-gray-200 dark:border-dark-border hover:border-accent/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-text line-clamp-2">{a.titre}</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-dark-muted">
                      {a.pubDate} · {a.motsEnviron} mots
                      {a.aVerifier.length > 0 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          {a.aVerifier.length} à vérifier
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section>
            {!choisi ? (
              <p className="text-sm text-gray-400 dark:text-dark-muted italic">
                Choisissez un brouillon pour le relire.
              </p>
            ) : (
              <article className="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg2 p-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{choisi.titre}</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-muted">{choisi.description}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-dark-muted">
                  {choisi.fichier} · {choisi.motsEnviron} mots
                  {choisi.assisteParIA && ' · assisté par IA'}
                </p>

                {choisi.assisteParIA && (
                  <p className="mt-4 rounded-md border-l-4 border-accent bg-accent/5 px-3 py-2 text-xs text-gray-600 dark:text-dark-muted">
                    Cet article portera la mention de transparence exigée par l'article 50
                    du règlement européen sur l'IA. Elle reste affichée après publication.
                  </p>
                )}

                {choisi.aVerifier.length > 0 && (
                  <div className="mt-6 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                    <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      À vérifier à la source ({choisi.aVerifier.length})
                    </h2>
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                      Le modèle produit des chiffres faux avec le même aplomb que des chiffres
                      exacts. Vérifiez chacun dans le dépôt concerné, ou retirez-le du texte.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {choisi.aVerifier.map((ligne, i) => (
                        <li key={i} className="flex gap-2 text-xs text-amber-900 dark:text-amber-200">
                          <input
                            id={`verif-${i}`}
                            type="checkbox"
                            checked={!!coches[i]}
                            onChange={(e) => setCoches((c) => ({ ...c, [i]: e.target.checked }))}
                            className="mt-0.5 shrink-0"
                          />
                          <label htmlFor={`verif-${i}`} className="cursor-pointer">{ligne}</label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="prose prose-sm dark:prose-invert mt-6 max-w-none">
                  <Markdown>{choisi.corps}</Markdown>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-gray-200 dark:border-dark-border pt-6">
                  <button
                    onClick={publier}
                    disabled={!publiable}
                    title={resteAVerifier > 0 ? `${resteAVerifier} point(s) encore à cocher` : undefined}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {enCours ? 'En cours…' : 'Publier'}
                  </button>
                  <button
                    onClick={supprimer}
                    disabled={enCours}
                    className="rounded-md border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                  >
                    Supprimer
                  </button>
                  {resteAVerifier > 0 && (
                    <span className="text-xs text-gray-500 dark:text-dark-muted">
                      {resteAVerifier} point(s) à cocher avant de pouvoir publier
                    </span>
                  )}
                </div>

                <p className="mt-4 text-xs text-gray-400 dark:text-dark-muted">
                  Publier bascule <code>draft: false</code> dans le dépôt. La mise en ligne
                  suit le déploiement du site.
                </p>
              </article>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
