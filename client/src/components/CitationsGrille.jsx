// Grille des citations de gnaro.fr par les assistants d'IA : une ligne par
// requête cible, une colonne par système, valeur du dernier relevé, et la
// trace des relevés précédents. Données : /api/gnaro/citations.

import { useEffect, useState } from 'react';
import api from '../api/axios';

const SYSTEMES = [['perplexity', 'Perplexity'], ['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['google', 'Google']];
const STYLE = {
  oui: 'bg-accent/20 text-accent',
  partiel: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  non: 'bg-gray-100 text-gray-500 dark:bg-dark-bg3 dark:text-dark-muted',
  non_verifie: 'bg-gray-50 text-gray-400 border border-dashed border-gray-300 dark:bg-transparent dark:border-dark-border',
  inconnu: 'text-gray-300',
};
const TEXTE = { oui: 'oui', partiel: 'partiel', non: 'non', non_verifie: 'non vérifié', inconnu: '—' };

export default function CitationsGrille() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let vivant = true;
    api.get('/gnaro/citations')
      .then((res) => { if (vivant) setData(res.data.data); })
      .catch((e) => { if (vivant) setErreur(e.response?.data?.error || e.message); });
    return () => { vivant = false; };
  }, []);

  return (
    <section id="citations" className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">Citations par les assistants d'IA</h3>
        {data && !data.vide && (
          <span className="text-xs text-gray-400 dark:text-dark-muted">
            dernier relevé {data.dernier.date}{data.dernier.titre ? `, ${data.dernier.titre}` : ''} · {data.nbReleves} relevé{data.nbReleves > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-dark-muted mb-4">
        Relevé à la main le premier du mois, requête par requête. Un « non » isolé ne prouve rien ; une tendance sur trois mois, si.
      </p>

      {erreur && <p className="text-sm text-red-600 dark:text-red-300">{erreur}</p>}
      {data && data.vide && <p className="text-sm text-gray-400 dark:text-dark-muted">Aucun relevé pour l'instant.</p>}

      {data && !data.vide && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 dark:text-dark-muted">
              <tr>
                <th className="text-left font-normal py-1 pr-2">Requête cible</th>
                {SYSTEMES.map(([k, l]) => <th key={k} className="text-center font-normal py-1 px-1">{l}</th>)}
                <th className="text-left font-normal py-1 pl-3">Relevés</th>
              </tr>
            </thead>
            <tbody>
              {data.requetes.map((q) => (
                <tr key={q.n} className="border-t border-gray-100 dark:border-dark-border align-top">
                  <td className="py-2 pr-2 text-gray-900 dark:text-dark-text">
                    <span className="text-gray-400 dark:text-dark-muted mr-1">{q.n}.</span>{q.requete}
                    <span className="block font-mono text-[10px] text-gray-400 dark:text-dark-muted">{q.article}</span>
                  </td>
                  {SYSTEMES.map(([k]) => {
                    const c = q.dernier?.[k] || { valeur: 'inconnu', apercu: null };
                    return (
                      <td key={k} className="py-2 px-1 text-center">
                        <span className={`inline-block rounded px-1.5 py-0.5 ${STYLE[c.valeur]}`} title={c.apercu === true ? 'aperçu IA présent' : c.apercu === false ? "pas d'aperçu IA" : ''}>
                          {TEXTE[c.valeur]}{k === 'google' && c.apercu !== null && <span className="ml-1 opacity-60">{c.apercu ? '◐' : '○'}</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3">
                    <span className="inline-flex gap-0.5" title={q.historique.map((h) => `${h.date} : ${h.citee ? 'citée' : 'non'}`).join('\n')}>
                      {q.historique.map((h, i) => <span key={i} className={`inline-block w-2 h-2 rounded-sm ${h.citee ? 'bg-accent' : 'border border-gray-500'}`} />)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-gray-400 dark:text-dark-muted">Google : ◐ aperçu IA présent, ○ absent. Relevés : un carré par relevé, plein si au moins un système citait le site.</p>
        </div>
      )}
    </section>
  );
}
