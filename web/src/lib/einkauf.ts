import { addiereMengen, neueId, normalisiere, skaliereMenge, vorschlagName, type EinkaufPosten, type Zutat } from '@mrt/shared';
import { einkauf } from './sammlung.svelte.ts';
import { neuerArtikel, setzeStatus, statusVon } from './vorrat.svelte.ts';

/**
 * Zutaten eines Rezepts auf die Einkaufsliste setzen. Gleiche Zutaten mit passender Einheit
 * werden zu offenen Posten addiert, sonst als eigener Posten angelegt. Gibt die Anzahl zurück.
 */
export async function aufDieListe(rezeptTitel: string, zutaten: Zutat[], faktor = 1): Promise<number> {
  const offen = einkauf.eintraege.filter((p) => !p.abgehakt);
  const geaendert = new Map<string, EinkaufPosten>();
  for (const z of zutaten) {
    // voller Name („große rote oder weiße Zwiebel“) – auf dem Einkaufszettel zählt jedes Wort
    const name = z.name.replace(/\s*\([^)]*\)/g, '').trim().replace(/^./, (c) => c.toUpperCase());
    const menge = { menge: skaliereMenge(z.menge, z.einheit, faktor), einheit: z.einheit };
    const schluessel = normalisiere(name);
    let fertig = false;
    const kandidaten = new Map([...offen.map((p) => [p.id, p] as const), ...geaendert]);
    for (const p of kandidaten.values()) {
      if (normalisiere(p.name) !== schluessel) continue;
      const summe = addiereMengen(p, menge);
      if (!summe) continue;
      geaendert.set(p.id, { ...p, ...summe, rezepte: p.rezepte.includes(rezeptTitel) ? p.rezepte : [...p.rezepte, rezeptTitel] });
      fertig = true;
      break;
    }
    if (!fertig) {
      const id = neueId();
      geaendert.set(id, { id, name, ...menge, rezepte: [rezeptTitel], abgehakt: false, geaendert: '' });
    }
  }
  await einkauf.speichern([...geaendert.values()]);
  return zutaten.length;
}

/** Freier Eintrag („Klopapier“, „2 Zitronen“). */
export function postenHinzufuegen(name: string) {
  const sauber = name.trim();
  if (!sauber) return Promise.resolve();
  return einkauf.speichern([{ id: neueId(), name: sauber, rezepte: [], abgehakt: false, geaendert: '' }]);
}

export function abhaken(p: EinkaufPosten) {
  return einkauf.speichern([{ ...p, abgehakt: !p.abgehakt }]);
}

/** Abgehakte Posten kommen als „da“ in den Vorrat und verschwinden von der Liste. */
export async function einkaufFertig(): Promise<number> {
  const erledigt = einkauf.eintraege.filter((p) => p.abgehakt);
  for (const p of erledigt) {
    const { artikel } = statusVon(p.name);
    await (artikel ? setzeStatus(artikel, 'da') : neuerArtikel(vorschlagName(p.name), 'da', undefined, p.name));
  }
  await einkauf.loeschen(erledigt);
  return erledigt.length;
}
