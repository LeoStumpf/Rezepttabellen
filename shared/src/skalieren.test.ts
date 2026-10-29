import { describe, it, expect } from 'vitest';
import { faktorAusMenge, skaliereMenge } from './skalieren.ts';
import { addiereMengen } from './units.ts';

describe('skaliereMenge', () => {
  it('halbiert Gramm und rundet küchentauglich', () => {
    expect(skaliereMenge(500, 'g', 0.5)).toBe(250);
    expect(skaliereMenge(80, 'g', 0.5)).toBe(40);
    expect(skaliereMenge(333, 'g', 0.5)).toBe(170);
    expect(skaliereMenge(7, 'g', 0.5)).toBe(4);
  });
  it('rundet Löffel und Stück auf ¼ bzw. ½', () => {
    expect(skaliereMenge(3, 'EL', 0.5)).toBe(1.5);
    expect(skaliereMenge(1, 'TL', 0.5)).toBe(0.5);
    expect(skaliereMenge(1, 'TL', 0.3)).toBe(0.25);
    expect(skaliereMenge(3, 'Stück', 1.5)).toBe(4.5);
    expect(skaliereMenge(3, undefined, 0.5)).toBe(1.5);
  });
  it('lässt „nach Geschmack“, fehlende Mengen und Faktor 1 unverändert', () => {
    expect(skaliereMenge(2, 'nach Geschmack', 0.5)).toBe(2);
    expect(skaliereMenge(undefined, 'g', 2)).toBeUndefined();
    expect(skaliereMenge(333, 'g', 1)).toBe(333);
  });
  it('Prise bleibt mindestens 1', () => {
    expect(skaliereMenge(1, 'Prise', 0.5)).toBe(1);
  });
  it('kg und l auf 0,05', () => {
    expect(skaliereMenge(1, 'kg', 0.33)).toBe(0.35);
  });
});

it('faktorAusMenge', () => {
  expect(faktorAusMenge(250, 500)).toBe(0.5);
  expect(faktorAusMenge(250, null)).toBeNull();
  expect(faktorAusMenge(0, 500)).toBeNull();
});

describe('addiereMengen', () => {
  it('gleiche Einheit und Umrechnung g/kg, ml/l', () => {
    expect(addiereMengen({ menge: 200, einheit: 'g' }, { menge: 300, einheit: 'g' })).toEqual({ menge: 500, einheit: 'g' });
    expect(addiereMengen({ menge: 800, einheit: 'g' }, { menge: 0.5, einheit: 'kg' })).toEqual({ menge: 1.3, einheit: 'kg' });
    expect(addiereMengen({ menge: 250, einheit: 'ml' }, { menge: 1, einheit: 'l' })).toEqual({ menge: 1.25, einheit: 'l' });
    expect(addiereMengen({ menge: 2 }, { menge: 1, einheit: 'Stück' })).toEqual({ menge: 3, einheit: 'Stück' });
    expect(addiereMengen({ menge: 1, einheit: 'EL' }, { menge: 0.5, einheit: 'EL' })).toEqual({ menge: 1.5, einheit: 'EL' });
  });
  it('unverträgliche Einheiten und fehlende Mengen', () => {
    expect(addiereMengen({ menge: 200, einheit: 'g' }, { menge: 1, einheit: 'Dose' })).toBeNull();
    expect(addiereMengen({ menge: 200, einheit: 'g' }, { menge: 1, einheit: 'l' })).toBeNull();
    expect(addiereMengen({ einheit: 'nach Geschmack' }, { einheit: 'nach Geschmack' })).toEqual({ menge: null, einheit: 'nach Geschmack' });
    expect(addiereMengen({ menge: null, einheit: 'g' }, { menge: 100, einheit: 'g' })).toEqual({ menge: 100, einheit: 'g' });
  });
});
