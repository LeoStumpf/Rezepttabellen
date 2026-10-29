import type { Einheit } from './units.ts';

/** Zutatenzeile einer Webseite („250 g Mehl (Type 550)“) → Menge, Einheit, Name, Hinweis. */
export interface ZutatTeile {
  menge?: number | null;
  einheit?: Einheit;
  name: string;
  hinweis?: string;
}

const BRUCH: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/** Schreibweisen → Einheit; längere zuerst prüfen. */
const EINHEIT_ALIAS: [RegExp, Einheit][] = [
  [/^(?:kilogramm|kilo|kg)$/i, 'kg'],
  [/^(?:tbsp|tablespoons?)$/i, 'EL'],
  [/^(?:tsp|teaspoons?)$/i, 'TL'],
  [/^(?:cloves?)$/i, 'Zehe'],
  [/^(?:cans?|tins?)$/i, 'Dose'],
  [/^(?:pinch(?:es)?)$/i, 'Prise'],
  [/^(?:bunch(?:es)?)$/i, 'Bund'],
  [/^(?:slices?)$/i, 'Scheibe'],
  [/^(?:packs?|packets?)$/i, 'Packung'],
  [/^(?:gramm|gr|g)$/i, 'g'],
  [/^(?:milliliter|ml)$/i, 'ml'],
  [/^(?:liter|l|ltr)$/i, 'l'],
  [/^(?:centiliter|cl)$/i, 'ml'], // ×10, siehe unten
  [/^(?:esslöffel|essl|el|eßl)$/i, 'EL'],
  [/^(?:teelöffel|teel|tl)$/i, 'TL'],
  [/^(?:prisen?)$/i, 'Prise'],
  [/^(?:stück|stk|st)$/i, 'Stück'],
  [/^(?:zehen?)$/i, 'Zehe'],
  [/^(?:bund|bd)$/i, 'Bund'],
  [/^(?:dosen?)$/i, 'Dose'],
  [/^(?:packung(?:en)?|päckchen|pck|pkg|pack|pk)$/i, 'Packung'],
  [/^(?:becher)$/i, 'Becher'],
  [/^(?:scheiben?)$/i, 'Scheibe'],
];

function zahl(text: string): number | null {
  const t = text.trim();
  const gemischt = t.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/) ?? t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (gemischt) return Number(gemischt[1]) + (gemischt[3] ? Number(gemischt[2]) / Number(gemischt[3]) : BRUCH[gemischt[2]]);
  if (BRUCH[t]) return BRUCH[t];
  const bruch = t.match(/^(\d+)\/(\d+)$/);
  if (bruch) return Number(bruch[1]) / Number(bruch[2]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const ZAHL = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\d+(?:[.,]\d+)?`;
const ANFANG = new RegExp(String.raw`^(?:ca\.?\s*|etwa\s+)?(${ZAHL})(?:\s*(?:-|–|bis)\s*(?:${ZAHL}))?\s*(.*)$`, 'i');

export function zutatAusZeile(zeile: string): ZutatTeile {
  let rest = zeile.replace(/\s+/g, ' ').trim();
  let hinweis: string | undefined;

  // Klammer am Ende bzw. „, gehackt“ wird zum Hinweis
  const klammer = rest.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (klammer && klammer[1]) {
    rest = klammer[1];
    hinweis = klammer[2].trim() || undefined;
  }

  if (/^(?:etwas|n\.\s?b\.?|nach belieben|nach geschmack|evtl\.?|einige)\s+/i.test(rest) || /\b(?:nach (?:belieben|geschmack)|n\.\s?b\.?)$/i.test(rest)) {
    const name = rest.replace(/^(?:etwas|n\.\s?b\.?|nach belieben|nach geschmack|evtl\.?|einige)\s+/i, '').replace(/,?\s*(?:nach (?:belieben|geschmack)|n\.\s?b\.?)$/i, '');
    return mitKomma({ einheit: 'nach Geschmack', name: name.trim() || rest, hinweis });
  }

  let menge: number | null | undefined;
  let einheit: Einheit | undefined;
  const m = rest.match(ANFANG);
  if (m) {
    menge = zahl(m[1]);
    rest = m[2];
    const [wort, ...danach] = rest.split(' ');
    // „Stück(e)“, „Zehe(n)“, „EL.“
    const roh = wort.replace(/\.$/, '').replace(/\((?:e|n|en|s)\)$/i, '');
    const treffer = EINHEIT_ALIAS.find(([re]) => re.test(roh));
    if (treffer && danach.length) {
      einheit = treffer[1];
      if (/^c/i.test(roh) && menge != null) menge = menge * 10;
      rest = danach.join(' ');
    } else if (/^knoblauchzehen?$/i.test(roh)) {
      // „2 Knoblauchzehen“
      einheit = 'Zehe';
      rest = ['Knoblauch', ...danach].join(' ');
    } else if (/^(?:große?|kleine?|mittelgroße?)$/i.test(roh) && danach.length) {
      einheit = 'Stück';
    }
    if (menge != null && menge >= 1000 && einheit === 'g') {
      menge = menge / 1000;
      einheit = 'kg';
    }
  }
  return mitKomma({ menge, einheit, name: rest.trim() || zeile.trim(), hinweis });
}

/** „Zwiebel, fein gewürfelt“ → Name „Zwiebel“, Hinweis „fein gewürfelt“ */
function mitKomma(z: ZutatTeile): ZutatTeile {
  const i = z.name.indexOf(',');
  if (i > 0) {
    const zusatz = z.name.slice(i + 1).trim();
    z.name = z.name.slice(0, i).trim();
    if (zusatz) z.hinweis = z.hinweis ? `${zusatz}; ${z.hinweis}` : zusatz;
  }
  z.name = z.name.charAt(0).toUpperCase() + z.name.slice(1);
  return z;
}
