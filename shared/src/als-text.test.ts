import { describe, it, expect } from 'vitest';
import { einkaufAlsText, rezeptAlsText } from './als-text.ts';
import type { Rezept } from './schema.ts';

const r: Rezept = {
  id: 'r1',
  titel: 'Dal',
  portionen: 2,
  zeit: { gesamt_min: 30 },
  tags: [],
  bilder: ['a.jpg'],
  quelle: { name: 'Kochblog', url: 'https://example.org/dal' },
  zutaten: [
    { id: 'linsen', menge: 200, einheit: 'g', name: 'Rote Linsen' },
    { id: 'salz', einheit: 'nach Geschmack', name: 'Salz' },
  ],
  schritte: [
    { id: 's1', text: 'Linsen kochen.', nimmt: ['linsen'] },
    { id: 's2', text: 'Salzen.', nimmt: ['s1', 'salz'] },
  ],
};

describe('als Text', () => {
  it('Rezept mit Faktor, Schritten, Quelle und Link', () => {
    expect(rezeptAlsText(r, { faktor: 2, link: 'http://pi/#/rezept/r1' })).toBe(
      'Dal\n4 Portionen · 30 min\n\nZutaten:\n• 400 g Rote Linsen\n• n. B. Salz\n\nZubereitung:\n1. Linsen kochen.\n2. Salzen.\n\nQuelle: Kochblog – https://example.org/dal\n\nhttp://pi/#/rezept/r1',
    );
  });
  it('nur Zutaten', () => {
    expect(rezeptAlsText(r, { nurZutaten: true })).toBe('Dal\n2 Portionen · 30 min\n\nZutaten:\n• 200 g Rote Linsen\n• n. B. Salz');
  });
  it('Einkaufsliste, Abgehaktes am Ende', () => {
    const p = (name: string, abgehakt: boolean, menge?: number) => ({ id: name, name, menge, einheit: menge ? ('g' as const) : undefined, rezepte: [], abgehakt, geaendert: 'x' });
    expect(einkaufAlsText([p('Mehl', true, 500), p('Zitronen', false)])).toBe('Einkaufsliste\n• Zitronen\n\nSchon im Wagen:\n✓ 500 g Mehl');
  });
});
