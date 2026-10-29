import {
  einkaufStatus,
  neueId,
  normalisiere,
  rateKategorie,
  type EinkaufStatus,
  type VorratArtikel,
  type VorratStatus,
} from '@mrt/shared';
import { store, istApp } from './app.ts';

/** Gemeinsamer, reaktiver Vorratszustand für alle Seiten. */
export const vorrat = $state({ artikel: [] as VorratArtikel[], geladen: false, fehler: '' });

let laedt: Promise<void> | null = null;

export function vorratLaden(): Promise<void> {
  laedt ??= store
    .vorratLaden()
    .then((liste) => {
      vorrat.artikel = liste;
      vorrat.geladen = true;
      vorrat.fehler = '';
    })
    .catch((e) => {
      vorrat.fehler = (e as Error).message;
    })
    .finally(() => (laedt = null));
  return laedt;
}

// Mehrere offene Browser-Sitzungen im LAN: beim Zurückkehren neu laden
if (!istApp) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && vorrat.geladen) void vorratLaden();
  });
}

const jetzt = () => new Date().toISOString();

async function speichern(geaendert: VorratArtikel[]) {
  const stempel = jetzt();
  const neu = geaendert.map((a) => ({ ...$state.snapshot(a), geaendert: stempel }) as VorratArtikel);
  // sofort anzeigen, dann speichern
  const map = new Map(vorrat.artikel.map((a) => [a.id, a]));
  for (const a of neu) {
    if (a.geloescht) map.delete(a.id);
    else map.set(a.id, a);
  }
  vorrat.artikel = [...map.values()];
  try {
    await store.vorratSpeichern(neu);
    vorrat.fehler = '';
  } catch (e) {
    vorrat.fehler = `Speichern fehlgeschlagen: ${(e as Error).message}`;
    await vorratLaden();
  }
}

export const VORRAT_ICON = { da: '✓', knapp: '⚠', kaufen: '🛒' } as const;

/**
 * Wie eine Rezeptzutat markiert wird: In der Einkaufsansicht alles (auch „kaufen“),
 * sonst nur dezent, was laut Vorrat da oder knapp ist.
 */
export function vorratMarkierung(z: { name: string }, einkauf: boolean, dezent: boolean): EinkaufStatus | null {
  if (!z.name || !(einkauf || dezent) || !vorrat.artikel.length) return null;
  const { status } = statusVon(z.name);
  return einkauf || status !== 'kaufen' ? status : null;
}

export function statusVon(zutatName: string): { status: EinkaufStatus; artikel?: VorratArtikel } {
  return einkaufStatus(zutatName, vorrat.artikel);
}

export function setzeStatus(a: VorratArtikel, status: VorratStatus) {
  return speichern([{ ...a, status }]);
}

export function setzeKategorie(a: VorratArtikel, kategorie: string) {
  return speichern([{ ...a, kategorie }]);
}

export function umbenennen(a: VorratArtikel, name: string) {
  return speichern([{ ...a, name: name.trim() || a.name }]);
}

export function loeschen(a: VorratArtikel) {
  return speichern([{ ...a, geloescht: true }]);
}

/** Legt einen Artikel an (oder setzt einen gleichnamigen wieder auf den Status). */
export function neuerArtikel(name: string, status: VorratStatus = 'da', kategorie?: string, zutatName?: string) {
  const sauber = name.trim();
  if (!sauber) return Promise.resolve();
  const begriffe = zutatName && normalisiere(zutatName) !== normalisiere(sauber) ? [normalisiere(zutatName)] : [];
  const vorhanden = vorrat.artikel.find((a) => normalisiere(a.name) === normalisiere(sauber));
  const aenderungen: VorratArtikel[] = [];
  if (vorhanden) aenderungen.push({ ...vorhanden, status, begriffe: [...new Set([...vorhanden.begriffe, ...begriffe])] });
  else
    aenderungen.push({ id: neueId(), name: sauber, kategorie: kategorie ?? rateKategorie(sauber), status, begriffe, geaendert: jetzt() });
  return speichern([...aenderungen, ...begriffEntfernen(begriffe[0], vorhanden?.id)]);
}

/** Merkt sich, dass diese Rezeptzutat zu einem bestimmten Artikel gehört. */
export function zuordnen(zutatName: string, a: VorratArtikel) {
  const b = normalisiere(zutatName);
  const geaendert = begriffEntfernen(b, a.id);
  if (normalisiere(a.name) !== b && !a.begriffe.includes(b)) geaendert.push({ ...a, begriffe: [...a.begriffe, b] });
  return geaendert.length ? speichern(geaendert) : Promise.resolve();
}

/** Gelernte Zuordnung wieder lösen. */
export function zuordnungLoesen(zutatName: string) {
  const geaendert = begriffEntfernen(normalisiere(zutatName));
  return geaendert.length ? speichern(geaendert) : Promise.resolve();
}

function begriffEntfernen(b: string | undefined, ausser?: string): VorratArtikel[] {
  if (!b) return [];
  return vorrat.artikel.filter((a) => a.id !== ausser && a.begriffe.includes(b)).map((a) => ({ ...a, begriffe: a.begriffe.filter((x) => x !== b) }));
}
