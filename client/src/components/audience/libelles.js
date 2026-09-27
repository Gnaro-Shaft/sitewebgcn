// Libellés partagés par la page audience, sa grille horaire et la carte du tableau de bord.

const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export const trancheHoraire = (h) => `${h} h – ${h + 1} h`;
export const jourLong = (i) => JOURS_LONGS[i];
