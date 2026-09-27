// Libellés et couleurs partagés par la page audience, ses graphiques et la carte du tableau de bord.

const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export const trancheHoraire = (h) => `${h} h – ${h + 1} h`;
export const jourLong = (i) => JOURS_LONGS[i];

// Classes des deux séries (tokens --color-humain / --color-robot de index.css).
export const COULEUR = {
  humains: 'bg-humain',
  robots: 'bg-robot dark:bg-robot-sombre',
};
