import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SammlungStore } from './sammlung-store.ts';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const neu = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-sammlung-'));
  dirs.push(d);
  return { d, s: new SammlungStore(d) };
};
const posten = (geaendert: string, extra = {}) => ({ id: 'p1', name: 'Paprika', menge: 2, rezepte: [], abgehakt: false, geaendert, ...extra });

describe('SammlungStore', () => {
  it('Last-Write-Wins je Liste, Listen getrennt', () => {
    const { s } = neu();
    expect(s.uebernehmen('einkauf', [posten('2026-10-21T10:00:00Z')]).uebernommen).toBe(1);
    expect(s.uebernehmen('einkauf', [posten('2026-10-21T09:00:00Z', { abgehakt: true })]).uebernommen).toBe(0);
    expect(s.liste('einkauf')[0]).toMatchObject({ abgehakt: false });
    s.uebernehmen('favoriten', [{ id: 'p1', geaendert: '2026-10-21T08:00:00Z' }]); // gleiche ID, andere Liste
    expect(s.liste('favoriten')).toHaveLength(1);
    expect(s.liste('einkauf')).toHaveLength(1);
    const r = s.uebernehmen('einkauf', [posten('2026-10-21T11:00:00Z', { abgehakt: true })]);
    expect(s.aenderungen('einkauf', r.rev - 1).eintraege).toEqual([expect.objectContaining({ abgehakt: true })]);
    expect(s.aenderungen('favoriten', r.rev - 1).eintraege).toEqual([]);
    s.schliessen();
  });

  it('Grabsteine bleiben für den Sync, Daten überleben Neustart', () => {
    const { d, s } = neu();
    s.uebernehmen('gekocht', [{ id: 'g1', rezeptId: 'r1', datum: '2026-10-20T18:00:00Z', bewertung: 4, geaendert: '2026-10-20T18:00:00Z' }]);
    s.uebernehmen('gekocht', [{ id: 'g1', rezeptId: 'r1', datum: '2026-10-20T18:00:00Z', geaendert: '2026-10-21T08:00:00Z', geloescht: true }]);
    expect(s.liste('gekocht')).toHaveLength(0);
    s.schliessen();
    const s2 = new SammlungStore(d);
    expect(s2.aenderungen('gekocht', 0).eintraege[0]).toMatchObject({ geloescht: true });
    s2.schliessen();
  });

  it('prüft Liste und Einträge', () => {
    const { s } = neu();
    expect(() => s.liste('quatsch')).toThrow(/Unbekannte Liste/);
    expect(() => s.uebernehmen('gekocht', [{ id: 'g1', geaendert: 'x', datum: 'x', rezeptId: 'r', bewertung: 9 }])).toThrow(/Ungültiger Eintrag/);
    s.schliessen();
  });
});
