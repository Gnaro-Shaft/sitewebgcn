// Vues par heure de la journée (heure de Paris), cumulées sur la période :
// humains à la base, robots empilés au-dessus, séparés d'un filet de 2 px.
// Les rafales de robots écrasent l'échelle : on peut les masquer, l'échelle
// se recalcule alors sur les humains seuls.

import { useState } from 'react';
import Legende from './Legende';
import { COULEUR, trancheHoraire } from './libelles';

const HAUTEUR = 120; // px

export default function HistogrammeHeures({ heures }) {
  const { parHeure, robotsMesures } = heures;
  const [masquer, setMasquer] = useState(false);
  const avecRobots = robotsMesures && !masquer;
  const parHeureRobots = avecRobots ? heures.parHeureRobots : parHeure.map(() => 0);
  const max = Math.max(1, ...parHeure.map((v, h) => v + parHeureRobots[h]));
  const px = (v) => Math.round((HAUTEUR * v) / max);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Legende robots={avecRobots} />
        {robotsMesures && (
          <button type="button" aria-pressed={masquer} onClick={() => setMasquer((m) => !m)} className="text-xs text-gray-500 dark:text-dark-muted hover:text-accent underline-offset-2 hover:underline">
            {masquer ? 'Afficher les robots' : 'Masquer les robots'}
          </button>
        )}
      </div>
      <div className="flex items-end gap-0.5 border-b border-gray-200 dark:border-dark-border" style={{ height: HAUTEUR + 4 }}>
        {parHeure.map((hum, h) => {
          const rob = parHeureRobots[h];
          return (
            <div
              key={h}
              className="flex-1 min-w-0 flex flex-col-reverse gap-0.5"
              title={`${trancheHoraire(h)} : ${hum} humain${hum > 1 ? 's' : ''}${avecRobots ? `, ${rob} robot${rob > 1 ? 's' : ''}` : ''}`}
            >
              {hum > 0 && <div className={`rounded-t-sm ${COULEUR.humains}`} style={{ height: Math.max(2, px(hum)) }} />}
              {rob > 0 && <div className={`rounded-t-sm ${COULEUR.robots}`} style={{ height: Math.max(2, px(rob)) }} />}
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5 mt-1">
        {parHeure.map((_, h) => (
          <span key={h} className="flex-1 text-center text-[10px] tabular-nums text-gray-400 dark:text-dark-muted">{h % 3 === 0 ? h : ''}</span>
        ))}
      </div>
    </div>
  );
}
