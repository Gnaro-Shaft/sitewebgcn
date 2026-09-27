// Légende humains / robots, commune aux graphiques de la page audience.
// Le texte reste dans les couleurs de texte ; seule la pastille porte la série.

import { COULEUR } from './libelles';

export default function Legende({ robots = true }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-dark-muted">
      <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${COULEUR.humains}`} />Humains</span>
      {robots && (
        <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${COULEUR.robots}`} />Robots</span>
      )}
    </div>
  );
}
