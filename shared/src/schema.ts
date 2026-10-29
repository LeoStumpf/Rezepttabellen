import { z } from 'zod';
import { EINHEITEN } from './units.ts';

const id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'nur Kleinbuchstaben, Ziffern, - und _');

export const ZutatSchema = z.object({
  id,
  menge: z.number().positive().nullable().optional(),
  einheit: z.enum(EINHEITEN).optional(),
  name: z.string().min(1),
  hinweis: z.string().optional(),
}).strict(); // unbekannte Schlüssel = meist ein ungequotetes Komma im einzeiligen YAML

export const SchrittSchema = z.object({
  id,
  text: z.string().min(1),
  nimmt: z.array(id).min(1),
}).strict();

export const RezeptSchema = z.object({
  id: z.string().min(1),
  titel: z.string().min(1),
  untertitel: z.string().optional(),
  /** Rezepte mit derselben `gruppe` sind Varianten voneinander (z. B. Apfelkuchen: Versunken, Streusel …) */
  variante: z
    .object({
      gruppe: z.string().min(1),
      name: z.string().min(1),
      /** Reihenfolge in der Gruppe (sonst alphabetisch) */
      nr: z.number().int().optional(),
    })
    .strict()
    .optional(),
  portionen: z.number().int().positive().optional(),
  zeit: z
    .object({
      gesamt_min: z.number().int().nonnegative().optional(),
      aktiv_min: z.number().int().nonnegative().optional(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  bilder: z.array(z.string().min(1)).default([]),
  quelle: z
    .object({
      name: z.string().optional(),
      url: z.string().url().optional(),
    })
    .optional(),
  video: z
    .object({
      url: z.string().url().optional(),
      datei: z.string().nullable().optional(),
    })
    .optional(),
  zutaten: z.array(ZutatSchema).default([]),
  schritte: z.array(SchrittSchema).default([]),
  /** Zeitpunkt der Anlage (ISO), für „neu hinzugefügt“ */
  erstellt: z.string().optional(),
  geaendert: z.string().optional(),
});

export type Zutat = z.infer<typeof ZutatSchema>;
export type Schritt = z.infer<typeof SchrittSchema>;
export type Rezept = z.infer<typeof RezeptSchema>;

/** Dateiname für Medien im Rezeptordner – keine Pfade, keine versteckten Dateien. */
export function istGueltigerMedienname(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(name) && !name.includes('..') && name !== 'rezept.yaml' && name !== 'notizen.md';
}

export function medienDesRezepts(r: Rezept): string[] {
  const liste = [...r.bilder];
  if (r.video?.datei) liste.push(r.video.datei);
  return liste;
}

export type PruefErgebnis = { ok: true; rezept: Rezept } | { ok: false; fehler: string[] };

/** Schema + strukturelle Prüfung (Schrittbaum). */
export function pruefeRezept(daten: unknown): PruefErgebnis {
  const res = RezeptSchema.safeParse(daten);
  if (!res.success) {
    return {
      ok: false,
      fehler: res.error.issues.map((i) => `${i.path.join('.') || '(Rezept)'}: ${i.message}`),
    };
  }
  const r = res.data;
  const fehler: string[] = [];
  const ids = new Set<string>();
  for (const x of [...r.zutaten, ...r.schritte]) {
    if (ids.has(x.id)) fehler.push(`ID „${x.id}“ ist doppelt vergeben`);
    ids.add(x.id);
  }
  const verwendet = new Map<string, string>();
  const schrittIds = new Set(r.schritte.map((s) => s.id));
  for (const s of r.schritte) {
    for (const n of s.nimmt) {
      if (!ids.has(n)) fehler.push(`Schritt „${s.id}“ verweist auf unbekannte ID „${n}“`);
      else if (verwendet.has(n)) fehler.push(`„${n}“ wird in „${verwendet.get(n)}“ und „${s.id}“ verwendet`);
      else verwendet.set(n, s.id);
    }
  }
  // Zyklen
  const nach = new Map(r.schritte.map((s) => [s.id, s.nimmt]));
  const status = new Map<string, 1 | 2>();
  const besuche = (sid: string): boolean => {
    if (status.get(sid) === 2) return true;
    if (status.get(sid) === 1) return false;
    status.set(sid, 1);
    for (const n of nach.get(sid) ?? []) if (schrittIds.has(n) && !besuche(n)) return false;
    status.set(sid, 2);
    return true;
  };
  for (const s of r.schritte) if (!besuche(s.id)) { fehler.push(`Schritt „${s.id}“ ist Teil eines Zyklus`); break; }

  return fehler.length ? { ok: false, fehler } : { ok: true, rezept: r };
}
