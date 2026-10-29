import { describe, it, expect } from 'vitest';
import { zutatAusZeile as z } from './zutat-zeile.ts';

describe('zutatAusZeile', () => {
  it('Menge, Einheit, Name', () => {
    expect(z('250 g Mehl (Type 550)')).toEqual({ menge: 250, einheit: 'g', name: 'Mehl', hinweis: 'Type 550' });
    expect(z('1/2 TL Salz')).toEqual({ menge: 0.5, einheit: 'TL', name: 'Salz', hinweis: undefined });
    expect(z('1 ½ Esslöffel Olivenöl')).toMatchObject({ menge: 1.5, einheit: 'EL', name: 'Olivenöl' });
    expect(z('2 EL. Sojasauce')).toMatchObject({ menge: 2, einheit: 'EL', name: 'Sojasauce' });
    expect(z('1 Pck. Backpulver')).toMatchObject({ menge: 1, einheit: 'Packung', name: 'Backpulver' });
    expect(z('400 ml Kokosmilch')).toMatchObject({ menge: 400, einheit: 'ml', name: 'Kokosmilch' });
    expect(z('1,5 kg Kartoffeln, festkochend')).toEqual({ menge: 1.5, einheit: 'kg', name: 'Kartoffeln', hinweis: 'festkochend' });
    expect(z('2 cl Rum')).toMatchObject({ menge: 20, einheit: 'ml', name: 'Rum' });
    expect(z('1500 g Mehl')).toMatchObject({ menge: 1.5, einheit: 'kg' });
    expect(z('2 tbsp sunflower oil')).toMatchObject({ menge: 2, einheit: 'EL', name: 'Sunflower oil' });
    expect(z('3 Zehe(n) Knoblauch')).toMatchObject({ menge: 3, einheit: 'Zehe', name: 'Knoblauch' });
  });
  it('Stückzahlen, Spannen, Knoblauch', () => {
    expect(z('2 Zwiebeln, fein gewürfelt')).toEqual({ menge: 2, einheit: undefined, name: 'Zwiebeln', hinweis: 'fein gewürfelt' });
    expect(z('2-3 Knoblauchzehen')).toMatchObject({ menge: 2, einheit: 'Zehe', name: 'Knoblauch' });
    expect(z('3 Zehen Knoblauch')).toMatchObject({ menge: 3, einheit: 'Zehe', name: 'Knoblauch' });
    expect(z('1 Dose Tomaten (400 g)')).toMatchObject({ menge: 1, einheit: 'Dose', name: 'Tomaten', hinweis: '400 g' });
    expect(z('1 Bund Petersilie')).toMatchObject({ menge: 1, einheit: 'Bund', name: 'Petersilie' });
  });
  it('ohne Menge und nach Geschmack', () => {
    expect(z('Salz und Pfeffer')).toEqual({ menge: undefined, einheit: undefined, name: 'Salz und Pfeffer', hinweis: undefined });
    expect(z('etwas Zitronensaft')).toMatchObject({ einheit: 'nach Geschmack', name: 'Zitronensaft' });
    expect(z('Chiliflocken nach Belieben')).toMatchObject({ einheit: 'nach Geschmack', name: 'Chiliflocken' });
    expect(z('1 Prise Zucker')).toMatchObject({ menge: 1, einheit: 'Prise', name: 'Zucker' });
  });
});
