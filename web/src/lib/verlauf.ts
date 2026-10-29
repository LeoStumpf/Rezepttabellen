import { neueId, type Gekocht } from '@mrt/shared';
import { favoriten, gekocht } from './sammlung.svelte.ts';

/** Favoriten und Kochverlauf – kleine Helfer über den persönlichen Listen. */
export const istFavorit = (rezeptId: string) => favoriten.eintraege.some((f) => f.id === rezeptId);

export function favoritUmschalten(rezeptId: string) {
  const f = favoriten.eintraege.find((x) => x.id === rezeptId);
  return f ? favoriten.loeschen([f]) : favoriten.speichern([{ id: rezeptId, geaendert: '' }]);
}

/** Kochverlauf eines Rezepts, neuester zuerst. */
export const gekochtVon = (rezeptId: string): Gekocht[] =>
  gekocht.eintraege.filter((g) => g.rezeptId === rezeptId).sort((a, b) => b.datum.localeCompare(a.datum));

export function gekochtEintragen(rezeptId: string, bewertung?: number, notiz?: string) {
  const datum = new Date().toISOString();
  return gekocht.speichern([{ id: neueId(), rezeptId, datum, bewertung, notiz: notiz?.trim() || undefined, geaendert: datum }]);
}

/** Zuletzt gekocht je Rezept (ISO-Datum). */
export function zuletztGekocht(): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of gekocht.eintraege) if ((m.get(g.rezeptId) ?? '') < g.datum) m.set(g.rezeptId, g.datum);
  return m;
}

/** „heute“, „gestern“, „vor 3 Tagen“, „vor 2 Wochen“ … */
export function vorWann(iso: string, jetzt = Date.now()): string {
  const tage = Math.floor((new Date(new Date(jetzt).toDateString()).getTime() - new Date(new Date(iso).toDateString()).getTime()) / 86_400_000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  if (tage < 14) return `vor ${tage} Tagen`;
  if (tage < 60) return `vor ${Math.round(tage / 7)} Wochen`;
  if (tage < 365) return `vor ${Math.round(tage / 30)} Monaten`;
  const jahre = Math.round(tage / 365);
  return jahre === 1 ? 'vor einem Jahr' : `vor ${jahre} Jahren`;
}
