import type { Rezept, Zutat } from './schema.ts';
import type { RezeptInfo } from './sync-types.ts';
import { addiereMengen, formatMenge, type Menge } from './units.ts';
import { normalisiere, vorschlagName } from './vorrat.ts';

/** Die Varianten einer Gruppe in ihrer Reihenfolge (`nr`, sonst alphabetisch). */
export function variantenDerGruppe<T extends Pick<RezeptInfo, 'variante'>>(liste: T[], gruppe: string): T[] {
  return liste
    .filter((r) => r.variante?.gruppe === gruppe)
    .sort((a, b) => (a.variante!.nr ?? 999) - (b.variante!.nr ?? 999) || a.variante!.name.localeCompare(b.variante!.name, 'de'));
}

/** Eine Zeile im Vergleich: dieselbe Zutat in allen Varianten. */
export interface VergleichsZeile {
  name: string;
  /** je Variante die Menge als Text, '' = kommt dort nicht vor */
  mengen: string[];
  /** in allen Varianten enthalten */
  basis: boolean;
  /** in allen enthalten, aber nicht überall gleich viel */
  abweichend: boolean;
}

/** Mengen einer Zutat innerhalb eines Rezepts (Butter für Teig und Streusel) zusammenzählen. */
function summe(eintraege: Zutat[]): string {
  const teile: Menge[] = [];
  for (const z of eintraege) {
    const i = teile.findIndex((t) => addiereMengen(t, z));
    if (i >= 0) teile[i] = addiereMengen(teile[i], z)!;
    else teile.push({ menge: z.menge, einheit: z.einheit });
  }
  return teile.map((t) => formatMenge(t.menge, t.einheit) || '✓').join(' + ');
}

/**
 * Zutaten mehrerer Varianten nebeneinander: zuerst die gemeinsame Basis (in der Reihenfolge der ersten
 * Variante), dann die Extras, die nur manche haben (die häufigsten zuerst). Gleich heißt: gleicher
 * Vergleichsschlüssel wie beim Vorrat („große Äpfel“ = „Äpfel“).
 */
export function vergleicheVarianten(rezepte: Rezept[]): VergleichsZeile[] {
  const zeilen = new Map<string, { name: string; je: Zutat[][]; erste: number }>();
  let pos = 0;
  rezepte.forEach((r, i) => {
    for (const z of r.zutaten) {
      const schluessel = normalisiere(z.name) || z.name.toLowerCase();
      let zeile = zeilen.get(schluessel);
      if (!zeile) {
        zeile = { name: vorschlagName(z.name), je: rezepte.map(() => []), erste: pos++ };
        zeilen.set(schluessel, zeile);
      }
      zeile.je[i].push(z);
    }
  });
  return [...zeilen.values()]
    .map((z) => {
      const mengen = z.je.map((e) => (e.length ? summe(e) : ''));
      const anzahl = mengen.filter(Boolean).length;
      const basis = anzahl === rezepte.length;
      return { zeile: { name: z.name, mengen, basis, abweichend: basis && new Set(mengen).size > 1 }, anzahl, erste: z.erste };
    })
    .sort((a, b) => Number(b.zeile.basis) - Number(a.zeile.basis) || (a.zeile.basis ? 0 : b.anzahl - a.anzahl) || a.erste - b.erste)
    .map((x) => x.zeile);
}
