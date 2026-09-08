// Derniers scores Lighthouse de gnaro.fr, mobile et ordinateur, relevés
// chaque lundi par le workflow GitHub (PageSpeed Insights). Quatre notes sur
// cent ; en dessous de 90, la case passe à l'orange.

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import WidgetError from './WidgetError';

const NOTES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibilité'],
  ['bestPractices', 'Bonnes pratiques'],
  ['seo', 'SEO'],
];

export default function LighthouseWidget() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    api.get('/lighthouse/latest')
      .then((res) => setData(res.data.data))
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    let vivant = true;
    api.get('/lighthouse/latest')
      .then((res) => { if (vivant) setData(res.data.data); })
      .catch(() => { if (vivant) setErreur(true); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, []);

  if (chargement) return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Chargement…</p></Coque>;
  if (erreur) return <Coque><WidgetError onRetry={charger} /></Coque>;
  if (!data?.mobile && !data?.desktop) {
    return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Pas encore de mesure. Prochain relevé lundi à 10 h.</p></Coque>;
  }

  const date = (data.mobile || data.desktop).fetchedAt?.slice(0, 10);

  return (
    <Coque sousTitre={`${data.url?.replace('https://', '')} · ${date}`}>
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 dark:text-dark-muted">
          <tr><th className="text-left font-normal pb-2"></th><th className="text-right font-normal pb-2">Mobile</th><th className="text-right font-normal pb-2">Ordinateur</th></tr>
        </thead>
        <tbody>
          {NOTES.map(([cle, label]) => (
            <tr key={cle} className="border-t border-gray-100 dark:border-dark-border">
              <td className="py-1.5 text-gray-700 dark:text-dark-text">{label}</td>
              <Note valeur={data.mobile?.[cle]} />
              <Note valeur={data.desktop?.[cle]} />
            </tr>
          ))}
        </tbody>
      </table>
    </Coque>
  );
}

function Note({ valeur }) {
  if (valeur == null) return <td className="py-1.5 text-right text-gray-400">—</td>;
  const couleur = valeur >= 90 ? 'text-accent' : valeur >= 50 ? 'text-amber-500' : 'text-red-500';
  return <td className={`py-1.5 text-right tabular-nums font-semibold ${couleur}`}>{valeur}</td>;
}

function Coque({ sousTitre, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">Lighthouse</h3>
        {sousTitre && <span className="text-xs text-gray-400 dark:text-dark-muted">{sousTitre}</span>}
      </div>
      {children}
    </div>
  );
}
