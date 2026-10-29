import { parse, Document, isMap, isSeq, YAMLMap } from 'yaml';
import { pruefeRezept, type Rezept, type PruefErgebnis } from './schema.ts';

export function leseRezeptYaml(text: string): PruefErgebnis {
  let daten: unknown;
  try {
    daten = parse(text);
  } catch (e) {
    return { ok: false, fehler: [`YAML-Syntaxfehler: ${(e as Error).message}`] };
  }
  return pruefeRezept(daten);
}

const SCHLUESSEL_REIHENFOLGE = [
  'id', 'titel', 'untertitel', 'variante', 'portionen', 'zeit', 'tags', 'bilder', 'quelle', 'video', 'zutaten', 'schritte', 'erstellt', 'geaendert',
];

/** Schreibt ein Rezept als gut lesbares YAML (Zutaten einzeilig, Schritte als Block). */
export function rezeptZuYaml(r: Rezept): string {
  const sortiert: Record<string, unknown> = {};
  for (const k of SCHLUESSEL_REIHENFOLGE) {
    const v = (r as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0 && k !== 'bilder') continue;
    sortiert[k] = v;
  }
  const doc = new Document(sortiert);
  const wurzel = doc.contents as YAMLMap;
  for (const k of ['variante', 'zeit', 'tags', 'bilder']) {
    const n = wurzel.get(k, true);
    if (isMap(n) || isSeq(n)) n.flow = true;
  }
  const zutaten = wurzel.get('zutaten', true);
  if (isSeq(zutaten)) for (const item of zutaten.items) if (isMap(item)) item.flow = true;
  const schritte = wurzel.get('schritte', true);
  if (isSeq(schritte)) for (const item of schritte.items) if (isMap(item)) {
    const nimmt = item.get('nimmt', true);
    if (isSeq(nimmt)) nimmt.flow = true;
  }
  return doc.toString({ lineWidth: 0 });
}
