import { z } from 'zod';

export const VORRAT_STATUS = ['da', 'knapp', 'leer'] as const;
export type VorratStatus = (typeof VORRAT_STATUS)[number];

export const KATEGORIEN = ['Gewürze', 'Öl & Essig', 'Vorratsschrank', 'Kühlschrank', 'Tiefkühl', 'Frisch', 'Getränke', 'Sonstiges'] as const;

export const VorratArtikelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kategorie: z.string().optional(),
  status: z.enum(VORRAT_STATUS),
  /** zusätzlich zugeordnete Zutatennamen (normalisiert) – per Antippen im Rezept gelernt */
  begriffe: z.array(z.string()).default([]),
  geaendert: z.string().min(1),
  geloescht: z.boolean().optional(),
});
export type VorratArtikel = z.infer<typeof VorratArtikelSchema>;

export interface VorratAenderungen {
  rev: number;
  artikel: VorratArtikel[];
}

/** Beschreibende Wörter, die für die Zuordnung keine Rolle spielen. */
const FUELLWOERTER = new Set(
  [
    'frisch', 'frische', 'frischer', 'frischen', 'gross', 'grosse', 'grosser', 'grossen', 'klein', 'kleine', 'kleiner', 'kleinen',
    'fein', 'feine', 'grob', 'grobe', 'grobes', 'bio', 'glatt', 'glatte', 'kraus', 'krause', 'etwas', 'optional', 'ca', 'nach',
    'wahl', 'zum', 'zur', 'servieren', 'und', 'oder', 'am', 'stueck', 'z', 'b', 'mittelgross', 'mittelgrosse', 'reif', 'reife',
    'gut', 'gute', 'guter', 'beliebig', 'beliebige', 'evtl', 'gemahlen', 'gemahlene', 'gemahlener', 'gemahlenes',
    'getrocknet', 'getrocknete', 'getrockneter', 'getrocknetes',
  ],
);

function falten(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function stamm(wort: string): string {
  if (wort.length <= 4) return wort;
  for (const endung of ['en', 'n', 'e', 's']) if (wort.endsWith(endung) && wort.length - endung.length >= 4) return wort.slice(0, -endung.length);
  return wort;
}

export function woerter(name: string): string[] {
  return falten(name.replace(/\([^)]*\)/g, ' '))
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FUELLWOERTER.has(w))
    .map(stamm);
}

/** Vergleichsschlüssel eines Zutaten- oder Artikelnamens („große Zwiebeln“ → „zwiebel“). */
export function normalisiere(name: string): string {
  return woerter(name).join(' ');
}

/** Lesbarer Artikelname aus einem Zutatennamen („große Zwiebeln (ca. 600 g)“ → „Zwiebeln“). */
export function vorschlagName(name: string): string {
  let basis = name.replace(/\([^)]*\)/g, ' ');
  // bei Alternativen („Basilikum oder Petersilie“, „Zimt, gemahlen“) nur den ersten Teil
  const erster = basis.split(/\s+(?:oder|bzw\.?)\s+|\s*[,/]\s*/)[0];
  if (erster.trim() && !erster.trim().endsWith('-')) basis = erster;
  const roh = basis.split(/\s+/).filter((w) => {
    const f = falten(w).replace(/[^a-z0-9]/g, '');
    return w && (f === 'oder' || f === 'und' || !FUELLWOERTER.has(f));
  });
  const text = roh.join(' ').trim() || name.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Findet den passenden Vorratsartikel zu einem Zutatennamen. */
export function findeArtikel(zutatName: string, vorrat: VorratArtikel[]): VorratArtikel | undefined {
  const schluessel = normalisiere(zutatName);
  if (!schluessel) return undefined;
  const aktiv = vorrat.filter((a) => !a.geloescht);
  const gelernt = aktiv.find((a) => a.begriffe.includes(schluessel));
  if (gelernt) return gelernt;
  const zw = new Set(schluessel.split(' '));
  let bester: VorratArtikel | undefined;
  let besteLaenge = 0;
  for (const a of aktiv) {
    const aw = woerter(a.name);
    if (!aw.length || !aw.every((w) => zw.has(w))) continue;
    const laenge = aw.join(' ').length + (aw.length === zw.size ? 1000 : 0); // exakter Treffer zuerst
    if (laenge > besteLaenge) {
      bester = a;
      besteLaenge = laenge;
    }
  }
  return bester;
}

export type EinkaufStatus = 'da' | 'knapp' | 'kaufen';

export function einkaufStatus(zutatName: string, vorrat: VorratArtikel[]): { status: EinkaufStatus; artikel?: VorratArtikel } {
  const artikel = findeArtikel(zutatName, vorrat);
  if (!artikel || artikel.status === 'leer') return { status: 'kaufen', artikel };
  return { status: artikel.status, artikel };
}

const KATEGORIE_REGELN: [string, RegExp][] = [
  ['Öl & Essig', /(oel|essig)\b/],
  ['Gewürze', /\b(salz|pfeffer|zimt|kreuzkuemmel|kumin|paprika|kurkuma|chiliflock|chilipulver|cayenne|oregano|piment|muskat|lorbeer|garam|curry ?pulver|currypulver|fenchelsam|koriandersam|senfsam|nelke|kardamom|sternanis|vanill|thymian getrocknet|getrocknet|gewuerz|masala|harissa|ras el)/],
  ['Kühlschrank', /\b(butter|sahne|kaese|parmesan|pecorino|joghurt|milch|ei|eier|feta|halloumi|mozzarella|paneer|chorizo|speck|bacon|pancetta|schinken|creme|frischkaes|mascarpon|quark|hackfleisch|haehnchen|schwein|rind|lachs|thunfisch frisch)/],
  ['Frisch', /\b(zwiebel|schalott|knoblauch|ingwer|petersili|basilikum|koriander|minze|dill|schnittlauch|kraeut|zitron|limett|tomat|gurk|paprikaschot|chilischot|salat|rucola|spinat|brokkoli|zucchin|aubergin|kartoffel|moehr|karott|fenchel|spargel|erbs|lauch|fruehlingszwiebel|pilz|champignon|apfel|beer|avocado|jalapeno)/],
  ['Vorratsschrank', /\b(nudel|linguin|rigaton|spaghett|pasta|reis|couscous|bulgur|lins|bohn|kichererbs|mehl|zucker|tomatenmark|dose|passiert|sojasauc|bruehe|honig|sirup|schokolad|kakao|keks|nuss|nuess|mandel|tortilla|wrap|chips|kokosmilch|backpulver|hefe|haferflock|brot|bloetterteig|blaetterteig|marmelad|senf|mayonnais|ketchup|kapern|olive)/],
  ['Getränke', /\b(wein|wodka|bier|rum|saft)\b/],
];

export function rateKategorie(name: string): string {
  // ungestemmte Wörter, damit die Muster („parmesan“, „tomat…“) greifen
  const n = falten(name.replace(/\([^)]*\)/g, ' ')).split(/[^a-z0-9]+/).filter(Boolean).join(' ');
  for (const [kat, re] of KATEGORIE_REGELN) if (re.test(n)) return kat;
  // zusammengesetzte Wörter: „Babyspinat“, „Gemüsebrühe“, „Kidneybohnen“ → hinterer Teil
  for (const wort of n.split(' ')) {
    for (let i = 1; i <= wort.length - 4; i++) {
      const teil = wort.slice(i);
      for (const [kat, re] of KATEGORIE_REGELN) if (re.test(teil)) return kat;
    }
  }
  return 'Sonstiges';
}
