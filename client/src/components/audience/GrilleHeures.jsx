// Vues de gnaro.fr par jour de la semaine et par heure (heure de Paris),
// cumulées sur la période. Chaque case est un compte, jamais une visite
// identifiable : audience.py ne croise l'heure avec rien d'autre.

import { jourLong, trancheHoraire } from './libelles';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HEURES = Array.from({ length: 24 }, (_, h) => h);

export default function GrilleHeures({ heures }) {
  const max = Math.max(1, ...heures.grille.flat());
  const colonnes = { gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[20rem] grid gap-px" style={colonnes}>
          <span />
          {HEURES.map((h) => (
            <span key={h} className="text-center text-[10px] tabular-nums text-gray-400 dark:text-dark-muted">
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          {heures.grille.map((ligne, j) => (
            <Ligne key={JOURS[j]} jour={j} ligne={ligne} max={max} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-400 dark:text-dark-muted">
        Heure de Paris. Plus la case est vive, plus il y a de vues (maximum : {max} sur une case).
        Mesuré sur {heures.joursMesures} jour{heures.joursMesures > 1 ? 's' : ''} de la période.
      </p>
    </div>
  );
}

function Ligne({ jour, ligne, max }) {
  return (
    <>
      <span className="pr-1 text-[11px] leading-5 text-gray-500 dark:text-dark-muted">{JOURS[jour]}</span>
      {ligne.map((v, h) => (
        <span
          key={h}
          title={`${jourLong(jour)}, ${trancheHoraire(h)} : ${v} vue${v > 1 ? 's' : ''}`}
          className="relative h-5 rounded-sm bg-gray-100 dark:bg-dark-bg3"
        >
          {v > 0 && (
            <span className="absolute inset-0 rounded-sm bg-accent" style={{ opacity: 0.2 + (0.8 * v) / max }} />
          )}
        </span>
      ))}
    </>
  );
}
