import type { Rezept, RezeptInfo, SammlungName, SammlungTypen, SpeichernAnfrage, SpeichernAntwort, VorratArtikel } from '@mrt/shared';
import { ApiFehler, blobZuBase64, type RezeptVoll, type Store } from './types.ts';
import { einstellungen } from '../einstellungen.ts';

/** Direkter Zugriff auf den Server (Web-Version im LAN). */
export class HttpStore implements Store {
  readonly art = 'server' as const;
  constructor(private basis = '') {}

  private async anfrage<T>(pfad: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    const pw = einstellungen.passwort;
    if (pw) headers['X-App-Passwort'] = pw;
    const res = await fetch(this.basis + pfad, { ...init, headers });
    const daten = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    if (!res.ok) throw new ApiFehler(res.status, daten?.fehler ?? res.statusText, daten?.details);
    return daten as T;
  }

  liste() {
    return this.anfrage<RezeptInfo[]>('/api/rezepte');
  }

  laden(id: string) {
    return this.anfrage<RezeptVoll>(`/api/rezepte/${encodeURIComponent(id)}`);
  }

  async speichern(rezept: Rezept, notizen: string, neueMedien: Record<string, Blob>, basisRev: number | null) {
    const medien: Record<string, string> = {};
    for (const [name, blob] of Object.entries(neueMedien)) medien[name] = await blobZuBase64(blob);
    const body: SpeichernAnfrage = { rezept, notizen, basisRev, medien };
    const res = await this.anfrage<SpeichernAntwort>(`/api/rezepte/${encodeURIComponent(rezept.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { id: res.id };
  }

  async loeschen(id: string, basisRev: number | null) {
    await this.anfrage(`/api/rezepte/${encodeURIComponent(id)}${basisRev != null ? `?basisRev=${basisRev}` : ''}`, { method: 'DELETE' });
  }

  medienUrl(r: { id: string }, name: string, breite?: number) {
    return `${this.basis}/medien/${encodeURIComponent(r.id)}/${encodeURIComponent(name)}${breite ? `?w=${breite}` : ''}`;
  }

  vorratLaden() {
    return this.anfrage<VorratArtikel[]>('/api/vorrat');
  }

  async vorratSpeichern(artikel: VorratArtikel[]) {
    await this.anfrage('/api/vorrat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artikel }) });
  }

  sammlungLaden<N extends SammlungName>(name: N) {
    return this.anfrage<SammlungTypen[N][]>(`/api/sammlung/${name}`);
  }

  async sammlungSpeichern<N extends SammlungName>(name: N, eintraege: SammlungTypen[N][]) {
    await this.anfrage(`/api/sammlung/${name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eintraege }) });
  }
}
