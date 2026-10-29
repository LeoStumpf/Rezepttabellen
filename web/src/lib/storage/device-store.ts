import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import {
  leseRezeptYaml,
  rezeptZuYaml,
  pruefeRezept,
  medienDesRezepts,
  slugify,
  neueId,
  type Rezept,
  type RezeptInfo,
  type MedienInfo,
  type AenderungenAntwort,
  type Aenderung,
  type SpeichernAnfrage,
  type SpeichernAntwort,
  type VorratArtikel,
  type VorratAenderungen,
  type SammlungAenderungen,
  type SammlungEintrag,
  type SammlungName,
  type SammlungTypen,
  SAMMLUNGEN,
} from '@mrt/shared';
import { ApiFehler, blobZuBase64, type RezeptVoll, type Store } from './types.ts';

/**
 * Offline-Speicher auf dem Handy. Gleiches Ordnerformat wie auf dem Server:
 *   <App-Speicher>/MyRecipetables/rezepte/<slug>/{rezept.yaml, notizen.md, Bilder}
 * plus index.json mit Sync-Zustand.
 */
const DIR = Directory.External;
const WURZEL = 'MyRecipetables';
const SYSTEMDATEIEN = new Set(['rezept.yaml', 'notizen.md']);

interface Eintrag {
  slug: string;
  /** Server-Revision, auf der der lokale Stand beruht (null = nie synchronisiert) */
  basisRev: number | null;
  geaendert: boolean;
  geloescht: boolean;
  /** Medien, wie sie auf dem Server liegen (Name → Hash) */
  serverMedien: Record<string, string>;
  /** Lokal neu hinzugefügte/ersetzte Medien, die noch hochgeladen werden müssen */
  neueMedien: string[];
  info: RezeptInfo;
}

interface Index {
  serverRev: number;
  eintraege: Record<string, Eintrag>;
  /** Stand der gespeicherten `info`; ist er älter als INFO_VERSION, werden die Infos aus den Dateien neu gebaut */
  infoVersion?: number;
}

/** Erhöhen, sobald RezeptInfo ein neues Feld bekommt (2: variante) */
const INFO_VERSION = 2;

interface VorratDatei {
  serverRev: number;
  artikel: Record<string, VorratArtikel>;
  /** lokal geänderte, noch nicht übertragene Artikel-IDs */
  offen: string[];
}

interface SammlungDatei {
  serverRev: number;
  eintraege: Record<string, SammlungEintrag>;
  /** lokal geänderte, noch nicht übertragene IDs */
  offen: string[];
}

const SAMMLUNG_NAMEN = Object.keys(SAMMLUNGEN) as SammlungName[];
const leereSammlung = (): SammlungDatei => ({ serverRev: 0, eintraege: {}, offen: [] });

export interface SyncErgebnis {
  vorrat: number;
  sammlungen: number;
  geladen: number;
  hochgeladen: number;
  konflikte: number;
  fehler: string[];
}

export class DeviceStore implements Store {
  readonly art = 'geraet' as const;
  private index: Index = { serverRev: 0, eintraege: {} };
  private basisUri = '';
  private bereit: Promise<void>;
  private vorrat: VorratDatei = { serverRev: 0, artikel: {}, offen: [] };
  private sammlungen = Object.fromEntries(SAMMLUNG_NAMEN.map((n) => [n, leereSammlung()])) as Record<SammlungName, SammlungDatei>;

  constructor() {
    this.bereit = this.init();
  }

  private async init() {
    await Filesystem.mkdir({ path: `${WURZEL}/rezepte`, directory: DIR, recursive: true }).catch(() => {});
    this.basisUri = (await Filesystem.getUri({ path: WURZEL, directory: DIR })).uri;
    try {
      const { data } = await Filesystem.readFile({ path: `${WURZEL}/index.json`, directory: DIR, encoding: Encoding.UTF8 });
      this.index = JSON.parse(String(data));
    } catch {
      this.index = { serverRev: 0, eintraege: {}, infoVersion: INFO_VERSION };
    }
    if ((this.index.infoVersion ?? 1) < INFO_VERSION) await this.infosNeuBauen();
    try {
      const { data } = await Filesystem.readFile({ path: `${WURZEL}/vorrat.json`, directory: DIR, encoding: Encoding.UTF8 });
      this.vorrat = JSON.parse(String(data));
    } catch {
      this.vorrat = { serverRev: 0, artikel: {}, offen: [] };
    }
    for (const n of SAMMLUNG_NAMEN) {
      try {
        const { data } = await Filesystem.readFile({ path: `${WURZEL}/${n}.json`, directory: DIR, encoding: Encoding.UTF8 });
        this.sammlungen[n] = JSON.parse(String(data));
      } catch {
        this.sammlungen[n] = leereSammlung();
      }
    }
  }

