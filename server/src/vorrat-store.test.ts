import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VorratStore } from './vorrat-store.ts';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const neu = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-vorrat-'));
  dirs.push(d);
  return { d, s: new VorratStore(d) };
};
const art = (geaendert: string, status = 'da', extra = {}) => ({ id: 'a1', name: 'Kreuzkümmel', status, begriffe: [], geaendert, ...extra });

describe('VorratStore', () => {
  it('Last-Write-Wins und Revisionen', () => {
    const { s } = neu();
    expect(s.uebernehmen([art('2026-10-13T10:00:00Z')]).uebernommen).toBe(1);
    expect(s.uebernehmen([art('2026-10-13T09:00:00Z', 'leer')]).uebernommen).toBe(0); // älter → ignoriert
    expect(s.liste()[0].status).toBe('da');
    const r = s.uebernehmen([art('2026-10-13T11:00:00Z', 'knapp')]);
    expect(r.uebernommen).toBe(1);
    expect(s.aenderungen(r.rev - 1).artikel[0].status).toBe('knapp');
    s.schliessen();
  });

  it('Tombstones bleiben für den Sync sichtbar, Daten überleben Neustart', () => {
    const { d, s } = neu();
    s.uebernehmen([art('2026-10-13T10:00:00Z')]);
    s.uebernehmen([art('2026-10-13T12:00:00Z', 'da', { geloescht: true })]);
    expect(s.liste()).toHaveLength(0);
    expect(s.aenderungen(0).artikel[0].geloescht).toBe(true);
    s.schliessen();
    const s2 = new VorratStore(d);
    expect(s2.aenderungen(0).artikel).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(d, 'vorrat-backup.json'), 'utf8')).artikel).toEqual([]);
    s2.schliessen();
  });

  it('lehnt ungültige Artikel ab', () => {
    const { s } = neu();
    expect(() => s.uebernehmen([{ id: 'x', name: 'X', status: 'voll', geaendert: 'x' }])).toThrow();
    s.schliessen();
  });
});
