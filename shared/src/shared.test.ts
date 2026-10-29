import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { leseRezeptYaml, rezeptZuYaml, berechneLayout, formatMenge, pruefeRezept, slugify } from './index.ts';

const mobYaml = readFileSync(new URL('./testdaten/rezept.yaml', import.meta.url), 'utf8');

describe('Rezept-YAML', () => {
  it('liest das Test-Rezept fehlerfrei', () => {
    const res = leseRezeptYaml(mobYaml);
    expect(res.ok, JSON.stringify(res)).toBe(true);
  });
  it('Roundtrip über rezeptZuYaml', () => {
    const res = leseRezeptYaml(mobYaml);
    if (!res.ok) throw new Error();
    const wieder = leseRezeptYaml(rezeptZuYaml(res.rezept));
    expect(wieder.ok && wieder.rezept).toEqual(res.rezept);
  });
  it('meldet doppelte Verwendung und Zyklen', () => {
    const basis = { id: 'x', titel: 'T', zutaten: [{ id: 'a', name: 'A' }] };
    expect(pruefeRezept({ ...basis, schritte: [{ id: 's1', text: 't', nimmt: ['a'] }, { id: 's2', text: 't', nimmt: ['a'] }] }).ok).toBe(false);
    expect(pruefeRezept({ ...basis, schritte: [{ id: 's1', text: 't', nimmt: ['s2', 'a'] }, { id: 's2', text: 't', nimmt: ['s1'] }] }).ok).toBe(false);
  });
});

it('erkennt ungequotete Kommas in einzeiligen Zutaten', () => {
  const yaml = 'id: x\ntitel: T\nzutaten:\n  - { id: a, name: Öl, hinweis: z. B. Raps, 2 EL }\n';
  expect(leseRezeptYaml(yaml).ok).toBe(false);
  expect(leseRezeptYaml(rezeptZuYaml({ id: 'x', titel: 'T', tags: [], bilder: [], schritte: [], zutaten: [{ id: 'a', name: 'Öl', hinweis: 'z. B. Raps, 2 EL' }] })).ok).toBe(true);
});

describe('Tabellen-Layout', () => {
  const res = leseRezeptYaml(mobYaml);
  if (!res.ok) throw new Error();
  const layout = berechneLayout(res.rezept);

  it('hat 7 Schrittspalten und eine Zeile pro Zutat', () => {
    expect(layout.schrittSpalten).toBe(7);
    expect(layout.zeilen).toHaveLength(12);
  });
  it('jede Zeile füllt genau die Tabellenbreite (rowspans berücksichtigt)', () => {
    const breite = 2 + layout.schrittSpalten;
    const belegt: number[] = new Array(layout.zeilen.length).fill(0);
    layout.zeilen.forEach((zeile, i) => {
      for (const z of zeile) for (let k = 0; k < z.rowspan; k++) belegt[i + k] += z.colspan;
    });
    expect(belegt).toEqual(new Array(layout.zeilen.length).fill(breite));
  });
  it('letzter Schritt umfasst alle Zeilen und hat die höchste Nummer', () => {
    const s11 = layout.zeilen[0].find((z) => z.art === 'schritt' && z.schritt.id === 's11');
    expect(s11?.rowspan).toBe(12);
    expect(s11?.art === 'schritt' && s11.nummer).toBe(11);
  });
  it('Zwiebeln: erster Schritt ganz links', () => {
    const zeile = layout.zeilen[0];
    expect(zeile[1]).toMatchObject({ art: 'zutat', colspan: 1 });
    expect(layout.reihenfolge[0].schritt.id).toBe('s1');
  });
  it('Zitrone direkt im letzten Schritt → Zutatenzelle über 7 Spalten', () => {
    const zeile = layout.zeilen.find((z) => z[0].art === 'menge' && z[0].zutat.id === 'zitrone')!;
    expect(zeile[1].colspan).toBe(7);
  });
  it('unbenutzte Zutat spannt über alle Spalten', () => {
    const l = berechneLayout({ zutaten: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], schritte: [{ id: 's', text: 'x', nimmt: ['a'] }] });
    expect(l.zeilen[1][1].colspan).toBe(2);
  });
  it('Nebenzweig beginnt ganz links und reicht bis zu seinem Zielschritt', () => {
    const l = berechneLayout({
      zutaten: [{ id: 'z', name: 'Zwiebeln' }, { id: 'n', name: 'Nudeln' }],
      schritte: [
        { id: 's1', text: 'schneiden', nimmt: ['z'] },
        { id: 's2', text: '40 min karamellisieren', nimmt: ['s1'] },
        { id: 'ofen', text: 'Ofen vorheizen', nimmt: [] },
        { id: 'kochen', text: 'Nudeln kochen', nimmt: ['n'] },
        { id: 's3', text: 'alles mischen, backen', nimmt: ['s2', 'ofen', 'kochen'] },
      ],
    });
    expect(l.schrittSpalten).toBe(3);
    const zellen = l.zeilen.flat().filter((z) => z.art === 'schritt');
    const zelle = (id: string) => zellen.find((z) => z.art === 'schritt' && z.schritt.id === id)!;
    expect(zelle('ofen')).toMatchObject({ spalte: 1, colspan: 2 });
    expect(zelle('kochen')).toMatchObject({ spalte: 1, colspan: 2 });
    expect(zelle('s3')).toMatchObject({ spalte: 3, colspan: 1 });
    expect(l.reihenfolge.slice(0, 3).map((e) => e.schritt.id)).toEqual(['s1', 'ofen', 'kochen']);
  });
});

describe('Formatierung', () => {
  it('Mengen', () => {
    expect(formatMenge(0.5, 'Stück')).toBe('½');
    expect(formatMenge(2, 'Zehe')).toBe('2 Zehen');
    expect(formatMenge(1.5, 'l')).toBe('1,5 l');
    expect(formatMenge(500, 'g')).toBe('500 g');
    expect(formatMenge(undefined, 'nach Geschmack')).toBe('n. B.');
  });
  it('Slug', () => {
    expect(slugify('Linguine mit karamellisierten Zwiebeln')).toBe('linguine-mit-karamellisierten-zwiebeln');
    expect(slugify('Käsespätzle groß')).toBe('kaesespaetzle-gross');
  });
});