  private async sammlungDateiSpeichern(name: SammlungName) {
    await Filesystem.writeFile({
      path: `${WURZEL}/${name}.json`,
      directory: DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(this.sammlungen[name], null, 1),
    });
  }

  async sammlungLaden<N extends SammlungName>(name: N): Promise<SammlungTypen[N][]> {
    await this.bereit;
    return Object.values(this.sammlungen[name].eintraege).filter((e) => !e.geloescht) as SammlungTypen[N][];
  }

  async sammlungSpeichern<N extends SammlungName>(name: N, eintraege: SammlungTypen[N][]) {
    await this.bereit;
    const s = this.sammlungen[name];
    const offen = new Set(s.offen);
    for (const e of eintraege) {
      s.eintraege[e.id] = e;
      offen.add(e.id);
    }
    s.offen = [...offen];
    await this.sammlungDateiSpeichern(name);
  }

  /** Eine persönliche Liste abgleichen – wie der Vorrat. */
  private async sammlungSynchronisieren(name: SammlungName, holen: <T>(pfad: string, init?: RequestInit) => Promise<T>): Promise<number> {
    const s = this.sammlungen[name];
    let anzahl = 0;
    const { rev, eintraege } = await holen<SammlungAenderungen>(`/api/sammlung/${name}/aenderungen?seit=${s.serverRev}`);
    const offen = new Set(s.offen);
    for (const e of eintraege) {
      const lokal = s.eintraege[e.id];
      if (lokal && offen.has(e.id) && lokal.geaendert >= e.geaendert) continue;
      s.eintraege[e.id] = e;
      offen.delete(e.id);
      anzahl++;
    }
    const senden = [...offen].map((id) => s.eintraege[id]).filter(Boolean);
    if (senden.length) {
      await holen(`/api/sammlung/${name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eintraege: senden }) });
      anzahl += senden.length;
    }
    s.offen = [];
    s.serverRev = rev;
    await this.sammlungDateiSpeichern(name);
    return anzahl;
  }

  private async vorratDateiSpeichern() {
    await Filesystem.writeFile({
      path: `${WURZEL}/vorrat.json`,
      directory: DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(this.vorrat, null, 1),
    });
  }

  async vorratLaden(): Promise<VorratArtikel[]> {
    await this.bereit;
    return Object.values(this.vorrat.artikel).filter((a) => !a.geloescht);
  }

  async vorratSpeichern(artikel: VorratArtikel[]) {
    await this.bereit;
    const offen = new Set(this.vorrat.offen);
    for (const a of artikel) {
      this.vorrat.artikel[a.id] = a;
      offen.add(a.id);
    }
    this.vorrat.offen = [...offen];
    await this.vorratDateiSpeichern();
  }

  /** Vorrat abgleichen: Serveränderungen holen (neuere gewinnen), dann lokale senden. */
  private async vorratSynchronisieren(holen: <T>(pfad: string, init?: RequestInit) => Promise<T>): Promise<number> {
    let anzahl = 0;
    const { rev, artikel } = await holen<VorratAenderungen>(`/api/vorrat/aenderungen?seit=${this.vorrat.serverRev}`);
    const offen = new Set(this.vorrat.offen);
    for (const a of artikel) {
      const lokal = this.vorrat.artikel[a.id];
      if (lokal && offen.has(a.id) && lokal.geaendert >= a.geaendert) continue;
      this.vorrat.artikel[a.id] = a;
      offen.delete(a.id);
      anzahl++;
    }
    const senden = [...offen].map((id) => this.vorrat.artikel[id]).filter(Boolean);
    if (senden.length) {
      await holen('/api/vorrat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artikel: senden }) });
      anzahl += senden.length;
    }
    this.vorrat.offen = [];
    this.vorrat.serverRev = rev;
    await this.vorratDateiSpeichern();
    return anzahl;
  }

  /** Infos aller Rezepte aus den Dateien neu bauen (nach einem App-Update mit neuen Info-Feldern). */
  private async infosNeuBauen() {
    for (const [id, e] of Object.entries(this.index.eintraege)) {
      if (e.geloescht) continue;
      try {
        const res = leseRezeptYaml(await this.textLesen(this.pfad(e.slug, 'rezept.yaml')));
        e.info = { ...this.infoAus(id, e.slug, res.ok ? res.rezept : null, await this.dateien(e.slug), res.ok ? undefined : res.fehler), rev: e.info.rev };
      } catch {
        /* Datei fehlt: alte Info behalten */
      }
    }
    this.index.infoVersion = INFO_VERSION;
    await this.indexSpeichern();
  }

  private async indexSpeichern() {
    await Filesystem.writeFile({
      path: `${WURZEL}/index.json`,
      directory: DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(this.index, null, 1),
    });
  }

  get letzteServerRev() {
    return this.index.serverRev;
  }

  get ausstehend(): number {
    return Object.values(this.index.eintraege).filter((e) => e.geaendert).length + this.vorrat.offen.length + SAMMLUNG_NAMEN.reduce((n, s) => n + this.sammlungen[s].offen.length, 0);
  }

  // ---------- Dateihelfer ----------

  private pfad(slug: string, datei?: string) {
    return `${WURZEL}/rezepte/${slug}${datei ? `/${datei}` : ''}`;
  }

  private async textLesen(pfad: string): Promise<string> {
    try {
      const { data } = await Filesystem.readFile({ path: pfad, directory: DIR, encoding: Encoding.UTF8 });
      return String(data);
    } catch {
      return '';
    }
  }

  private async textSchreiben(pfad: string, text: string) {
    await Filesystem.writeFile({ path: pfad, directory: DIR, encoding: Encoding.UTF8, data: text, recursive: true });
  }

  private async base64Schreiben(pfad: string, b64: string) {
    await Filesystem.writeFile({ path: pfad, directory: DIR, data: b64, recursive: true });
  }

  private async base64Lesen(pfad: string): Promise<string> {
    const { data } = await Filesystem.readFile({ path: pfad, directory: DIR });
    return typeof data === 'string' ? data : await blobZuBase64(data);
  }

  private async dateien(slug: string): Promise<string[]> {
    try {
      const { files } = await Filesystem.readdir({ path: this.pfad(slug), directory: DIR });
      return files.filter((f) => f.type === 'file').map((f) => f.name);
    } catch {
      return [];
    }
  }

  private async ordnerLoeschen(slug: string) {
    await Filesystem.rmdir({ path: this.pfad(slug), directory: DIR, recursive: true }).catch(() => {});
  }

  private freierSlug(wunsch: string, ausser?: string): string {
    const belegt = new Set(Object.entries(this.index.eintraege).filter(([id, e]) => id !== ausser && !e.geloescht).map(([, e]) => e.slug));
    let slug = wunsch;
    for (let i = 2; belegt.has(slug); i++) slug = `${wunsch}-${i}`;
    return slug;
  }

  private infoAus(id: string, slug: string, rezept: Rezept | null, dateien: string[], fehler?: string[]): RezeptInfo {
    const bilder = (rezept?.bilder ?? []).filter((b) => dateien.includes(b));
    return {
      id,
      slug,
      rev: 0,
      titel: rezept?.titel ?? slug,
      untertitel: rezept?.untertitel,
      variante: rezept?.variante,
      tags: rezept?.tags ?? [],
      bild: bilder[0],
      bildFehlt: bilder.length === 0,
      fehler,
      gesamtMin: rezept?.zeit?.gesamt_min,
      erstellt: rezept?.erstellt,
    };
  }

  // ---------- Store ----------

  async liste(): Promise<RezeptInfo[]> {
    await this.bereit;
    return Object.values(this.index.eintraege)
      .filter((e) => !e.geloescht)
      .map((e) => e.info)
      .sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
  }

  async laden(id: string): Promise<RezeptVoll> {
    await this.bereit;
    const e = this.index.eintraege[id];
    if (!e || e.geloescht) throw new ApiFehler(404, 'Rezept nicht gefunden');
    const res = leseRezeptYaml(await this.textLesen(this.pfad(e.slug, 'rezept.yaml')));
    const dateien = (await this.dateien(e.slug)).filter((d) => !SYSTEMDATEIEN.has(d));
    const medien: MedienInfo[] = dateien.map((name) => ({ name, hash: e.serverMedien[name] ?? '', groesse: 0 }));
    return {
      id,
      slug: e.slug,
      rev: e.basisRev,
      rezept: res.ok ? res.rezept : null,
      fehler: res.ok ? undefined : res.fehler,
      notizen: await this.textLesen(this.pfad(e.slug, 'notizen.md')),
      medien,
    };
  }

  async speichern(rezept: Rezept, notizen: string, neueMedien: Record<string, Blob>, _basisRev: number | null) {
    await this.bereit;
    const pruef = pruefeRezept(rezept);
    if (!pruef.ok) throw new ApiFehler(400, 'Rezept ist ungültig', pruef.fehler);
    if (rezept.bilder.length === 0) throw new ApiFehler(400, 'Mindestens ein Bild erforderlich');
    const r = pruef.rezept;
    const alt = this.index.eintraege[r.id];
    const slug = alt && !alt.geloescht ? alt.slug : this.freierSlug(slugify(r.titel), r.id);

    for (const [name, blob] of Object.entries(neueMedien)) await this.base64Schreiben(this.pfad(slug, name), await blobZuBase64(blob));
    const vorhanden = await this.dateien(slug);
    const fehlend = medienDesRezepts(r).filter((n) => !vorhanden.includes(n));
    if (fehlend.length) throw new ApiFehler(400, `Datei fehlt: ${fehlend.join(', ')}`);
    // nicht mehr referenzierte Medien entfernen
    const benutzt = new Set(medienDesRezepts(r));
    for (const d of vorhanden) {
      if (!SYSTEMDATEIEN.has(d) && !benutzt.has(d)) await Filesystem.deleteFile({ path: this.pfad(slug, d), directory: DIR }).catch(() => {});
    }

    r.geaendert = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    // Der Editor kennt „erstellt“ nicht – der gespeicherte Wert bleibt
    if (alt && !alt.geloescht) r.erstellt = alt.info.erstellt ?? r.erstellt;
    r.erstellt ??= r.geaendert;
    await this.textSchreiben(this.pfad(slug, 'rezept.yaml'), rezeptZuYaml(r));
    if (notizen.trim()) await this.textSchreiben(this.pfad(slug, 'notizen.md'), notizen.endsWith('\n') ? notizen : notizen + '\n');
    else await Filesystem.deleteFile({ path: this.pfad(slug, 'notizen.md'), directory: DIR }).catch(() => {});

    const neu = new Set([...(alt?.neueMedien ?? []), ...Object.keys(neueMedien)]);
    this.index.eintraege[r.id] = {
      slug,
      basisRev: alt?.basisRev ?? null,
      geaendert: true,
      geloescht: false,
      serverMedien: alt?.serverMedien ?? {},
      neueMedien: [...neu].filter((n) => benutzt.has(n)),
      info: this.infoAus(r.id, slug, r, await this.dateien(slug)),
    };
    await this.indexSpeichern();
    return { id: r.id };
  }

  async loeschen(id: string) {
    await this.bereit;
    const e = this.index.eintraege[id];
    if (!e) return;
    await this.ordnerLoeschen(e.slug);
    if (e.basisRev == null) delete this.index.eintraege[id];
    else Object.assign(e, { geloescht: true, geaendert: true });
    await this.indexSpeichern();
  }

  medienUrl(r: { id: string; slug: string }, name: string) {
    const e = this.index.eintraege[r.id];
    return Capacitor.convertFileSrc(`${this.basisUri}/rezepte/${e?.slug ?? r.slug}/${name}`) + (e?.serverMedien[name] ? `?v=${e.serverMedien[name].slice(0, 8)}` : '');
  }

  // ---------- Sync ----------

  private laufenderSync: Promise<SyncErgebnis> | null = null;

  /** Ein Sync zur Zeit: Auto-Sync und Knopf teilen sich einen laufenden Durchgang. */
  synchronisieren(server: string, passwort: string): Promise<SyncErgebnis> {
    this.laufenderSync ??= this.syncDurchgang(server, passwort).finally(() => (this.laufenderSync = null));
    return this.laufenderSync;
  }

  private async syncDurchgang(server: string, passwort: string): Promise<SyncErgebnis> {
    await this.bereit;
    const erg: SyncErgebnis = { vorrat: 0, sammlungen: 0, geladen: 0, hochgeladen: 0, konflikte: 0, fehler: [] };
    const headers: Record<string, string> = passwort ? { 'X-App-Passwort': passwort } : {};
    const holen = async <T>(pfad: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(server + pfad, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
      const daten = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
      if (!res.ok) throw new ApiFehler(res.status, daten?.fehler ?? res.statusText, daten?.details);
      return daten as T;
    };

    // 1. Pull
    const { rev, aenderungen } = await holen<AenderungenAntwort>(`/api/sync/aenderungen?seit=${this.index.serverRev}`);
    for (const a of aenderungen) {
      try {
        if (await this.aenderungAnwenden(server, a)) erg.konflikte++;
        erg.geladen++;
      } catch (e) {
        erg.fehler.push(`${a.slug ?? a.id}: ${(e as Error).message}`);
      }
    }
    if (!erg.fehler.length) this.index.serverRev = rev;
    await this.indexSpeichern();

    // 2. Push
    for (const [id, e] of Object.entries(this.index.eintraege)) {
      if (!e.geaendert) continue;
      try {
        if (e.geloescht) {
          if (e.basisRev != null) await holen(`/api/rezepte/${encodeURIComponent(id)}?basisRev=${e.basisRev}`, { method: 'DELETE' }).catch((err) => {
            if ((err as ApiFehler).status !== 404) throw err;
          });
          delete this.index.eintraege[id];
        } else {
          const res = leseRezeptYaml(await this.textLesen(this.pfad(e.slug, 'rezept.yaml')));
          if (!res.ok) throw new Error(res.fehler.join('; '));
          const medien: Record<string, string> = {};
          for (const n of e.neueMedien) medien[n] = await this.base64Lesen(this.pfad(e.slug, n));
          const body: SpeichernAnfrage = { rezept: res.rezept, notizen: await this.textLesen(this.pfad(e.slug, 'notizen.md')), basisRev: e.basisRev, medien };
          const antwort = await holen<SpeichernAntwort>(`/api/rezepte/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          // Den resultierenden Serverstand (inkl. Hashes, evtl. neuer Slug) beim nächsten Pull übernehmen
          e.geaendert = false;
          e.neueMedien = [];
          e.basisRev = antwort.rev - 1;
        }
        erg.hochgeladen++;
      } catch (err) {
        erg.fehler.push(`${e.info.titel}: ${(err as Error).message}`);
      }
      await this.indexSpeichern();
    }

