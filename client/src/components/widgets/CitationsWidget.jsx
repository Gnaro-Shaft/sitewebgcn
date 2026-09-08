// gnaro.fr est-il cité par les assistants d'IA ? Dernier relevé mensuel,
// décompte par système sur les requêtes cibles. Le relevé est fait à la
// main le premier du mois ; la grille complète est sur /admin/audience.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../../api/axios';
import WidgetError from './WidgetError';

const SYSTEMES = [['perplexity', 'Perplexity'], ['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['google', 'Google, aperçu IA']];

export default function CitationsWidget() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(() => {
    setChargement(true); setErreur(null);
    api.get('/gnaro/citations')
      .then((res) => setData(res.data.data))
      .catch((e) => setErreur(e.response?.data?.error || e.message))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    let vivant = true;
    api.get('/gnaro/citations')
      .then((res) => { if (vivant) setData(res.data.data); })
      .catch((e) => { if (vivant) setErreur(e.response?.data?.error || e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, []);

  if (chargement) return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Chargement…</p></Coque>;
  if (erreur) return <Coque><WidgetError onRetry={charger} /><p className="mt-2 text-xs text-gray-400 dark:text-dark-muted">{erreur}</p></Coque>;
  if (!data || data.vide) return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Aucun relevé pour l'instant.</p></Coque>;

  const { dernier, evolution } = data;
  return (
    <Coque sousTitre={`relevé du ${dernier.date}`}>
      <div className="flex items-end gap-3 mb-4">
        <p className="text-3xl font-semibold tabular-nums text-accent">{dernier.total}</p>
        <p className="text-xs text-gray-500 dark:text-dark-muted pb-1">
          citations sur {dernier.requetes * 4} possibles
          {evolution !== null && <span className={`ml-2 ${evolution > 0 ? 'text-accent' : evolution < 0 ? 'text-red-500' : ''}`}>{evolution > 0 ? '+' : ''}{evolution} vs relevé précédent</span>}
        </p>
      </div>
      <ul className="space-y-1.5 text-xs">
        {SYSTEMES.map(([cle, label]) => {
          const s = dernier.parSysteme[cle];
          return (
            <li key={cle} className="flex justify-between text-gray-600 dark:text-dark-muted">
              <span>{label}</span>
              <span className="tabular-nums">
                <b className="text-gray-900 dark:text-dark-text">{s.oui}</b> oui · {s.partiel} partiel
                {s.nonVerifie > 0 && <span className="text-amber-500"> · {s.nonVerifie} non vérifié</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <Link to="/admin/audience#citations" className="mt-4 inline-block text-xs font-medium text-accent hover:underline">
        Grille par requête →
      </Link>
    </Coque>
  );
}

function Coque({ sousTitre, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">Citations IA</h3>
        {sousTitre && <span className="text-xs text-gray-400 dark:text-dark-muted">{sousTitre}</span>}
      </div>
      {children}
    </div>
  );
}
