import { woerter } from './vorrat.ts';

// ---------- Ernährungsform ----------

/** Von streng nach locker – „Vegetarisch“ schließt vegane Rezepte ein usw. */
export const ERNAEHRUNG = ['Vegan', 'Vegetarisch', 'Pescetarisch', 'Fleisch'] as const;
export type Ernaehrung = (typeof ERNAEHRUNG)[number];

const FLEISCH_TAGS = ['fleisch', 'haehnchen', 'huhn', 'gefluegel', 'pute', 'hackfleisch', 'schwein', 'rind', 'wurst', 'lamm', 'speck', 'wild'];
const FISCH_TAGS = ['pescetarisch', 'fisch', 'meeresfruechte', 'garnelen', 'lachs'];

function falte(text: string): string {
  return text.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/** Ernährungsform aus den Tags; Fleisch schlägt alles, dann Fisch, dann vegetarisch/vegan. */
export function ernaehrungVon(tags: string[]): Ernaehrung | undefined {
  const t = new Set(tags.map(falte));
  if (FLEISCH_TAGS.some((x) => t.has(x))) return 'Fleisch';
  if (FISCH_TAGS.some((x) => t.has(x))) return 'Pescetarisch';
  if (t.has('vegan')) return 'Vegan';
  if (t.has('vegetarisch')) return 'Vegetarisch';
  return undefined;
}

export function istErnaehrungsTag(tag: string): boolean {
  return (ERNAEHRUNG as readonly string[]).some((e) => falte(e) === falte(tag));
}

/** Passt ein Rezept zum gewählten Filter? Ohne Filter passt alles. */
export function passtErnaehrung(form: Ernaehrung | undefined, filter: Ernaehrung | '' | undefined): boolean {
  if (!filter) return true;
  if (!form) return false;
  if (filter === 'Fleisch') return form === 'Fleisch';
  return ERNAEHRUNG.indexOf(form) <= ERNAEHRUNG.indexOf(filter);
}

// ---------- Kühlschrank ----------

/** Gleichwertige Bezeichnungen (in Kleinschreibung, beliebig gebeugt). */
const SYNONYME: string[][] = [
  ['karotte', 'möhre', 'mohrrübe', 'rüebli'],
  ['paprika', 'paprikaschote'],
  ['frühlingszwiebel', 'lauchzwiebel'],
  ['hackfleisch', 'hack', 'gehacktes'],
  ['kartoffel', 'erdapfel'],
  ['aubergine', 'melanzani'],
  ['hähnchen', 'huhn', 'hühnchen'],
  ['chili', 'chilischote', 'peperoni'],
  ['sahne', 'schlagsahne', 'rahm'],
  ['ei', 'eier'],
  ['zucchini', 'zucchino'],
];

/** Wortteile hinter dem Begriff, die dasselbe Lebensmittel meinen („Paprikaschote“, „Hähnchenbrustfilet“). */
const GLEICHE_SACHE = new Set(['', 'schot', 'knoll', 'zeh', 'brust', 'brustfilet', 'filet', 'schenkel', 'keul', 'fleisch', 'stueck', 'wuerfel']);
/** Komposita, die etwas anderes sind als ihr Grundwort. */
const ANDERE_SACHE: Record<string, string[]> = { lauch: ['knoblauch'], erbs: ['kichererbs'], ei: ['reis'] };

const FLEXION = ['', 'en', 'n', 'e', 's', 'er', 'es'];

function restErlaubt(rest: string): boolean {
  for (const vorn of FLEXION) {
    if (!rest.startsWith(vorn)) continue;
    const r = rest.slice(vorn.length);
    for (const hinten of FLEXION) if (r.endsWith(hinten) && GLEICHE_SACHE.has(r.slice(0, r.length - hinten.length))) return true;
  }
  return false;
}

/** Ungestemmte, gefaltete Wörter einer Zutat. */
function zutatWoerter(name: string): string[] {
  return falte(name.replace(/\([^)]*\)/g, ' '))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Steckt das (gestemmte) Begriffswort im Zutatenwort – als ganzes Wort oder Teil eines passenden Kompositums? */
function wortPasst(zutatWort: string, b: string): boolean {
  if (ANDERE_SACHE[b]?.some((x) => zutatWort.startsWith(x))) return false;
  for (let i = zutatWort.indexOf(b); i >= 0; i = zutatWort.indexOf(b, i + 1)) {
    if (i > 0 && b.length < 4) continue; // kurze Begriffe nur am Wortanfang
    if (restErlaubt(zutatWort.slice(i + b.length))) return true;
  }
  return false;
}

function begriffPasst(zutatName: string, begriff: string): boolean {
  const zw = zutatWoerter(zutatName);
  if (!zw.length) return false;
  const gruppe = SYNONYME.find((g) => g.some((s) => woerter(s).join(' ') === woerter(begriff).join(' ')));
  const varianten = gruppe ?? [begriff];
  return varianten.some((v) => {
    const bw = woerter(v);
    return bw.length > 0 && bw.every((b) => zw.some((z) => wortPasst(z, b)));
  });
}

export interface KuehlschrankTreffer {
  begriff: string;
  zutaten: string[];
}

/** Welche Kühlschrank-Begriffe kommen in den Zutaten vor (nur Begriffe mit Treffer)? */
export function kuehlschrankTreffer(zutatNamen: string[], begriffe: string[]): KuehlschrankTreffer[] {
  return begriffe
    .map((begriff) => ({ begriff, zutaten: zutatNamen.filter((z) => begriffPasst(z, begriff)) }))
    .filter((t) => t.zutaten.length > 0);
}
