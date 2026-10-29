import type { Rezept, Zutat, Schritt } from './schema.ts';

/**
 * Layout im Stil von „Cooking for Engineers“:
 * Jede Zutat ist eine Zeile (Spalte 0 = Menge, Spalte 1 = Zutat).
 * Jeder Schritt ist eine Zelle, die sich per rowspan über alle Zutaten
 * erstreckt, die (direkt oder über Vorschritte) in ihn eingehen.
 * Jeder Schritt beginnt so weit links wie möglich (Spalte = längster Weg zu
 * einer Zutat) und reicht per colspan bis zu dem Schritt, in den er eingeht.
 * So steht alles, was sofort losgehen kann, in der ersten Spalte.
 * Zutaten werden per colspan bis zu ihrem ersten Schritt gestreckt.
 */
export type Zelle =
  | { art: 'menge'; zutat: Zutat; rowspan: 1; colspan: 1 }
  | { art: 'zutat'; zutat: Zutat; rowspan: 1; colspan: number }
  | { art: 'schritt'; schritt: Schritt; nummer: number; spalte: number; rowspan: number; colspan: number };

export interface TabellenLayout {
  /** Anzahl Schrittspalten */
  schrittSpalten: number;
  zeilen: Zelle[][];
  /** Schritte in Ausführungsreihenfolge (für Listenansicht), mit Nummer */
  reihenfolge: { schritt: Schritt; nummer: number }[];
}

export function berechneLayout(r: Pick<Rezept, 'zutaten' | 'schritte'>): TabellenLayout {
  const zutaten = new Map(r.zutaten.map((z) => [z.id, z]));
  const schritte = new Map(r.schritte.map((s) => [s.id, s]));
  const eltern = new Map<string, string>();
  for (const s of r.schritte) for (const n of s.nimmt) if (!eltern.has(n)) eltern.set(n, s.id);

  const kinder = (sid: string) => (schritte.get(sid)?.nimmt ?? []).filter((n) => zutaten.has(n) || schritte.has(n));

  // Höhe = längster Weg zu einer Zutat (in Schritten)
  const hoehe = new Map<string, number>();
  const berechneHoehe = (sid: string, pfad = new Set<string>()): number => {
    if (hoehe.has(sid)) return hoehe.get(sid)!;
    if (pfad.has(sid)) return 1; // Zyklus – vom Validator gemeldet
    pfad.add(sid);
    let h = 1;
    for (const k of kinder(sid)) if (schritte.has(k)) h = Math.max(h, 1 + berechneHoehe(k, pfad));
    hoehe.set(sid, h);
    return h;
  };

  // Wurzeln in Dateireihenfolge; unbenutzte Zutaten werden am Ende angehängt
  const wurzeln = r.schritte.filter((s) => !eltern.has(s.id)).map((s) => s.id);
  const spalten = Math.max(0, ...wurzeln.map((w) => berechneHoehe(w)));

  // Spalte eines Schritts: so weit links wie möglich, also seine Höhe
  const spalte = new Map<string, number>();
  const blaetter: string[] = []; // Zutaten-IDs in Zeilenreihenfolge
  const ersteZeile = new Map<string, number>();
  const anzahlZeilen = new Map<string, number>();
  const besucht = new Set<string>();

  const lauf = (sid: string) => {
    if (besucht.has(sid)) return;
    besucht.add(sid);
    spalte.set(sid, berechneHoehe(sid));
    const start = blaetter.length;
    for (const k of kinder(sid)) {
      if (schritte.has(k)) lauf(k);
      else if (!blaetter.includes(k)) blaetter.push(k);
    }
    // Schritt ohne eigene Zutaten (z. B. „Ofen vorheizen“) bekommt eine leere Zeile
    if (blaetter.length === start) blaetter.push(`__leer:${sid}`);
    ersteZeile.set(sid, start);
    anzahlZeilen.set(sid, blaetter.length - start);
  };
  for (const w of wurzeln) lauf(w);
  for (const z of r.zutaten) if (!blaetter.includes(z.id)) blaetter.push(z.id);

  // Nummerierung in Ausführungsreihenfolge: Spalte links → rechts, dann von oben nach unten
  const sortiert = [...spalte.keys()].sort(
    (a, b) => spalte.get(a)! - spalte.get(b)! || ersteZeile.get(a)! - ersteZeile.get(b)!,
  );
  const nummer = new Map(sortiert.map((sid, i) => [sid, i + 1]));

  // Breite: bis zur Spalte vor dem Schritt, in den er eingeht; Wurzeln bis zum Rand
  const breite = (sid: string) => {
    const e = eltern.get(sid);
    const ende = e && spalte.has(e) ? spalte.get(e)! : spalten + 1;
    return Math.max(1, ende - spalte.get(sid)!);
  };

  const zeilen: Zelle[][] = blaetter.map((blatt, zeilenIndex) => {
    const zeile: Zelle[] = [];
    const leer = blatt.startsWith('__leer:');
    const z = zutaten.get(blatt);
    const elternSchritt = leer ? blatt.slice(7) : eltern.get(blatt);
    const zielSpalte = elternSchritt && spalte.has(elternSchritt) ? spalte.get(elternSchritt)! : spalten + 1;
    if (leer) {
      const platzhalter: Zutat = { id: blatt, name: '' };
      zeile.push({ art: 'menge', zutat: platzhalter, rowspan: 1, colspan: 1 });
      zeile.push({ art: 'zutat', zutat: platzhalter, rowspan: 1, colspan: zielSpalte });
    } else if (z) {
      zeile.push({ art: 'menge', zutat: z, rowspan: 1, colspan: 1 });
      zeile.push({ art: 'zutat', zutat: z, rowspan: 1, colspan: zielSpalte });
    }
    // Alle Schritte, deren Block in dieser Zeile beginnt, von links nach rechts
    const beginnend = sortiert
      .filter((sid) => ersteZeile.get(sid) === zeilenIndex)
      .sort((a, b) => spalte.get(a)! - spalte.get(b)!);
    for (const sid of beginnend) {
      zeile.push({ art: 'schritt', schritt: schritte.get(sid)!, nummer: nummer.get(sid)!, spalte: spalte.get(sid)!, rowspan: anzahlZeilen.get(sid)!, colspan: breite(sid) });
    }
    return zeile;
  });

  return {
    schrittSpalten: spalten,
    zeilen,
    reihenfolge: sortiert.map((sid) => ({ schritt: schritte.get(sid)!, nummer: nummer.get(sid)! })),
  };
}
