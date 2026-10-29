import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { parse as parseYaml } from 'yaml';
import {
  leseRezeptYaml,
  pruefeRezept,
  rezeptZuYaml,
  medienDesRezepts,
  istGueltigerMedienname,
  slugify,
  type Rezept,
  type RezeptInfo,
  type MedienInfo,
  type Aenderung,
  type SpeichernAnfrage,
  type SpeichernAntwort,
} from '@mrt/shared';

export class StoreFehler extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

const SYSTEMDATEIEN = new Set(['rezept.yaml', 'notizen.md']);

interface Zeile {
  id: string;
  slug: string | null;
  rev: number;
  hash: string;
  geloescht: number;
  info: string;
  medien: string;
}

export interface RezeptDetail {
  id: string;
  slug: string;
  rev: number;
  yaml: string;
  rezept: Rezept | null;
  fehler?: string[];
  notizen: string;
  medien: MedienInfo[];
}

/**
 * Die Dateien in data/rezepte/<slug>/ sind die Wahrheit.
 * SQLite hält nur Index, Revisionen (für den Sync) und Tombstones und lässt
 * sich jederzeit aus den Dateien neu aufbauen (index.sqlite löschen genügt).
 */
export class RezeptStore {
  readonly rezepteDir: string;
  readonly papierkorbDir: string;
  private db: Database.Database;

