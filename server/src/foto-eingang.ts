import fs from 'node:fs';
import path from 'node:path';
import { istGueltigerMedienname, type FotoAuftrag, type FotoAuftragAnfrage } from '@mrt/shared';
import { StoreFehler } from './store.ts';

/**
 * Foto-Eingang: abfotografierte Rezepte, die noch von Hand (oder von Claude)
 * in Rezepte übertragen werden.
 *   <DATA_DIR>/foto-eingang/<YYYY-MM-DD_HHMM>-<id8>/{auftrag.json, bild-1.jpg, …}
 *   <DATA_DIR>/foto-eingang/erledigt/…   (ausgewertet)
 */
const ID = /^[A-Za-z0-9-]{8,64}$/;
const ORDNER = /^\d{4}-\d{2}-\d{2}_\d{4}-[A-Za-z0-9-]{8}$/;
const BILD = /\.(jpe?g|png|webp|heic|avif)$/i;

export class FotoEingang {
  readonly dir: string;
  readonly erledigtDir: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'foto-eingang');
    this.erledigtDir = path.join(this.dir, 'erledigt');
    fs.mkdirSync(this.erledigtDir, { recursive: true });
  }

  liste(): FotoAuftrag[] {
    const liste: FotoAuftrag[] = [];
    for (const ordner of fs.readdirSync(this.dir)) {
      if (!ORDNER.test(ordner)) continue;
      try {
        const a = JSON.parse(fs.readFileSync(path.join(this.dir, ordner, 'auftrag.json'), 'utf8'));
        liste.push({ ...a, ordner });
      } catch {
        /* halb geschrieben oder von Hand verändert – überspringen */
      }
    }
    return liste.sort((a, b) => b.erstellt.localeCompare(a.erstellt));
  }

  /** Legt den Auftrag an; ist die id schon bekannt (auch erledigt), passiert nichts. */
  anlegen(a: FotoAuftragAnfrage): { ordner: string; neu: boolean } {
    if (!a || typeof a.id !== 'string' || !ID.test(a.id)) throw new StoreFehler(400, 'Ungültige Auftrags-id');
    const namen = Object.keys(a.bilder ?? {});
    if (!namen.length) throw new StoreFehler(400, 'Keine Bilder im Auftrag');
    for (const n of namen) if (!istGueltigerMedienname(n) || !BILD.test(n)) throw new StoreFehler(400, `Ungültiger Dateiname: ${n}`);

    const kurz = a.id.replace(/-/g, '').slice(0, 8);
    for (const d of [this.dir, this.erledigtDir]) {
      const vorhanden = fs.readdirSync(d).find((o) => ORDNER.test(o) && o.endsWith(`-${kurz}`));
      if (vorhanden) return { ordner: vorhanden, neu: false };
    }

    const zeit = Number.isNaN(Date.parse(a.erstellt)) ? new Date() : new Date(a.erstellt);
    const p = (n: number) => String(n).padStart(2, '0');
    const ordner = `${zeit.getFullYear()}-${p(zeit.getMonth() + 1)}-${p(zeit.getDate())}_${p(zeit.getHours())}${p(zeit.getMinutes())}-${kurz}`;
    const tmp = path.join(this.dir, `.tmp-${kurz}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp);
    for (const n of namen) fs.writeFileSync(path.join(tmp, n), Buffer.from(a.bilder[n], 'base64'));
    const info = {
      id: a.id,
      erstellt: zeit.toISOString(),
      notiz: String(a.notiz ?? '').slice(0, 5000),
      geraet: a.geraet ? String(a.geraet).slice(0, 100) : undefined,
      bilder: namen,
    };
    fs.writeFileSync(path.join(tmp, 'auftrag.json'), JSON.stringify(info, null, 2) + '\n');
    fs.renameSync(tmp, path.join(this.dir, ordner));
    return { ordner, neu: true };
  }

  bildPfad(ordner: string, name: string): string {
    if (!ORDNER.test(ordner) || !istGueltigerMedienname(name) || !BILD.test(name)) throw new StoreFehler(404, 'Datei nicht gefunden');
    const pfad = path.join(this.dir, ordner, name);
    if (!fs.existsSync(pfad)) throw new StoreFehler(404, 'Datei nicht gefunden');
    return pfad;
  }

  erledigt(ordner: string) {
    if (!ORDNER.test(ordner) || !fs.existsSync(path.join(this.dir, ordner))) throw new StoreFehler(404, 'Auftrag nicht gefunden');
    fs.renameSync(path.join(this.dir, ordner), path.join(this.erledigtDir, ordner));
  }
}
