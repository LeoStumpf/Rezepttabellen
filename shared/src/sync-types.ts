/** Ein Medium im Rezeptordner mit Inhalts-Hash (sha256, hex). */
export interface MedienInfo {
  name: string;
  hash: string;
  groesse: number;
}

export interface Aenderung {
  id: string;
  rev: number;
  geloescht: boolean;
  slug?: string;
  yaml?: string;
  notizen?: string;
  medien?: MedienInfo[];
}

export interface AenderungenAntwort {
  rev: number;
  aenderungen: Aenderung[];
}

export interface SpeichernAnfrage {
  rezept: unknown;
  notizen: string;
  /** Revision, auf der die Änderung beruht; null = neues Rezept */
  basisRev: number | null;
  /** Neue/geänderte Medien als base64 */
  medien?: Record<string, string>;
}

export interface SpeichernAntwort {
  id: string;
  rev: number;
  slug: string;
}

/** Listeneintrag für die Übersicht */
export interface RezeptInfo {
  id: string;
  slug: string;
  rev: number;
  titel: string;
  untertitel?: string;
  variante?: { gruppe: string; name: string; nr?: number };
  tags: string[];
  bild?: string;
  bildFehlt: boolean;
  fehler?: string[];
  gesamtMin?: number;
  /** ISO-Zeitpunkt der Anlage */
  erstellt?: string;
}

/** Foto-Auftrag: abfotografiertes Rezept (1–n Bilder), das auf dem Server auf Auswertung wartet. */
export interface FotoAuftragAnfrage {
  /** vom Gerät vergeben (UUID) – derselbe Auftrag wird nie doppelt angelegt */
  id: string;
  /** ISO-Zeitpunkt der Aufnahme */
  erstellt: string;
  notiz?: string;
  geraet?: string;
  /** Dateiname → base64 */
  bilder: Record<string, string>;
}

export interface FotoAuftrag {
  /** Ordnername unter foto-eingang/ */
  ordner: string;
  id: string;
  erstellt: string;
  notiz: string;
  geraet?: string;
  bilder: string[];
}
