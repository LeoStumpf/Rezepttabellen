import type { Ernaehrung, KuehlschrankTreffer, RezeptInfo } from '@mrt/shared';

/** Ein Rezept in der Übersicht, egal in welcher Darstellung (Kacheln, Details, Discover). */
export interface UebersichtEintrag {
  r: RezeptInfo;
  /** Zutatennamen (für Details und den Einkaufsstand) */
  zutaten: string[];
  /** was laut Vorrat noch fehlt; null, solange kein Vorrat gepflegt ist */
  zuKaufen: string[] | null;
  /** nur im Kühlschrank-Modus */
  k?: { treffer: KuehlschrankTreffer[]; fehlt: string[]; fehlend: string[] | null };
  favorit: boolean;
  /** zuletzt gekocht (ISO) */
  zuletzt?: string;
  /** steht für eine ganze Variantengruppe: so viele Varianten passen zum Filter */
  varianten?: number;
}

/** Varianten einer Gruppe zu einem Eintrag zusammenfassen, an der Stelle der ersten in der Liste. */
export function variantenZusammenfassen(eintraege: UebersichtEintrag[]): UebersichtEintrag[] {
  const gruppen = new Map<string, UebersichtEintrag>();
  const aus: UebersichtEintrag[] = [];
  for (const e of eintraege) {
    const g = e.r.variante?.gruppe;
    const vertreter = g ? gruppen.get(g) : undefined;
    if (vertreter) {
      vertreter.varianten = (vertreter.varianten ?? 1) + 1;
      // Bild und Eckdaten von der ersten Variante, der Platz in der Liste bleibt
      if ((e.r.variante!.nr ?? 999) < (vertreter.r.variante!.nr ?? 999)) Object.assign(vertreter, { ...e, varianten: vertreter.varianten });
    } else {
      const neu = { ...e };
      if (g) gruppen.set(g, neu);
      aus.push(neu);
    }
  }
  return aus;
}

/** Verweis eines Übersichtseintrags: eine Gruppe öffnet den Vergleich, sonst das Rezept. */
export const eintragHref = (r: RezeptInfo, varianten?: number) =>
  varianten && varianten > 1 && r.variante ? `#/varianten/${encodeURIComponent(r.variante.gruppe)}` : `#/rezept/${encodeURIComponent(r.id)}`;

export const ERNAEHRUNG_ICON: Record<Ernaehrung, string> = { Vegan: '🌱', Vegetarisch: '🥕', Pescetarisch: '🐟', Fleisch: '🍖' };

export const zutatenWort = (n: number) => (n === 1 ? 'Zutat' : 'Zutaten');
