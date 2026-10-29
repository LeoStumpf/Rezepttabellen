import { describe, it, expect } from 'vitest';
import { vergleicheVarianten, variantenDerGruppe, leseRezeptYaml, rezeptZuYaml, type Rezept } from './index.ts';

const rezept = (zutaten: Rezept['zutaten']): Rezept => ({ id: 'x', titel: 'T', tags: [], bilder: [], schritte: [], zutaten });

describe('Varianten', () => {
  it('sortiert nach nr, dann nach Name', () => {
    const liste = [
      { id: 'a', variante: { gruppe: 'Apfelkuchen', name: 'Streusel' } },
      { id: 'b', variante: { gruppe: 'Apfelkuchen', name: 'Versunken', nr: 1 } },
      { id: 'c', variante: { gruppe: 'Apfelmus', name: 'Klassisch' } },
      { id: 'd', variante: { gruppe: 'Apfelkuchen', name: 'Gedeckt' } },
      { id: 'e' },
    ];
    expect(variantenDerGruppe(liste, 'Apfelkuchen').map((r) => r.id)).toEqual(['b', 'd', 'a']);
  });

  it('trennt gemeinsame Basis und Extras und zählt doppelte Zutaten zusammen', () => {
    const versunken = rezept([
      { id: 'mehl', menge: 200, einheit: 'g', name: 'Mehl' },
      { id: 'butter', menge: 125, einheit: 'g', name: 'Butter', hinweis: 'weich' },
      { id: 'aepfel', menge: 4, einheit: 'Stück', name: 'Äpfel' },
    ]);
    const streusel = rezept([
      { id: 'mehl', menge: 200, einheit: 'g', name: 'Mehl' },
      { id: 'butter1', menge: 125, einheit: 'g', name: 'Butter' },
      { id: 'aepfel', menge: 4, einheit: 'Stück', name: 'große Äpfel' },
      { id: 'mehl2', menge: 150, einheit: 'g', name: 'Mehl' },
      { id: 'butter2', menge: 100, einheit: 'g', name: 'Butter', hinweis: 'kalt' },
      { id: 'zimt', menge: 1, einheit: 'TL', name: 'Zimt' },
    ]);
    const z = vergleicheVarianten([versunken, streusel]);
    expect(z.map((x) => [x.name, x.mengen, x.basis, x.abweichend])).toEqual([
      ['Mehl', ['200 g', '350 g'], true, true],
      ['Butter', ['125 g', '225 g'], true, true],
      ['Äpfel', ['4', '4'], true, false],
      ['Zimt', ['', '1 TL'], false, false],
    ]);
  });

  it('übersteht den YAML-Roundtrip', () => {
    const r: Rezept = { ...rezept([]), variante: { gruppe: 'Apfelmus', name: 'Mit Zimt', nr: 2 } };
    const yaml = rezeptZuYaml(r);
    expect(yaml).toContain('variante: { gruppe: Apfelmus, name: Mit Zimt, nr: 2 }');
    const wieder = leseRezeptYaml(yaml);
    expect(wieder.ok && wieder.rezept.variante).toEqual(r.variante);
  });
});
