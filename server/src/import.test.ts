import { describe, it, expect } from 'vitest';
import { pruefeRezept } from '@mrt/shared';
import { rezeptAusHtml, IMPORT_MARKE } from './import.ts';

const seite = (json: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`;

describe('rezeptAusHtml', () => {
  it('übernimmt schema.org/Recipe aus einem @graph (WordPress-Plugins)', () => {
    const html = seite({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Blog' },
        {
          '@type': 'Recipe',
          name: 'Linsen-Dal mit Spinat &amp; Kokos',
          description: 'Ein schnelles Dal. Cremig und würzig. Perfekt für unter der Woche, wenn es schnell gehen muss und trotzdem gut schmecken soll – mit wenigen Zutaten aus dem Vorrat und frischem Spinat am Ende.',
          recipeYield: ['4', '4 Portionen'],
          totalTime: 'PT40M',
          prepTime: 'PT15M',
          image: [{ '@type': 'ImageObject', url: 'https://example.org/dal.jpg' }],
          suitableForDiet: 'https://schema.org/VeganDiet',
          publisher: { '@type': 'Organization', name: 'Kochblog' },
          recipeIngredient: ['1 Zwiebel, fein gewürfelt', '2 Knoblauchzehen', '200 g rote Linsen', '400 ml Kokosmilch', '100 g Spinat', 'Salz'],
          recipeInstructions: [
            { '@type': 'HowToSection', name: 'Dal', itemListElement: [
              { '@type': 'HowToStep', text: 'Zwiebel und Knoblauch in Öl 5 Minuten anbraten.' },
              { '@type': 'HowToStep', text: 'Linsen und Kokosmilch zugeben und 20 Minuten köcheln.' },
            ] },
            { '@type': 'HowToStep', text: 'Spinat unterheben, mit Salz abschmecken.' },
          ],
        },
      ],
    });
    const { rezept, notizen, bildUrl, hinweise } = rezeptAusHtml(html, 'https://www.example.org/dal');
    expect(rezept.titel).toBe('Linsen-Dal mit Spinat & Kokos');
    expect(rezept.portionen).toBe(4);
    expect(rezept.zeit).toEqual({ gesamt_min: 40, aktiv_min: 15 });
    expect(rezept.tags).toEqual(['vegan']);
    expect(rezept.quelle).toEqual({ name: 'Kochblog', url: 'https://www.example.org/dal' });
    expect(rezept.untertitel!.length).toBeLessThanOrEqual(222);
    expect(rezept.zutaten.map((z) => [z.menge, z.einheit, z.name])).toEqual([
      [1, undefined, 'Zwiebel'],
      [2, 'Zehe', 'Knoblauch'],
      [200, 'g', 'Rote Linsen'],
      [400, 'ml', 'Kokosmilch'],
      [100, 'g', 'Spinat'],
      [undefined, undefined, 'Salz'],
    ]);
    expect(rezept.schritte.map((s) => s.nimmt)).toEqual([
      ['zwiebel', 'knoblauch'],
      ['s1', 'rote_linsen', 'kokosmilch'],
      ['s2', 'spinat', 'salz'],
    ]);
    expect(pruefeRezept(rezept).ok).toBe(true);
    expect(bildUrl).toBe('https://example.org/dal.jpg');
    expect(notizen).toContain(IMPORT_MARKE);
    expect(hinweise.some((h) => /geraten/.test(h))).toBe(true);
  });

  it('Anleitung als Text, Rezept direkt als Objekt', () => {
    const html = seite({ '@type': ['Recipe'], name: 'Toast', recipeIngredient: ['2 Scheiben Brot', 'Butter'], recipeInstructions: 'Brot toasten.\nMit Butter bestreichen.' });
    const { rezept } = rezeptAusHtml(html, 'https://toast.example/');
    expect(rezept.schritte.map((s) => s.text)).toEqual(['Brot toasten.', 'Mit Butter bestreichen.']);
    expect(rezept.quelle?.name).toBe('toast.example');
    expect(pruefeRezept(rezept).ok).toBe(true);
  });

  it('Chefkoch: Verweise im @graph, Autor im Titel', () => {
    const html = seite({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Recipe', name: 'Kirschtaschen von Chefkoch_Christina', author: { '@id': '#autor' }, image: { '@id': '#bild' }, publisher: { '@id': '#org' }, recipeIngredient: ['1 Stück(e) Eigelb', '2 Pck. Blätterteig'], recipeInstructions: [{ '@type': 'HowToStep', text: 'Blätterteig mit Eigelb bestreichen.' }] },
        { '@id': '#autor', '@type': 'Person', name: 'Chefkoch_Christina' },
        { '@id': '#bild', '@type': 'ImageObject', url: 'https://img.example/k.jpg' },
        { '@id': '#org', '@type': 'Organization', name: 'Chefkoch' },
      ],
    });
    const { rezept, bildUrl } = rezeptAusHtml(html, 'https://www.chefkoch.de/rezepte/1/k.html');
    expect(rezept.titel).toBe('Kirschtaschen');
    expect(rezept.quelle?.name).toBe('Chefkoch');
    expect(bildUrl).toBe('https://img.example/k.jpg');
    expect(rezept.zutaten[0]).toMatchObject({ menge: 1, einheit: 'Stück', name: 'Eigelb' });
  });

  it('ohne Rezeptdaten: verständlicher Fehler', () => {
    expect(() => rezeptAusHtml('<html><script type="application/ld+json">{"@type":"WebPage"}</script></html>', 'https://x.example')).toThrow(/keine Rezeptdaten/);
  });
});
