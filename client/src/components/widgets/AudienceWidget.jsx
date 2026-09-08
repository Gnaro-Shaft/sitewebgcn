// Audience de gnaro.fr sur sept jours : vues, contact, d'où viennent les
// visites. Des comptes agrégés relus depuis le VPS, rien de mesuré ici.
// Le détail par jour et par page vit sur /admin/audience.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../../api/axios';
import WidgetError from './WidgetError';

const ORIGINES = [
  ['ia', 'Assistants IA'],
  ['moteurs', 'Moteurs'],
  ['linkedin', 'LinkedIn'],
  ['plateformes', 'Malt, Free-Work'],
  ['autres', 'Autres sites'],
  ['direct', 'Sans référent'],
];

export default function AudienceWidget() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(null);
    api
      .get('/audience/resume?jours=7')
      .then((res) => setData(res.data.data))
      .catch((e) => setErreur(e.response?.data?.error || e.message))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    let vivant = true;
    api
      .get('/audience/resume?jours=7')
      .then((res) => { if (vivant) setData(res.data.data); })
      .catch((e) => { if (vivant) setErreur(e.response?.data?.error || e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, []);

  if (chargement) return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Chargement…</p></Coque>;
  if (erreur) return <Coque><WidgetError onRetry={charger} /><p className="mt-2 text-xs text-gray-400 dark:text-dark-muted">{erreur}</p></Coque>;
  if (!data || data.vide) return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Aucune donnée d'audience.</p></Coque>;

  const totalOrigines = Object.values(data.origines).reduce((n, v) => n + v, 0) || 1;

  return (
    <Coque sousTitre={`${data.du} → ${data.au}`}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Case label="Vues" value={data.vues} accent />
        <Case label="Contact" value={data.contact} />
        <Case label="7 j. préc." value={data.variation === null ? '—' : `${data.variation > 0 ? '+' : ''}${data.variation} %`} />
      </div>
      <ul className="space-y-1.5">
        {ORIGINES.map(([cle, label]) => {
          const v = data.origines[cle] || 0;
          return (
            <li key={cle} className="text-xs">
              <div className="flex justify-between text-gray-600 dark:text-dark-muted">
                <span>{label}</span><span className="tabular-nums">{v}</span>
              </div>
              <div className="h-1 rounded bg-gray-100 dark:bg-dark-bg3">
                <div className="h-1 rounded bg-accent" style={{ width: `${Math.round((100 * v) / totalOrigines)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <Link to="/admin/audience" className="mt-4 inline-block text-xs font-medium text-accent hover:underline">
        Détail par jour et par page →
      </Link>
    </Coque>
  );
}

function Coque({ sousTitre, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">Audience gnaro.fr</h3>
        {sousTitre && <span className="text-xs text-gray-400 dark:text-dark-muted">{sousTitre}</span>}
      </div>
      {children}
    </div>
  );
}

function Case({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-dark-bg3 px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-dark-muted">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${accent ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>{value}</p>
    </div>
  );
}
