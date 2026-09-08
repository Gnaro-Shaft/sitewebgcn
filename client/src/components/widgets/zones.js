// Zones du tableau de bord et rattachement de chaque widget.
//
// Le poste de pilotage de l'activité Gnaro d'abord, le trading à côté. La
// zone est portée par le code, pas par la configuration sauvegardée : on
// peut la changer sans migrer ce que l'utilisateur a rangé.

export const ZONES = [
  { id: 'gnaro', label: 'Gnaro' },
  { id: 'trading', label: 'Trading' },
];

export const ZONE_PAR_WIDGET = {
  gnaroDrafts: 'gnaro', sujets: 'gnaro', audience: 'gnaro', citations: 'gnaro', lighthouse: 'gnaro', github: 'gnaro',
  botStatus: 'trading', trades: 'trading', performance: 'trading', signals: 'trading', decisions: 'trading', crypto: 'trading',
};
