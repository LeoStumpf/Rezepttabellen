import { describe, it, expect } from 'vitest';
import { normalisiere, findeArtikel, einkaufStatus, vorschlagName, rateKategorie, type VorratArtikel } from './vorrat.ts';

const a = (name: string, status: VorratArtikel['status'] = 'da', begriffe: string[] = []): VorratArtikel => ({
  id: name, name, status, begriffe, geaendert: '2026-10-13T10:00:00Z',
});

describe('Vorrat-Zuordnung', () => {
  it('normalisiert Plural, Adjektive und Klammern', () => {
    expect(normalisiere('große Zwiebeln (ca. 600 g)')).toBe(normalisiere('Zwiebel'));
    expect(normalisiere('Tomaten')).toBe(normalisiere('Tomate'));
    expect(normalisiere('glatte Petersilie')).toBe(normalisiere('Petersilie'));
  });

  const vorrat = [a('Salz'), a('Olivenöl'), a('Parmesan', 'knapp'), a('Chilischoten'), a('Zwiebeln', 'leer'), a('Pfeffer'), a('schwarzer Pfeffer')];

  it('findet Artikel über ganze Wörter', () => {
    expect(findeArtikel('grobes Salz', vorrat)?.name).toBe('Salz');
    expect(findeArtikel('Parmesan am Stück', vorrat)?.name).toBe('Parmesan');
    expect(findeArtikel('getrocknete Chilischoten', vorrat)?.name).toBe('Chilischoten');
    expect(findeArtikel('frische rote Chilischoten', vorrat)?.name).toBe('Chilischoten');
  });

  it('kein Treffer über Wortenden und spezifischster Artikel gewinnt', () => {
    expect(findeArtikel('neutrales Öl', vorrat)).toBeUndefined();
    expect(findeArtikel('Öl', [a('Olivenöl')])).toBeUndefined();
    expect(findeArtikel('schwarzer Pfeffer', vorrat)?.name).toBe('schwarzer Pfeffer');
  });

  it('gelernte Begriffe haben Vorrang', () => {
    const v = [a('Salz'), a('Sonnenblumenöl', 'da', [normalisiere('neutrales Öl')])];
    expect(findeArtikel('neutrales Öl', v)?.name).toBe('Sonnenblumenöl');
  });

  it('Status: leer und unbekannt = kaufen', () => {
    expect(einkaufStatus('große Zwiebeln', vorrat).status).toBe('kaufen');
    expect(einkaufStatus('Linguine', vorrat).status).toBe('kaufen');
    expect(einkaufStatus('Parmesan', vorrat).status).toBe('knapp');
    expect(einkaufStatus('Salz', vorrat).status).toBe('da');
  });

  it('Vorschläge für Name und Kategorie', () => {
    expect(vorschlagName('große Zwiebeln (ca. 600 g)')).toBe('Zwiebeln');
    expect(vorschlagName('Basilikum oder Petersilie')).toBe('Basilikum');
    expect(vorschlagName('Kreuzkümmel, gemahlen')).toBe('Kreuzkümmel');
    expect(vorschlagName('Rotwein- oder Sherryessig')).toBe('Rotwein- oder Sherryessig');
    expect(normalisiere('Gemahlener Kreuzkümmel')).toBe(normalisiere('Kreuzkümmel'));
    expect(rateKategorie('Kreuzkümmel')).toBe('Gewürze');
    expect(rateKategorie('Olivenöl')).toBe('Öl & Essig');
    expect(['Babyspinat', 'Basmatireis', 'Gemüsebrühe', 'Kidneybohnen', 'Kirschtomaten'].map(rateKategorie)).toEqual(['Frisch', 'Vorratsschrank', 'Vorratsschrank', 'Vorratsschrank', 'Frisch']);
    expect(rateKategorie('Linguine')).toBe('Vorratsschrank');
    expect(rateKategorie('Butter')).toBe('Kühlschrank');
    expect(rateKategorie('Parmesan')).toBe('Kühlschrank');
    expect(rateKategorie('Tomaten')).toBe('Frisch');
    expect(rateKategorie('Zitrone')).toBe('Frisch');
  });
});
