// Dernière proposition de sujets du pipeline de rédaction de gnaro.fr :
// trois candidats, celui qui a été retenu, ou le refus. Le fichier n'existe
// dans le dépôt qu'à partir de la première proposition publiée.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../../api/axios';
import WidgetError from './WidgetError';

export default function SujetsWidget() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(() => {
    setChargement(true); setErreur(null);
    api.get('/gnaro/sujets')
      .then((res) => setData(res.data.data))
      .catch((e) => setErreur(e.response?.data?.error || e.message))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    let vivant = true;
    api.get('/gnaro/sujets')
      .then((res) => { if (vivant) setData(res.data.data); })
      .catch((e) => { if (vivant) setErreur(e.response?.data?.error || e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, []);

  if (chargement) return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Chargement…</p></Coque>;
  if (erreur) return <Coque><WidgetError onRetry={charger} /><p className="mt-2 text-xs text-gray-400 dark:text-dark-muted">{erreur}</p></Coque>;
  if (!data || data.absente) {
    return <Coque><p className="text-sm text-gray-400 dark:text-dark-muted">Aucune proposition publiée pour l'instant. La prochaine tombera lundi ou jeudi à 9 h.</p></Coque>;
  }

  const jour = (data.proposeLe || '').slice(0, 10);
  return (
    <Coque sousTitre={`proposition du ${jour}`}>
      <ol className="space-y-2">
        {data.candidats.map((c, i) => (
          <li key={i} className={`rounded-lg px-3 py-2 text-sm ${c.retenu ? 'bg-accent/10 border border-accent/40' : 'bg-gray-50 dark:bg-dark-bg3'}`}>
            <p className={`line-clamp-2 ${c.retenu ? 'text-gray-900 dark:text-dark-text font-medium' : 'text-gray-600 dark:text-dark-muted'}`}>
              <span className="text-gray-400 dark:text-dark-muted mr-1">{i + 1}.</span>{c.titre}
            </p>
            <p className="text-xs text-gray-400 dark:text-dark-muted">{c.projet}{c.retenu && <span className="ml-2 text-accent">retenu</span>}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-gray-400 dark:text-dark-muted">
        {data.refuse ? 'Proposition refusée, aucun article lancé.' : data.retenu === null ? 'Décision pas encore prise.' : data.reponse ? `Réponse : « ${data.reponse} ».` : 'Premier candidat retenu faute de réponse.'}
      </p>
      <Link to="/admin/gnaro" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">Brouillons →</Link>
    </Coque>
  );
}

function Coque({ sousTitre, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">Sujets proposés</h3>
        {sousTitre && <span className="text-xs text-gray-400 dark:text-dark-muted">{sousTitre}</span>}
      </div>
      {children}
    </div>
  );
}
