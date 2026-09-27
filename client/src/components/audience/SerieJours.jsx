// Vues par jour, humains et robots empilés sur une même barre. Un jour
// d'avant la séparation (robots null) n'a que sa barre humains, qui mêle
// alors humains et robots déguisés : la page le signale au-dessus.

import Legende from './Legende';
import { COULEUR } from './libelles';

export default function SerieJours({ serie }) {
  const avecRobots = serie.some((j) => j.robots !== null);
  const max = Math.max(1, ...serie.map((j) => j.vues + (j.robots || 0)));
  const largeur = (v) => `${(100 * v) / max}%`;

  return (
    <div>
      <div className="mb-3"><Legende robots={avecRobots} /></div>
      <ul className="space-y-1">
        {serie.map((j) => (
          <li key={j.jour} className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0 tabular-nums text-gray-500 dark:text-dark-muted">{j.jour}</span>
            <div className="flex-1 min-w-0 flex h-3 gap-0.5">
              {j.vues > 0 && (
                <div className={`h-3 rounded-sm ${COULEUR.humains}`} style={{ width: largeur(j.vues) }} title={`${j.jour} : ${j.vues} vues humaines`} />
              )}
              {j.robots > 0 && (
                <div className={`h-3 rounded-sm ${COULEUR.robots}`} style={{ width: largeur(j.robots) }} title={`${j.jour} : ${j.robots} vues de robots`} />
              )}
            </div>
            <span className="w-10 text-right tabular-nums text-gray-900 dark:text-dark-text" title="Vues humaines">{j.vues}</span>
            <span className="w-10 text-right tabular-nums text-gray-500 dark:text-dark-muted" title="Vues de robots">{j.robots ?? '—'}</span>
            <span className="hidden sm:inline w-28 text-right tabular-nums text-gray-400 dark:text-dark-muted" title="IA · moteurs · LinkedIn">
              {j.ia} · {j.moteurs} · {j.linkedin}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-400 dark:text-dark-muted">
        Colonnes : vues humaines · vues de robots (— : pas encore séparées) · visites humaines venues d'assistants IA · de moteurs · de LinkedIn.
      </p>
    </div>
  );
}