  constructor(readonly dataDir: string) {
    this.rezepteDir = path.join(dataDir, 'rezepte');
    this.papierkorbDir = path.join(dataDir, 'papierkorb');
    fs.mkdirSync(this.rezepteDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'index.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rezepte (
        id TEXT PRIMARY KEY, slug TEXT, rev INTEGER NOT NULL, hash TEXT NOT NULL,
        geloescht INTEGER NOT NULL DEFAULT 0, info TEXT NOT NULL DEFAULT '{}', medien TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS rezepte_rev ON rezepte(rev);
      CREATE TABLE IF NOT EXISTS medien_cache (pfad TEXT PRIMARY KEY, groesse INTEGER, mtime REAL, hash TEXT);
    `);
  }

  get rev(): number {
    const z = this.db.prepare(`SELECT v FROM meta WHERE k='rev'`).get() as { v: string } | undefined;
    return z ? Number(z.v) : 0;
  }

  private naechsteRev(): number {
    const rev = this.rev + 1;
    this.db.prepare(`INSERT INTO meta(k,v) VALUES('rev',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).run(String(rev));
    return rev;
  }

  // ---------- Abgleich Dateien → Index ----------

  /** Alle Ordner einlesen; geänderte bekommen eine neue Revision. */
  abgleichen(): void {
    const ordner = fs
      .readdirSync(this.rezepteDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && fs.existsSync(path.join(this.rezepteDir, d.name, 'rezept.yaml')))
      .map((d) => d.name);
    const gesehen = new Set<string>();
    this.db.transaction(() => {
      for (const slug of ordner) {
        const id = this.ordnerAbgleichen(slug, gesehen);
        if (id) gesehen.add(id);
      }
      const aktiv = this.db.prepare(`SELECT id, slug FROM rezepte WHERE geloescht=0`).all() as { id: string; slug: string }[];
      for (const z of aktiv) {
        if (!gesehen.has(z.id)) {
          this.db.prepare(`UPDATE rezepte SET geloescht=1, slug=NULL, rev=? WHERE id=?`).run(this.naechsteRev(), z.id);
        }
      }
    })();
  }

  private ordnerAbgleichen(slug: string, bereitsVergeben: Set<string>): string | null {
    const dir = path.join(this.rezepteDir, slug);
    const yamlPfad = path.join(dir, 'rezept.yaml');
    let yaml = fs.readFileSync(yamlPfad, 'utf8');
    const notizenPfad = path.join(dir, 'notizen.md');
    const notizen = fs.existsSync(notizenPfad) ? fs.readFileSync(notizenPfad, 'utf8') : '';

    // ID ermitteln; fehlt sie (von Hand angelegt) oder ist sie doppelt (Ordner kopiert), neue vergeben
    let roh: Record<string, unknown> | null = null;
    try {
      const p = parseYaml(yaml);
      if (p && typeof p === 'object') roh = p as Record<string, unknown>;
    } catch {
      /* Fehler wird unten über leseRezeptYaml gemeldet */
    }
    let id = typeof roh?.id === 'string' && roh.id ? roh.id : null;
    if (id && bereitsVergeben.has(id)) id = null;
    if (!id) {
      if (!roh) id = `ordner-${slug}`;
      else {
        id = crypto.randomUUID();
        yaml = yaml.replace(/^id:.*\n?/m, '');
        yaml = `id: ${id}\n${yaml}`;
        schreibeAtomar(yamlPfad, yaml);
      }
    }

    const medien = this.medienLesen(dir);
    const hash = sha256(yaml + '\0' + notizen + '\0' + medien.map((m) => `${m.name}:${m.hash}`).join('\n'));
    const res = leseRezeptYaml(yaml);
    const info = this.infoErstellen(id, slug, res.ok ? res.rezept : roh, res.ok ? undefined : res.fehler, medien);

    const alt = this.db.prepare(`SELECT * FROM rezepte WHERE id=?`).get(id) as Zeile | undefined;
    if (alt && alt.hash === hash && alt.slug === slug && !alt.geloescht) return id;
    const rev = this.naechsteRev();
    info.rev = rev;
    this.db
      .prepare(
        `INSERT INTO rezepte(id, slug, rev, hash, geloescht, info, medien) VALUES(?,?,?,?,0,?,?)
         ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, rev=excluded.rev, hash=excluded.hash, geloescht=0, info=excluded.info, medien=excluded.medien`,
      )
      .run(id, slug, rev, hash, JSON.stringify(info), JSON.stringify(medien));
    return id;
  }

  private infoErstellen(id: string, slug: string, r: Partial<Rezept> | Record<string, unknown> | null, fehler: string[] | undefined, medien: MedienInfo[]): RezeptInfo {
    const rr = (r ?? {}) as Partial<Rezept>;
    const bilder = Array.isArray(rr.bilder) ? rr.bilder : [];
    const vorhanden = bilder.filter((b) => medien.some((m) => m.name === b));
    return {
      id,
      slug,
      rev: 0,
      titel: typeof rr.titel === 'string' ? rr.titel : slug,
      untertitel: typeof rr.untertitel === 'string' ? rr.untertitel : undefined,
      variante: typeof rr.variante?.gruppe === 'string' && typeof rr.variante.name === 'string' ? rr.variante : undefined,
      tags: Array.isArray(rr.tags) ? rr.tags.map(String) : [],
      bild: vorhanden[0],
      bildFehlt: vorhanden.length === 0,
      fehler,
      gesamtMin: rr.zeit?.gesamt_min,
      erstellt: typeof rr.erstellt === 'string' ? rr.erstellt : undefined,
    };
  }

  private medienLesen(dir: string): MedienInfo[] {
    const liste: MedienInfo[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
      if (SYSTEMDATEIEN.has(name) || name.startsWith('.') || name.endsWith('.tmp')) continue;
      const pfad = path.join(dir, name);
      const st = fs.statSync(pfad);
      if (!st.isFile()) continue;
      const cache = this.db.prepare(`SELECT * FROM medien_cache WHERE pfad=?`).get(pfad) as
        | { groesse: number; mtime: number; hash: string }
        | undefined;
      let hash: string;
      if (cache && cache.groesse === st.size && cache.mtime === st.mtimeMs) hash = cache.hash;
      else {
        hash = sha256(fs.readFileSync(pfad));
        this.db
          .prepare(`INSERT INTO medien_cache(pfad,groesse,mtime,hash) VALUES(?,?,?,?) ON CONFLICT(pfad) DO UPDATE SET groesse=excluded.groesse, mtime=excluded.mtime, hash=excluded.hash`)
          .run(pfad, st.size, st.mtimeMs, hash);
      }
      liste.push({ name, hash, groesse: st.size });
    }
    return liste;
  }

  // ---------- Lesen ----------

  liste(): RezeptInfo[] {
    const zeilen = this.db.prepare(`SELECT info FROM rezepte WHERE geloescht=0`).all() as { info: string }[];
    return zeilen.map((z) => JSON.parse(z.info) as RezeptInfo).sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
  }

  private zeile(id: string): Zeile | undefined {
    return this.db.prepare(`SELECT * FROM rezepte WHERE id=?`).get(id) as Zeile | undefined;
  }

  detail(id: string): RezeptDetail {
    const z = this.zeile(id);
    if (!z || z.geloescht || !z.slug) throw new StoreFehler(404, 'Rezept nicht gefunden');
    const dir = path.join(this.rezepteDir, z.slug);
    const yaml = fs.readFileSync(path.join(dir, 'rezept.yaml'), 'utf8');
    const notizenPfad = path.join(dir, 'notizen.md');
    const res = leseRezeptYaml(yaml);
    return {
      id,
      slug: z.slug,
      rev: z.rev,
      yaml,
      rezept: res.ok ? res.rezept : null,
      fehler: res.ok ? undefined : res.fehler,
      notizen: fs.existsSync(notizenPfad) ? fs.readFileSync(notizenPfad, 'utf8') : '',
      medien: JSON.parse(z.medien),
    };
  }

  medienPfad(id: string, name: string): { pfad: string; hash: string } {
    const z = this.zeile(id);
    if (!z || z.geloescht || !z.slug || !istGueltigerMedienname(name)) throw new StoreFehler(404, 'Datei nicht gefunden');
    const m = (JSON.parse(z.medien) as MedienInfo[]).find((x) => x.name === name);
    if (!m) throw new StoreFehler(404, 'Datei nicht gefunden');
    return { pfad: path.join(this.rezepteDir, z.slug, name), hash: m.hash };
  }

  aenderungen(seit: number): { rev: number; aenderungen: Aenderung[] } {
    const zeilen = this.db.prepare(`SELECT * FROM rezepte WHERE rev > ? ORDER BY rev`).all(seit) as Zeile[];
    const aenderungen: Aenderung[] = zeilen.map((z) => {
      if (z.geloescht || !z.slug) return { id: z.id, rev: z.rev, geloescht: true };
      const d = this.detail(z.id);
      return { id: z.id, rev: z.rev, geloescht: false, slug: z.slug, yaml: d.yaml, notizen: d.notizen, medien: d.medien };
    });
    return { rev: this.rev, aenderungen };
  }

  // ---------- Schreiben ----------

  speichern(id: string, anfrage: SpeichernAnfrage): SpeichernAntwort {
    const pruef = pruefeRezept(anfrage.rezept);
    if (!pruef.ok) throw new StoreFehler(400, 'Rezept ist ungültig', pruef.fehler);
    const rezept = pruef.rezept;
    if (rezept.id !== id) throw new StoreFehler(400, 'ID im Rezept passt nicht zur URL');
    if (rezept.bilder.length === 0) throw new StoreFehler(400, 'Mindestens ein Bild erforderlich');

    const alt = this.zeile(id);
    const existiert = alt && !alt.geloescht && alt.slug;
    if (existiert && (anfrage.basisRev == null || alt.rev > anfrage.basisRev)) {
      throw new StoreFehler(409, 'Konflikt: Das Rezept wurde inzwischen geändert', { rev: alt.rev });
    }

    const neueMedien = anfrage.medien ?? {};
    for (const name of Object.keys(neueMedien)) {
      if (!istGueltigerMedienname(name)) throw new StoreFehler(400, `Ungültiger Dateiname: ${name}`);
    }
    const altDir = existiert ? path.join(this.rezepteDir, alt.slug!) : null;
    const fehlend = medienDesRezepts(rezept).filter(
      (n) => !(n in neueMedien) && !(altDir && fs.existsSync(path.join(altDir, n))),
    );
    if (fehlend.length) throw new StoreFehler(400, `Datei fehlt: ${fehlend.join(', ')}`);

    // Ordnername folgt dem Titel; bei Titeländerung wird umbenannt
    const wunsch = slugify(rezept.titel);
    let slug: string;
    if (!existiert) slug = this.freierSlug(wunsch);
    else if (wunsch === alt.slug || wunsch === alt.slug!.replace(/-\d+$/, '')) slug = alt.slug!;
    else {
      slug = this.freierSlug(wunsch);
      fs.renameSync(altDir!, path.join(this.rezepteDir, slug));
    }
    const dir = path.join(this.rezepteDir, slug);
    fs.mkdirSync(dir, { recursive: true });

    // Bisher referenzierte, jetzt nicht mehr verwendete Medien entfernen
    let altErstellt: string | undefined;
    if (existiert) {
      try {
        const altRes = leseRezeptYaml(fs.readFileSync(path.join(dir, 'rezept.yaml'), 'utf8'));
        if (altRes.ok) {
          altErstellt = altRes.rezept.erstellt;
          const neu = new Set(medienDesRezepts(rezept));
          for (const n of medienDesRezepts(altRes.rezept)) {
            if (!neu.has(n) && istGueltigerMedienname(n)) fs.rmSync(path.join(dir, n), { force: true });
          }
        }
      } catch {
        /* alte Datei unlesbar – nichts aufräumen */
      }
    }

    for (const [name, b64] of Object.entries(neueMedien)) schreibeAtomar(path.join(dir, name), Buffer.from(b64, 'base64'));
    rezept.geaendert = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    // Der Editor kennt „erstellt“ nicht – der gespeicherte Wert bleibt
    rezept.erstellt = altErstellt ?? rezept.erstellt ?? rezept.geaendert;
    schreibeAtomar(path.join(dir, 'rezept.yaml'), rezeptZuYaml(rezept));
    const notizenPfad = path.join(dir, 'notizen.md');
    if (anfrage.notizen.trim()) schreibeAtomar(notizenPfad, anfrage.notizen.endsWith('\n') ? anfrage.notizen : anfrage.notizen + '\n');
    else fs.rmSync(notizenPfad, { force: true });

    this.db.transaction(() => this.ordnerAbgleichen(slug, new Set()))();
    return { id, rev: this.zeile(id)!.rev, slug };
  }

  loeschen(id: string, basisRev: number | null): { rev: number } {
    const z = this.zeile(id);
    if (!z || z.geloescht || !z.slug) throw new StoreFehler(404, 'Rezept nicht gefunden');
    if (basisRev != null && z.rev > basisRev) throw new StoreFehler(409, 'Konflikt: Das Rezept wurde inzwischen geändert', { rev: z.rev });
    // Nicht endgültig löschen – in den Papierkorb verschieben
    fs.mkdirSync(this.papierkorbDir, { recursive: true });
    const stempel = new Date().toISOString().replace(/[:.]/g, '-');
    fs.renameSync(path.join(this.rezepteDir, z.slug), path.join(this.papierkorbDir, `${z.slug}_${stempel}`));
    const rev = this.naechsteRev();
    this.db.prepare(`UPDATE rezepte SET geloescht=1, slug=NULL, rev=? WHERE id=?`).run(rev, id);
    return { rev };
  }

  private freierSlug(wunsch: string): string {
    let slug = wunsch;
    for (let i = 2; fs.existsSync(path.join(this.rezepteDir, slug)); i++) slug = `${wunsch}-${i}`;
    return slug;
  }

  schliessen() {
    this.db.close();
  }
}

export function sha256(daten: string | Buffer): string {
  return crypto.createHash('sha256').update(daten).digest('hex');
}

function schreibeAtomar(pfad: string, inhalt: string | Buffer) {
  const tmp = `${pfad}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, inhalt);
  fs.renameSync(tmp, pfad);
}
