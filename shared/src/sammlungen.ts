import { z } from 'zod';
import { EINHEITEN } from './units.ts';

/**
 * Persönliche Listen (Einkaufsliste, Favoriten, Kochverlauf). Gleiches Prinzip wie der Vorrat:
 * jeder Eintrag einzeln, Last-Write-Wins über „geaendert“, Löschen als Grabstein.
 */
const basis = {
  id: z.string().min(1),
  geaendert: z.string().min(1),
  geloescht: z.boolean().optional(),
};

export const EinkaufPostenSchema = z.object({
  ...basis,
  name: z.string().min(1),
  menge: z.number().positive().nullable().optional(),
  einheit: z.enum(EINHEITEN).optional(),
  /** Titel der Rezepte, aus denen der Posten stammt */
  rezepte: z.array(z.string()).default([]),
  abgehakt: z.boolean().default(false),
});
export type EinkaufPosten = z.infer<typeof EinkaufPostenSchema>;

/** id = Rezept-ID */
export const FavoritSchema = z.object(basis);
export type Favorit = z.infer<typeof FavoritSchema>;

export const GekochtSchema = z.object({
  ...basis,
  rezeptId: z.string().min(1),
  /** ISO-Zeitpunkt */
  datum: z.string().min(1),
  bewertung: z.number().int().min(1).max(5).optional(),
  notiz: z.string().optional(),
});
export type Gekocht = z.infer<typeof GekochtSchema>;

export const SAMMLUNGEN = {
  einkauf: EinkaufPostenSchema,
  favoriten: FavoritSchema,
  gekocht: GekochtSchema,
} as const;
export type SammlungName = keyof typeof SAMMLUNGEN;
export interface SammlungTypen {
  einkauf: EinkaufPosten;
  favoriten: Favorit;
  gekocht: Gekocht;
}
export type SammlungEintrag = SammlungTypen[SammlungName];

export function istSammlung(name: string): name is SammlungName {
  return Object.hasOwn(SAMMLUNGEN, name);
}

export interface SammlungAenderungen<T = SammlungEintrag> {
  rev: number;
  eintraege: T[];
}
