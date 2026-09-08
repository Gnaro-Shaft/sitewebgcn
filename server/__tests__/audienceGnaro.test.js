// Lecture des agrégats d'audience de gnaro.fr : parseur et résumé, sur des
// CSV synthétiques. Aucun fichier réel, aucune donnée de visiteur.

import { describe, it, expect } from 'vitest';

const { parserCsv, resumer, decaler } = require('../services/audienceGnaro');

const ENTETE = 'jour,pages_vues,contact_vues,ref_chatgpt,ref_perplexity,ref_claude,ref_gemini,ref_copilot,ref_moteurs,ref_linkedin,ref_malt,ref_freework,ref_autres,ref_aucun,robot_gptbot,robot_oai_searchbot,robot_claudebot,robot_perplexitybot,robot_google_extended,robot_googlebot,robot_bingbot';
const ligne = (jour, vues, contact = 0, o = {}) => [jour, vues, contact,
  o.chatgpt || 0, o.perplexity || 0, o.claude || 0, 0, 0, o.moteurs || 0, o.linkedin || 0, 0, 0, o.autres || 0, o.aucun || 0,
  o.gptbot || 0, 0, 0, 0, 0, o.googlebot || 0, 0].join(',');

describe('parserCsv', () => {
  it('lit un fichier avec BOM et fins de ligne Windows, trié par jour', () => {
    const r = parserCsv(`﻿${ENTETE}\r\n${ligne('2026-09-03', 5)}\r\n${ligne('2026-09-02', 7)}\r\n`);
    expect(r.map((x) => x.jour)).toEqual(['2026-09-02', '2026-09-03']);
    expect(r[0].pages_vues).toBe(7);
  });
  it('ignore une ligne malformée, une date invalide et une valeur non numérique sans tout rejeter', () => {
    const r = parserCsv(`${ENTETE}\n${ligne('2026-09-02', 7)}\n1,2,3\nabc,${ligne('x', 1).slice(2)}\n${ligne('2026-09-03', 'n/a')}`);
    expect(r).toHaveLength(2);
    expect(r[1].pages_vues).toBe(0);
  });
  it('rend une liste vide sur un fichier vide ou réduit à l’en-tête', () => {
    expect(parserCsv('')).toEqual([]);
    expect(parserCsv(ENTETE)).toEqual([]);
    expect(parserCsv(undefined)).toEqual([]);
  });
});

describe('decaler', () => {
  it('franchit les mois et les années en UTC', () => {
    expect(decaler('2026-09-01', -1)).toBe('2026-08-31');
    expect(decaler('2026-01-01', -1)).toBe('2025-12-31');
    expect(decaler('2026-02-27', 2)).toBe('2026-03-01');
  });
});

describe('resumer', () => {
  const audience = [ENTETE,
    ligne('2026-08-20', 10, 1, { moteurs: 4 }),          // période précédente
    ligne('2026-08-25', 10, 0, { linkedin: 2 }),         // période précédente
    ligne('2026-09-01', 30, 2, { chatgpt: 3, claude: 1, moteurs: 6, aucun: 20, gptbot: 2 }),
    ligne('2026-09-03', 50, 1, { perplexity: 2, linkedin: 5, autres: 3, aucun: 40, googlebot: 4 }),
  ].join('\n');
  const pages = ['jour,page,vues', '2026-09-01,/,20', '2026-09-01,/blog/,10', '2026-09-03,/,45', '2026-08-25,/,10'].join('\n');

  it('agrège la période, compare à la précédente et classe les pages', () => {
    const r = resumer(audience, pages, 7);
    expect(r).toMatchObject({ jours: 7, vide: false, du: '2026-09-01', au: '2026-09-03', vues: 80, contact: 3, joursAvecTrafic: 2 });
    expect(r.variation).toBe(700); // 80 contre 10 (le 25 août seul tombe dans les 7 jours précédents)
    expect(r.origines).toEqual({ ia: 6, moteurs: 6, linkedin: 5, plateformes: 0, autres: 3, direct: 60 });
    expect(r.robots).toEqual({ ia: 2, moteurs: 4 });
    expect(r.pages).toEqual([{ page: '/', vues: 65, part: 81.3 }, { page: '/blog/', vues: 10, part: 12.5 }]);
    expect(r.serie).toHaveLength(2);
    expect(r.serie[0]).toEqual({ jour: '2026-09-01', vues: 30, contact: 2, ia: 4, moteurs: 6, linkedin: 0 });
  });
  it('rend variation nulle sans période précédente et borne les jours', () => {
    const r = resumer(audience, pages, 9999);
    expect(r.jours).toBe(365);
    expect(r.variation).toBeNull();
    expect(r.vues).toBe(100);
  });
  it('signale un fichier vide sans planter', () => {
    expect(resumer('', '', 30)).toMatchObject({ vide: true, serie: [], pages: [] });
    expect(resumer(ENTETE, 'jour,page,vues', 30).vide).toBe(true);
  });
});
