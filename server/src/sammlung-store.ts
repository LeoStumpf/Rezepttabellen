import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SAMMLUNGEN, istSammlung, type SammlungAenderungen, type SammlungEintrag, type SammlungName } from '@mrt/shared';
import { StoreFehler } from './store.ts';

/**
 * Persönliche Listen (Einkaufsliste, Favoriten, Kochverlauf) in data/persoenlich.sqlite.
 * Wie der Vorrat die einzige Quelle; Sync per Last-Write-Wins über „geaendert“.
 */
export class SammlungStore {
  private db: Database.Database;
  private backupPfad: string;
  private letztesBackup = 0;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'persoenlich.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS eintraege (sammlung TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, geaendert TEXT NOT NULL, rev INTEGER NOT NULL, PRIMARY KEY (sammlung, id));
      CREATE INDEX IF NOT EXISTS eintraege_rev ON eintraege(sammlung, rev);
    `);
    this.backupPfad = path.join(dataDir, 'persoenlich-backup.json');
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

  private name(sammlung: string): SammlungName {
    if (!istSammlung(sammlung)) throw new StoreFehler(404, `Unbekannte Liste „${sammlung}“`);
    return sammlung;
  }

  private alle(sammlung: SammlungName, seit = 0): SammlungEintrag[] {
    return (this.db.prepare(`SELECT json FROM eintraege WHERE sammlung=? AND rev > ? ORDER BY rev`).all(sammlung, seit) as { json: string }[]).map((z) =>
      JSON.parse(z.json),
    );
  }

  liste(sammlung: string): SammlungEintrag[] {
    return this.alle(this.name(sammlung)).filter((e) => !e.geloescht);
  }

  aenderungen(sammlung: string, seit: number): SammlungAenderungen {
    return { rev: this.rev, eintraege: this.alle(this.name(sammlung), seit) };
  }

  /** Übernimmt Einträge, sofern sie neuer sind als der gespeicherte Stand. */
  uebernehmen(sammlung: string, eingang: unknown): { rev: number; uebernommen: number } {
    const name = this.name(sammlung);
    if (!Array.isArray(eingang)) throw new StoreFehler(400, 'eintraege muss eine Liste sein');
    const schema = SAMMLUNGEN[name];
    const geprueft = eingang.map((x) => {
      const r = schema.safeParse(x);
      if (!r.success) throw new StoreFehler(400, 'Ungültiger Eintrag', r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      return r.data;
    });
    let uebernommen = 0;
    this.db.transaction(() => {
      for (const e of geprueft) {
        const alt = this.db.prepare(`SELECT geaendert FROM eintraege WHERE sammlung=? AND id=?`).get(name, e.id) as { geaendert: string } | undefined;
        if (alt && alt.geaendert >= e.geaendert) continue;
        this.db
          .prepare(
            `INSERT INTO eintraege(sammlung,id,json,geaendert,rev) VALUES(?,?,?,?,?) ON CONFLICT(sammlung,id) DO UPDATE SET json=excluded.json, geaendert=excluded.geaendert, rev=excluded.rev`,
          )
          .run(name, e.id, JSON.stringify(e), e.geaendert, this.naechsteRev());
        uebernommen++;
      }
    })();
    if (uebernommen) this.backup();
    return { rev: this.rev, uebernommen };
  }

  /** Alle aktiven Einträge je Liste (für Backup und Export). */
  alles(): Record<SammlungName, SammlungEintrag[]> {
    return Object.fromEntries(Object.keys(SAMMLUNGEN).map((n) => [n, this.liste(n)])) as Record<SammlungName, SammlungEintrag[]>;
  }

  /** Lesbare Sicherungskopie (höchstens alle 10 min). */
  private backup(sofort = false) {
    if (!sofort && Date.now() - this.letztesBackup < 10 * 60 * 1000) return;
    this.letztesBackup = Date.now();
    const tmp = `${this.backupPfad}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ gesichert: new Date().toISOString(), ...this.alles() }, null, 1));
    fs.renameSync(tmp, this.backupPfad);
  }

  schliessen() {
    this.backup(true);
    this.db.close();
  }
}