    // 3. Eigene Uploads zurückholen (Hashes, Slug, geänderte Zeitstempel)
    if (erg.hochgeladen) {
      const nach = await holen<AenderungenAntwort>(`/api/sync/aenderungen?seit=${this.index.serverRev}`);
      for (const a of nach.aenderungen) await this.aenderungAnwenden(server, a).catch((e) => erg.fehler.push((e as Error).message));
      if (!erg.fehler.length) this.index.serverRev = nach.rev;
      await this.indexSpeichern();
    }

    // 4. Vorrat
    try {
      erg.vorrat = await this.vorratSynchronisieren(holen);
    } catch (e) {
      erg.fehler.push(`Vorrat: ${(e as Error).message}`);
    }

    // 5. Persönliche Listen
    for (const n of SAMMLUNG_NAMEN) {
      try {
        erg.sammlungen += await this.sammlungSynchronisieren(n, holen);
      } catch (e) {
        erg.fehler.push(`${n}: ${(e as Error).message}`);
      }
    }
    return erg;
  }

  /** Wendet eine Serveränderung an. Gibt true zurück, wenn eine Konfliktkopie angelegt wurde. */
  private async aenderungAnwenden(server: string, a: Aenderung): Promise<boolean> {
    const lokal = this.index.eintraege[a.id];
    let konflikt = false;
    if (lokal && lokal.basisRev != null && a.rev <= lokal.basisRev && !a.geloescht && lokal.slug === a.slug && !lokal.geaendert) return false;

    if (lokal?.geaendert && (lokal.basisRev == null || a.rev > lokal.basisRev)) {
      // Beide Seiten geändert → lokale Version als Kopie sichern
      if (!lokal.geloescht) {
        await this.konfliktKopie(a.id);
        konflikt = true;
      }
    }

    if (a.geloescht) {
      if (lokal && !lokal.geloescht) await this.ordnerLoeschen(lokal.slug);
      delete this.index.eintraege[a.id];
      return konflikt;
    }

    const slug = a.slug!;
    const vorher = this.index.eintraege[a.id];
    if (vorher && vorher.slug !== slug && !vorher.geloescht) {
      await Filesystem.rename({ from: this.pfad(vorher.slug), to: this.pfad(slug), directory: DIR }).catch(() => {});
    }
    const serverMedien: Record<string, string> = { ...(vorher?.serverMedien ?? {}) };
    const lokaleDateien = await this.dateien(slug);
    for (const m of a.medien ?? []) {
      if (serverMedien[m.name] === m.hash && lokaleDateien.includes(m.name)) continue;
      const res = await fetch(`${server}/medien/${encodeURIComponent(a.id)}/${encodeURIComponent(m.name)}`);
      if (!res.ok) throw new Error(`Download ${m.name}: ${res.status}`);
      await this.base64Schreiben(this.pfad(slug, m.name), await blobZuBase64(await res.blob()));
      serverMedien[m.name] = m.hash;
    }
    const sollMedien = new Set((a.medien ?? []).map((m) => m.name));
    for (const d of lokaleDateien) {
      if (!SYSTEMDATEIEN.has(d) && !sollMedien.has(d)) await Filesystem.deleteFile({ path: this.pfad(slug, d), directory: DIR }).catch(() => {});
    }
    for (const n of Object.keys(serverMedien)) if (!sollMedien.has(n)) delete serverMedien[n];

    await this.textSchreiben(this.pfad(slug, 'rezept.yaml'), a.yaml ?? '');
    if (a.notizen) await this.textSchreiben(this.pfad(slug, 'notizen.md'), a.notizen);
    else await Filesystem.deleteFile({ path: this.pfad(slug, 'notizen.md'), directory: DIR }).catch(() => {});

    const res = leseRezeptYaml(a.yaml ?? '');
    this.index.eintraege[a.id] = {
      slug,
      basisRev: a.rev,
      geaendert: false,
      geloescht: false,
      serverMedien,
      neueMedien: [],
      info: this.infoAus(a.id, slug, res.ok ? res.rezept : null, await this.dateien(slug), res.ok ? undefined : res.fehler),
    };
    return konflikt;
  }

  private async konfliktKopie(id: string) {
    const e = this.index.eintraege[id];
    const res = leseRezeptYaml(await this.textLesen(this.pfad(e.slug, 'rezept.yaml')));
    if (!res.ok) return;
    const neu: Rezept = { ...res.rezept, id: neueId(), titel: `${res.rezept.titel} (Konflikt Handy)` };
    const slug = this.freierSlug(slugify(neu.titel));
    const medien = medienDesRezepts(neu);
    await Filesystem.mkdir({ path: this.pfad(slug), directory: DIR, recursive: true }).catch(() => {});
    for (const n of medien) {
      await Filesystem.copy({ from: this.pfad(e.slug, n), to: this.pfad(slug, n), directory: DIR, toDirectory: DIR }).catch(() => {});
    }
    await this.textSchreiben(this.pfad(slug, 'rezept.yaml'), rezeptZuYaml(neu));
    const notizen = await this.textLesen(this.pfad(e.slug, 'notizen.md'));
    if (notizen) await this.textSchreiben(this.pfad(slug, 'notizen.md'), notizen);
    this.index.eintraege[neu.id] = {
      slug,
      basisRev: null,
      geaendert: true,
      geloescht: false,
      serverMedien: {},
      neueMedien: medien,
      info: this.infoAus(neu.id, slug, neu, await this.dateien(slug)),
    };
  }
}
