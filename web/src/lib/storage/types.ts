import type { Rezept, RezeptInfo, MedienInfo, VorratArtikel, SammlungName, SammlungTypen } from '@mrt/shared';

export interface RezeptVoll {
  id: string;
  slug: string;
  rev: number | null;
  rezept: Rezept | null;
  fehler?: string[];
  notizen: string;
  medien: MedienInfo[];
}

export interface Store {
  readonly art: 'server' | 'geraet';
  liste(): Promise<RezeptInfo[]>;
  laden(id: string): Promise<RezeptVoll>;
  /** neueMedien: Dateiname → Inhalt (nur neue/geänderte Dateien) */
  speichern(rezept: Rezept, notizen: string, neueMedien: Record<string, Blob>, basisRev: number | null): Promise<{ id: string }>;
  loeschen(id: string, basisRev: number | null): Promise<void>;
  medienUrl(r: { id: string; slug: string }, name: string, breite?: number): string;
  /** Vorratsliste (nur aktive Artikel) */
  vorratLaden(): Promise<VorratArtikel[]>;
  /** Geänderte/neue/gelöschte Artikel speichern (Last-Write-Wins über „geaendert“) */
  vorratSpeichern(artikel: VorratArtikel[]): Promise<void>;
  /** Persönliche Liste (nur aktive Einträge) */
  sammlungLaden<N extends SammlungName>(name: N): Promise<SammlungTypen[N][]>;
  /** Geänderte/neue/gelöschte Einträge speichern (Last-Write-Wins über „geaendert“) */
  sammlungSpeichern<N extends SammlungName>(name: N, eintraege: SammlungTypen[N][]): Promise<void>;
}

export class ApiFehler extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function blobZuBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
