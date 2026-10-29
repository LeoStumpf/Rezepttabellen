import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RezeptStore, StoreFehler } from './store.ts';

const BILD = Buffer.from('fake-jpeg').toString('base64');
const rezept = (id: string, titel = 'Testrezept', bilder = ['bild-1.jpg']) => ({
  id,
  titel,
  bilder,
  tags: [],
  zutaten: [{ id: 'a', menge: 500, einheit: 'g', name: 'Nudeln' }],
  schritte: [{ id: 's1', text: 'kochen', nimmt: ['a'] }],
});

let dir: string;
let store: RezeptStore;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-'));
  store = new RezeptStore(dir);
});
afterEach(() => {
  store.schliessen();
  fs.rmSync(dir, { recursive: true, force: true });
});

const fehlerStatus = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as StoreFehler).status;
  }
  return 0;
};

describe('RezeptStore', () => {
  it('lehnt Rezepte ohne Bild ab', () => {
    expect(fehlerStatus(() => store.speichern('r1', { rezept: rezept('r1', 'X', []), notizen: '', basisRev: null }))).toBe(400);
    expect(fehlerStatus(() => store.speichern('r1', { rezept: rezept('r1'), notizen: '', basisRev: null }))).toBe(400); // Datei fehlt
  });

  it('speichert lesbare Dateien und erkennt Konflikte', () => {
    const a = store.speichern('r1', { rezept: rezept('r1'), notizen: '## Tipp', basisRev: null, medien: { 'bild-1.jpg': BILD } });
    expect(a.slug).toBe('testrezept');
    const yaml = fs.readFileSync(path.join(dir, 'rezepte/testrezept/rezept.yaml'), 'utf8');
    expect(yaml).toContain('titel: Testrezept');
    expect(fs.readFileSync(path.join(dir, 'rezepte/testrezept/notizen.md'), 'utf8')).toBe('## Tipp\n');

    const b = store.speichern('r1', { rezept: rezept('r1'), notizen: 'neu', basisRev: a.rev });
    expect(b.rev).toBeGreaterThan(a.rev);
    // veraltete Basis → Konflikt
    expect(fehlerStatus(() => store.speichern('r1', { rezept: rezept('r1'), notizen: 'alt', basisRev: a.rev }))).toBe(409);
  });

  it('benennt den Ordner bei Titeländerung um und liefert Änderungen für den Sync', () => {
    const a = store.speichern('r1', { rezept: rezept('r1'), notizen: '', basisRev: null, medien: { 'bild-1.jpg': BILD } });
    store.speichern('r1', { rezept: rezept('r1', 'Käsespätzle'), notizen: '', basisRev: a.rev });
    expect(fs.existsSync(path.join(dir, 'rezepte/kaesespaetzle/bild-1.jpg'))).toBe(true);
    const { aenderungen } = store.aenderungen(a.rev);
    expect(aenderungen).toHaveLength(1);
    expect(aenderungen[0].slug).toBe('kaesespaetzle');
    expect(aenderungen[0].medien?.[0].name).toBe('bild-1.jpg');
  });

  it('übernimmt Handänderungen und Löschungen (Papierkorb + Tombstone)', () => {
    const a = store.speichern('r1', { rezept: rezept('r1'), notizen: '', basisRev: null, medien: { 'bild-1.jpg': BILD } });
    const datei = path.join(dir, 'rezepte/testrezept/rezept.yaml');
    fs.writeFileSync(datei, fs.readFileSync(datei, 'utf8').replace('Testrezept', 'Von Hand'));
    store.abgleichen();
    expect(store.liste()[0].titel).toBe('Von Hand');

    // neuer Ordner ohne ID bekommt eine
    fs.mkdirSync(path.join(dir, 'rezepte/handarbeit'));
    fs.writeFileSync(path.join(dir, 'rezepte/handarbeit/rezept.yaml'), 'titel: Handarbeit\n');
    store.abgleichen();
    expect(fs.readFileSync(path.join(dir, 'rezepte/handarbeit/rezept.yaml'), 'utf8')).toMatch(/^id: /);
    expect(store.liste().find((r) => r.titel === 'Handarbeit')?.bildFehlt).toBe(true);

    store.loeschen('r1', null);
    expect(fs.readdirSync(path.join(dir, 'papierkorb'))).toHaveLength(1);
    const tomb = store.aenderungen(a.rev).aenderungen.find((x) => x.id === 'r1');
    expect(tomb?.geloescht).toBe(true);
  });
});
