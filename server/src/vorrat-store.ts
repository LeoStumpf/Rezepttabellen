import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { VorratArtikelSchema, type VorratArtikel, type VorratAenderungen } from '@mrt/shared';
import { StoreFehler } from './store.ts';

/**
 * Vorratsliste in einer eigenen Datenbank (data/vorrat.sqlite) – anders als
 * index.sqlite ist sie die einzige Quelle und darf nicht gelöscht werden.
 * Sync per Last-Write-Wins über den Zeitstempel „geaendert“.
 */
export class VorratStore {
  private db: Database.Database;
  private backupPfad: string;
  private letztesBackup = 0;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'vorrat.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS artikel (id TEXT PRIMARY KEY, json TEXT NOT NULL, geaendert TEXT NOT NULL, rev INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS artikel_rev ON artikel(rev);
    `);
    this.backupPfad = path.join(dataDir, 'vorrat-backup.json');
    this.backup(true);
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

  private alle(seit = 0): VorratArtikel[] {
    return (this.db.prepare(`SELECT json FROM artikel WHERE rev > ? ORDER BY rev`).all(seit) as { json: string }[]).map((z) => JSON.parse(z.json));
  }

  liste(): VorratArtikel[] {
    return this.alle().filter((a) => !a.geloescht).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  aenderungen(seit: number): VorratAenderungen {
    return { rev: this.rev, artikel: this.alle(seit) };
  }

  /** Übernimmt Artikel, sofern sie neuer sind als der gespeicherte Stand. */
  uebernehmen(eingang: unknown): { rev: number; uebernommen: number } {
    if (!Array.isArray(eingang)) throw new StoreFehler(400, 'artikel muss eine Liste sein');
    const geprueft = eingang.map((x) => {
      const r = VorratArtikelSchema.safeParse(x);
      if (!r.success) throw new StoreFehler(400, 'Ungültiger Vorratsartikel', r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      return r.data;
    });
    let uebernommen = 0;
    this.db.transaction(() => {
      for (const a of geprueft) {
        const alt = this.db.prepare(`SELECT geaendert FROM artikel WHERE id=?`).get(a.id) as { geaendert: string } | undefined;
        if (alt && alt.geaendert >= a.geaendert) continue;
        this.db
          .prepare(`INSERT INTO artikel(id,json,geaendert,rev) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json, geaendert=excluded.geaendert, rev=excluded.rev`)
          .run(a.id, JSON.stringify(a), a.geaendert, this.naechsteRev());
        uebernommen++;
      }
    })();
    if (uebernommen) this.backup();
    return { rev: this.rev, uebernommen };
  }

  /** Lesbare Sicherungskopie (höchstens alle 10 min). */
  private backup(sofort = false) {
    if (!sofort && Date.now() - this.letztesBackup < 10 * 60 * 1000) return;
    this.letztesBackup = Date.now();
    const tmp = `${this.backupPfad}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ gesichert: new Date().toISOString(), artikel: this.liste() }, null, 1));
    fs.renameSync(tmp, this.backupPfad);
  }

  schliessen() {
    this.backup(true);
    this.db.close();
  }
}
