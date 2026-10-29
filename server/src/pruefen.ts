/** Prüft alle (oder die angegebenen) Rezeptordner: npx tsx server/src/pruefen.ts [ordner …] */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leseRezeptYaml, berechneLayout, ernaehrungVon } from '@mrt/shared';

const standard = fs.existsSync(path.join(os.homedir(), 'Rezepte')) ? path.join(os.homedir(), 'Rezepte') : 'data';
const basis = path.resolve(process.env.DATA_DIR ?? standard, 'rezepte');
const ordner = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(basis).filter((d) => !d.startsWith('.'));
let fehler = 0;
for (const o of ordner) {
  const dir = path.isAbsolute(o) ? o : path.join(basis, path.basename(o));
  const res = leseRezeptYaml(fs.readFileSync(path.join(dir, 'rezept.yaml'), 'utf8'));
  if (!res.ok) {
    fehler++;
    console.log(`✗ ${path.basename(dir)}\n   ${res.fehler.join('\n   ')}`);
    continue;
  }
  const r = res.rezept;
  const fehlend = r.bilder.filter((b) => !fs.existsSync(path.join(dir, b)));
  const unbenutzt = r.zutaten.filter((z) => !r.schritte.some((s) => s.nimmt.includes(z.id))).map((z) => z.id);
  const l = berechneLayout(r);
  const warn = [
    ...(r.bilder.length === 0 ? ['kein Bild'] : []),
    ...(fehlend.length ? [`Bild fehlt: ${fehlend.join(', ')}`] : []),
    ...(unbenutzt.length ? [`unbenutzte Zutaten: ${unbenutzt.join(', ')}`] : []),
    ...(ernaehrungVon(r.tags) ? [] : ['kein Ernährungs-Tag (Vegan, Vegetarisch, Pescetarisch oder Fleisch)']),
  ];
  if (fehlend.length || r.bilder.length === 0) fehler++;
  console.log(`${warn.length ? '⚠' : '✓'} ${path.basename(dir)} – ${r.zutaten.length} Zutaten, ${r.schritte.length} Schritte, ${l.schrittSpalten} Spalten${warn.length ? '\n   ' + warn.join('\n   ') : ''}`);
}
process.exit(fehler ? 1 : 0);
