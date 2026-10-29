import type { SammlungName, SammlungTypen } from '@mrt/shared';
import { store, istApp } from './app.ts';

/** Reaktiver Zustand einer persönlichen Liste (Einkaufsliste, Favoriten, Kochverlauf) – wie der Vorrat. */
class Sammlung<N extends SammlungName> {
  eintraege = $state<SammlungTypen[N][]>([]);
  geladen = $state(false);
  fehler = $state('');
  private laedt: Promise<void> | null = null;

  constructor(readonly name: N) {}

  laden(): Promise<void> {
    this.laedt ??= store
      .sammlungLaden(this.name)
      .then((liste) => {
        this.eintraege = liste;
        this.geladen = true;
        this.fehler = '';
      })
      .catch((e) => {
        this.fehler = (e as Error).message;
      })
      .finally(() => (this.laedt = null));
    return this.laedt;
  }

  /** Sofort anzeigen, dann speichern; jeder Eintrag bekommt einen frischen Zeitstempel. */
  async speichern(geaendert: SammlungTypen[N][]) {
    if (!geaendert.length) return;
    const stempel = new Date().toISOString();
    const neu = geaendert.map((e) => ({ ...$state.snapshot(e), geaendert: stempel }) as SammlungTypen[N]);
    const map = new Map(this.eintraege.map((e) => [e.id, e]));
    for (const e of neu) {
      if (e.geloescht) map.delete(e.id);
      else map.set(e.id, e);
    }
    this.eintraege = [...map.values()];
    try {
      await store.sammlungSpeichern(this.name, neu);
      this.fehler = '';
    } catch (e) {
      this.fehler = `Speichern fehlgeschlagen: ${(e as Error).message}`;
      await this.laden();
    }
  }

  loeschen(eintraege: SammlungTypen[N][]) {
    return this.speichern(eintraege.map((e) => ({ ...e, geloescht: true })));
  }
}

export const einkauf = new Sammlung('einkauf');
export const favoriten = new Sammlung('favoriten');
export const gekocht = new Sammlung('gekocht');

export function sammlungenLaden() {
  return Promise.all([einkauf.laden(), favoriten.laden(), gekocht.laden()]);
}

// Mehrere offene Browser-Sitzungen im LAN: beim Zurückkehren neu laden
if (!istApp) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && einkauf.geladen) void sammlungenLaden();
  });
}
