import { describe, it, expect } from 'vitest';
import { ernaehrungVon, passtErnaehrung, kuehlschrankTreffer } from './filter.ts';

describe('Ernährungsform', () => {
  it('leitet die Form aus den Tags ab', () => {
    expect(ernaehrungVon(['Curry', 'Vegan'])).toBe('Vegan');
    expect(ernaehrungVon(['Pasta', 'Vegetarisch'])).toBe('Vegetarisch');
    expect(ernaehrungVon(['Fisch', 'Schnell'])).toBe('Pescetarisch');
    expect(ernaehrungVon(['Hähnchen', 'Wok'])).toBe('Fleisch');
    expect(ernaehrungVon(['Vegetarisch', 'Vegan möglich'])).toBe('Vegetarisch');
    expect(ernaehrungVon(['Dessert'])).toBeUndefined();
  });

  it('filtert hierarchisch', () => {
    expect(passtErnaehrung('Vegan', 'Vegetarisch')).toBe(true);
    expect(passtErnaehrung('Vegetarisch', 'Vegan')).toBe(false);
    expect(passtErnaehrung('Vegetarisch', 'Pescetarisch')).toBe(true);
    expect(passtErnaehrung('Fleisch', 'Pescetarisch')).toBe(false);
    expect(passtErnaehrung('Fleisch', 'Fleisch')).toBe(true);
    expect(passtErnaehrung('Vegan', 'Fleisch')).toBe(false);
    expect(passtErnaehrung(undefined, '')).toBe(true);
    expect(passtErnaehrung(undefined, 'Vegan')).toBe(false);
  });
});

describe('Kühlschrank', () => {
  const treffer = (zutaten: string[], begriff: string) => kuehlschrankTreffer(zutaten, [begriff]).flatMap((t) => t.zutaten);

  it('unterscheidet Paprika und Paprikapulver', () => {
    expect(treffer(['Paprika', 'geräuchertes Paprikapulver', 'rote Paprikaschoten'], 'Paprika')).toEqual(['Paprika', 'rote Paprikaschoten']);
  });

  it('kennt Synonyme', () => {
    expect(treffer(['Möhren', 'Zwiebeln'], 'Karotte')).toEqual(['Möhren']);
    expect(treffer(['Lauchzwiebeln'], 'Frühlingszwiebeln')).toEqual(['Lauchzwiebeln']);
  });

  it('findet Komposita, aber nicht alles', () => {
    expect(treffer(['Kirschtomaten', 'Tomatenmark', 'gehackte Tomaten'], 'Tomate')).toEqual(['Kirschtomaten', 'gehackte Tomaten']);
    expect(treffer(['Hähnchenbrustfilet', 'Gemüse- oder Hühnerbrühe'], 'Hähnchen')).toEqual(['Hähnchenbrustfilet']);
    expect(treffer(['Knoblauch', 'Lauch'], 'Lauch')).toEqual(['Lauch']);
    expect(treffer(['Basmatireis', 'Eier (Größe M)', 'asiatische Eiernudeln'], 'Ei')).toEqual(['Eier (Größe M)']);
    expect(treffer(['Feta', 'Babyspinat'], 'Spinat')).toEqual(['Babyspinat']);
    expect(treffer(['Koriandersamen', 'frischer Koriander'], 'Koriander')).toEqual(['frischer Koriander']);
  });

  it('liefert nur Begriffe mit Treffer', () => {
    expect(kuehlschrankTreffer(['Paprika', 'Zwiebel'], ['Paprika', 'Karotten']).map((t) => t.begriff)).toEqual(['Paprika']);
  });
});
