// Vues de gnaro.fr par jour de la semaine et par heure (heure de Paris),
// cumulées sur la période. Chaque case est un compte, jamais une visite
// identifiable : audience.py ne croise l'heure avec rien d'autre.
// Une case ne porte qu'une série : un sélecteur bascule humains / robots,
// chacun dans sa couleur.

import { useState } from 'react';
import { COULEUR, jourLong, trancheHoraire } from './libelles';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HEURES = Array.from({ length: 24 }, (_, h) => h);

const SERIES = [['humains', 'Humains'], ['robots', 'Robots']];

export default function GrilleHeures({ heures }) {
  const [serie, setSerie] = useState('humains');
  const actuelle = heures.robotsMesures ? serie : 'humains';
  const grille = actuelle === 'robots' ? heures.grilleRobots : heures.grille;
  const max = Math.max(1, ...grille.flat());
  const colonnes = { gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' };

  return (
    <div>
      {heures.robotsMesures && (
        <div className="mb-3 inline-flex gap-1 rounded-lg border border-gray-200 dark:border-dark-border p-1" role="group" aria-label="Série affichée">
          {SERIES.map(([cle, label]) => (
            <button
              key={cle}
              type="button"
              aria-pressed={actuelle === cle}
              onClick={() => setSerie(cle)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md ${actuelle === cle ? 'bg-gray-100 dark:bg-dark-bg3 text-gray-900 dark:text-dark-text font-semibold' : 'text-gray-500 dark:text-dark-muted'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${COULEUR[cle]}`} />{label}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[18rem] grid gap-px" style={colonnes}>
          <span />
          {HEURES.map((h) => (
            <span key={h} className="text-center text-[10px] tabular-nums text-gray-400 dark:text-dark-muted">
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          {grille.map((ligne, j) => (
            <Ligne key={JOURS[j]} jour={j} ligne={ligne} max={max} serie={actuelle} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-400 dark:text-dark-muted">
        Heure de Paris, vues {actuelle === 'robots' ? 'de robots' : 'humaines'}. Plus la case est vive, plus il y en a (maximum : {max} sur une case).
        Mesuré sur {heures.joursMesures} jour{heures.joursMesures > 1 ? 's' : ''} de la période.
      </p>
    </div>
  );
}

function Ligne({ jour, ligne, max, serie }) {
  return (
    <>
      <span className="pr-1 text-[11px] leading-5 text-gray-500 dark:text-dark-muted">{JOURS[jour]}</span>
      {ligne.map((v, h) => (
        <span
          key={h}
          title={`${jourLong(jour)}, ${trancheHoraire(h)} : ${v} ${serie === 'robots' ? 'robot' : 'humain'}${v > 1 ? 's' : ''}`}
          className="relative h-5 rounded-sm bg-gray-100 dark:bg-dark-bg3"
        >
          {v > 0 && (
            <span className={`absolute inset-0 rounded-sm ${COULEUR[serie]}`} style={{ opacity: 0.2 + (0.8 * v) / max }} />
          )}
        </span>
      ))}
    </>
  );
}
