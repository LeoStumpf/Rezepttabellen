import { berechneLayout } from './table-layout.ts';
import { formatMenge } from './units.ts';
import { skaliereMenge } from './skalieren.ts';
import type { Rezept, Zutat } from './schema.ts';
import type { EinkaufPosten } from './sammlungen.ts';

function zutatZeile(z: Pick<Zutat, 'menge' | 'einheit' | 'name' | 'hinweis'>, faktor = 1): string {
  const menge = formatMenge(skaliereMenge(z.menge, z.einheit, faktor), z.einheit);
  return `• ${menge ? `${menge} ` : ''}${z.name}${z.hinweis ? ` (${z.hinweis})` : ''}`;
}

/** Rezept als Klartext zum Teilen (WhatsApp, Mail …). */
export function rezeptAlsText(r: Rezept, opt: { faktor?: number; nurZutaten?: boolean; link?: string } = {}): string {
  const faktor = opt.faktor ?? 1;
  const teile: string[] = [r.titel];
  const portionen = r.portionen ? Math.round(r.portionen * faktor * 10) / 10 : null;
  const kopf = [portionen ? `${portionen.toLocaleString('de-DE')} ${portionen === 1 ? 'Portion' : 'Portionen'}` : '', r.zeit?.gesamt_min ? `${r.zeit.gesamt_min} min` : '']
    .filter(Boolean)
    .join(' · ');
  if (kopf) teile[0] += `\n${kopf}`;
  teile.push(['Zutaten:', ...r.zutaten.map((z) => zutatZeile(z, faktor))].join('\n'));
  if (!opt.nurZutaten && r.schritte.length) {
    const { reihenfolge } = berechneLayout(r);
    teile.push(['Zubereitung:', ...reihenfolge.map((e) => `${e.nummer}. ${e.schritt.text}`)].join('\n'));
  }
  const quelle = [r.quelle?.name, r.quelle?.url].filter(Boolean).join(' – ');
  if (!opt.nurZutaten && quelle) teile.push(`Quelle: ${quelle}`);
  if (opt.link) teile.push(opt.link);
  return teile.join('\n\n');
}

/** Einkaufsliste als Klartext, offene Posten zuerst. */
export function einkaufAlsText(posten: EinkaufPosten[]): string {
  const offen = posten.filter((p) => !p.abgehakt);
  const erledigt = posten.filter((p) => p.abgehakt);
  const zeilen = ['Einkaufsliste', ...offen.map((p) => zutatZeile(p))];
  if (erledigt.length) zeilen.push('', 'Schon im Wagen:', ...erledigt.map((p) => zutatZeile(p).replace('•', '✓')));
  return zeilen.join('\n');
}
