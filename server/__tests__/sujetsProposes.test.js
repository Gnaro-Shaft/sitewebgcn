// Normalisation de la proposition de sujets : formes valides, bancales, vides.

import { describe, it, expect } from 'vitest';

const { normaliser } = require('../services/sujetsProposes');

const brut = {
  proposeLe: '2026-09-11T09:00:00.000Z', publieLe: '2026-09-11T15:00:00.000Z', retenu: 1, reponse: '2',
  candidats: [
    { projet: 'the_orchestrator', titre: 'A', angle: 'a', pourquoi: 'p', fichiers: ['x'] },
    { projet: 'thadeus', titre: 'B', angle: 'b', pourquoi: 'q' },
    { projet: 'video', titre: 'C' },
  ],
};

describe('normaliser', () => {
  it('marque le candidat retenu et ne garde que les champs utiles', () => {
    const r = normaliser(JSON.stringify(brut));
    expect(r.retenu).toBe(1);
    expect(r.refuse).toBe(false);
    expect(r.candidats.map((c) => c.retenu)).toEqual([false, true, false]);
    expect(r.candidats[2]).toEqual({ projet: 'video', titre: 'C', angle: '', pourquoi: '', retenu: false });
    expect(r.candidats[0]).not.toHaveProperty('fichiers');
  });
  it('un refus : aucun candidat retenu, même si retenu est renseigné', () => {
    const r = normaliser({ ...brut, refuse: true });
    expect(r.refuse).toBe(true);
    expect(r.candidats.every((c) => !c.retenu)).toBe(true);
  });
  it('tolère retenu à null (décision pas encore prise)', () => {
    expect(normaliser({ ...brut, retenu: null }).retenu).toBeNull();
  });
  it('refuse un JSON invalide ou sans candidats, avec un message exposable', () => {
    expect(() => normaliser('{')).toThrow(/illisible/);
    expect(() => normaliser({ proposeLe: 'x' })).toThrow(/candidats/);
    try { normaliser('{'); } catch (e) { expect(e.statusCode).toBe(502); expect(e.expose).toBe(true); }
  });
});
