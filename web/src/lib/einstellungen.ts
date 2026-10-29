/** Kleine, gerätelokale Einstellungen (localStorage, fehlertolerant). */
function lesen(k: string): string {
  try {
    return localStorage.getItem(`mrt.${k}`) ?? '';
  } catch {
    return '';
  }
}
function schreiben(k: string, v: string) {
  try {
    localStorage.setItem(`mrt.${k}`, v);
  } catch {
    /* privat/gesperrt – egal */
  }
}

// Vorbelegung fürs APK (web/.env.android.local, nicht im Repo) – greift, solange nichts eingetragen ist
const VORGABE_SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';
const VORGABE_PASSWORT = (import.meta.env.VITE_APP_PASSWORT as string | undefined) ?? '';

export type Ansicht = 'schritte' | 'tabelle' | 'liste';
export type UebersichtModus = 'kacheln' | 'details' | 'discover';
export const SORTIERUNGEN = { az: 'A–Z', neu: 'Neu', schnell: 'Schnell', zuletzt: 'Zuletzt gekocht', lange: 'Lange nicht gekocht' } as const;
export type Sortierung = keyof typeof SORTIERUNGEN;

export const einstellungen = {
  get serverUrl() {
    return lesen('serverUrl') || VORGABE_SERVER;
  },
  set serverUrl(v: string) {
    schreiben('serverUrl', v.trim().replace(/\/+$/, ''));
  },
  get passwort() {
    return lesen('passwort') || VORGABE_PASSWORT;
  },
  set passwort(v: string) {
    schreiben('passwort', v);
  },
  /** Rezeptdarstellung; ohne eigene Wahl immer die Tabelle */
  get ansicht(): Ansicht {
    const v = lesen('rezeptansicht');
    return v === 'schritte' || v === 'liste' ? v : 'tabelle';
  },
  set ansicht(v: Ansicht) {
    schreiben('rezeptansicht', v);
  },
  /** Darstellung der Übersicht */
  get uebersicht(): UebersichtModus {
    const v = lesen('uebersicht');
    return v === 'details' || v === 'discover' ? v : 'kacheln';
  },
  set uebersicht(v: UebersichtModus) {
    schreiben('uebersicht', v);
  },
  get sortierung(): Sortierung {
    const v = lesen('sortierung');
    return v in SORTIERUNGEN ? (v as Sortierung) : 'az';
  },
  set sortierung(v: Sortierung) {
    schreiben('sortierung', v);
  },
  get einkauf(): boolean {
    return lesen('einkauf') === '1';
  },
  set einkauf(v: boolean) {
    schreiben('einkauf', v ? '1' : '');
  },
  /** Was gerade im Kühlschrank liegt (Kühlschrank-Modus der Übersicht) */
  get kuehlschrank(): string[] {
    try {
      const v = JSON.parse(lesen('kuehlschrank') || '[]');
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  },
  set kuehlschrank(v: string[]) {
    schreiben('kuehlschrank', JSON.stringify(v));
  },
};
