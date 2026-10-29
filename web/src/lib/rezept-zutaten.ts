import type { RezeptInfo } from '@mrt/shared';
import { store } from './app.ts';

/** Zuletzt geladene Zutatennamen je Rezept-ID – damit Seitenwechsel nicht flackern. */
const zuletzt = new Map<string, string[]>();

export function bekannteZutaten(liste: RezeptInfo[]): Map<string, string[]> {
  return new Map(liste.map((i) => [i.id, zuletzt.get(i.id) ?? []]));
}

/** Lädt die Zutatennamen aller Rezepte parallel (die Übersicht kennt nur Titel und Tags). */
export async function zutatenLaden(liste: RezeptInfo[]): Promise<Map<string, string[]>> {
  await Promise.all(
    liste.map(async (info) => {
      const d = await store.laden(info.id).catch(() => null);
      if (d) zuletzt.set(info.id, (d.rezept?.zutaten ?? []).map((z) => z.name).filter(Boolean));
    }),
  );
  return bekannteZutaten(liste);
}
