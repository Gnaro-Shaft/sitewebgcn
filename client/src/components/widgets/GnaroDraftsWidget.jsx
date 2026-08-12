// Brouillons en attente sur gnaro.fr.
//
// Volontairement minimal : un compteur, les titres, et un lien. La relecture
// et les boutons vivent sur /admin/gnaro — un widget de tableau de bord n'est
// pas l'endroit où l'on décide de publier quelque chose.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../../api/axios';
import WidgetError from './WidgetError';

export default function GnaroDraftsWidget() {
  const [brouillons, setBrouillons] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  // Chargement initial. Aucun setState synchrone dans le corps de l'effet :
  // l'état initial vaut déjà « en chargement », et un appel synchrone
  // déclencherait un rendu en cascade. La garde `vivant` évite en prime
  // d'écrire dans un composant démonté si la réponse arrive trop tard.
  useEffect(() => {
    let vivant = true;
    api
      .get('/gnaro/drafts')
      .then((res) => { if (vivant) setBrouillons(res.data.data || []); })
      .catch(() => { if (vivant) setErreur(true); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, []);

  // Chemin « réessayer » : ici, repartir de zéro est justement le but.
  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    api
      .get('/gnaro/drafts')
      .then((res) => setBrouillons(res.data.data || []))
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <Coque><Squelette /></Coque>;
  if (erreur) return <Coque><WidgetError onRetry={charger} /></Coque>;

  const aVerifier = brouillons.reduce((n, a) => n + (a.aVerifier?.length || 0), 0);

  return (
    <Coque>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Case label="En attente" value={brouillons.length} accent />
        <Case label="À vérifier" value={aVerifier} />
      </div>

      {brouillons.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-muted">Aucun brouillon en attente.</p>
      ) : (
        <ul className="space-y-2">
          {brouillons.slice(0, 5).map((a) => (
            <li key={a.fichier} className="text-sm">
              <p className="text-gray-900 dark:text-dark-text line-clamp-1">{a.titre}</p>
              <p className="text-xs text-gray-400 dark:text-dark-muted">
                {a.pubDate} · {a.motsEnviron} mots
                {a.aVerifier?.length > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    {a.aVerifier.length} à vérifier
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/admin/gnaro"
        className="mt-4 inline-block text-xs font-medium text-accent hover:underline"
      >
        Relire et publier →
      </Link>
    </Coque>
  );
}

function Coque({ children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">gnaro.fr</h3>
      {children}
    </div>
  );
}

function Case({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-dark-bg3 px-3 py-2">
      <p className={`text-xl font-bold ${accent ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 dark:text-dark-muted">{label}</p>
    </div>
  );
}

function Squelette() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-dark-bg3 animate-pulse" />
      ))}
    </div>
  );
}
