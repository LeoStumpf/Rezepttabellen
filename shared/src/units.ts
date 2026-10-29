export const EINHEITEN = [
  'g',
  'kg',
  'ml',
  'l',
  'EL',
  'TL',
  'Prise',
  'Stück',
  'Zehe',
  'Bund',
  'Dose',
  'Packung',
  'Becher',
  'Scheibe',
  'nach Geschmack',
] as const;

export type Einheit = (typeof EINHEITEN)[number];

/** Einheiten, bei denen Brüche (½, ¼ …) natürlicher sind als Dezimalzahlen. */
const BRUCH_EINHEITEN = new Set<string>(['EL', 'TL', 'Stück', 'Zehe', 'Bund', 'Dose', 'Packung', 'Becher', 'Scheibe', 'Prise']);

const BRUECHE: [number, string][] = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

const PLURAL: Record<string, string> = { Zehe: 'Zehen', Dose: 'Dosen', Packung: 'Packungen', Scheibe: 'Scheiben', Prise: 'Prisen' };

export function formatMenge(menge: number | null | undefined, einheit?: string): string {
  if (einheit === 'nach Geschmack' || menge == null) return einheit === 'nach Geschmack' ? 'n. B.' : '';
  let zahl: string;
  const ganz = Math.floor(menge);
  const rest = menge - ganz;
  const bruch = BRUCH_EINHEITEN.has(einheit ?? 'Stück') ? BRUECHE.find(([w]) => Math.abs(w - rest) < 0.01) : undefined;
  if (rest < 0.001) zahl = String(ganz);
  else if (bruch) zahl = (ganz ? `${ganz} ` : '') + bruch[1];
  else zahl = menge.toLocaleString('de-DE', { maximumFractionDigits: 2 });

  if (!einheit || einheit === 'Stück') return zahl;
  const e = menge > 1 && PLURAL[einheit] ? PLURAL[einheit] : einheit;
  return `${zahl} ${e}`;
}

export function formatDauer(min?: number): string {
  if (min == null) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const GRUNDEINHEIT: Record<string, [string, number]> = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000] };

export interface Menge {
  menge?: number | null;
  einheit?: Einheit;
}

/**
 * Zwei Mengen derselben Zutat zusammenzählen (Einkaufsliste). g/kg und ml/l werden umgerechnet,
 * ab 1000 g bzw. ml in kg/l angezeigt. Passen die Einheiten nicht zusammen: null.
 */
export function addiereMengen(a: Menge, b: Menge): Menge | null {
  const ea = a.einheit ?? 'Stück';
  const eb = b.einheit ?? 'Stück';
  if (ea === 'nach Geschmack' || eb === 'nach Geschmack') return ea === eb ? { menge: null, einheit: 'nach Geschmack' } : null;
  const ga = GRUNDEINHEIT[ea];
  const gb = GRUNDEINHEIT[eb];
  if (ga && gb) {
    if (ga[0] !== gb[0]) return null;
    if (a.menge == null || b.menge == null) return a.menge == null ? b : a;
    const summe = a.menge * ga[1] + b.menge * gb[1];
    const gross = ga[0] === 'g' ? 'kg' : 'l';
    return summe >= 1000 ? { menge: Math.round(summe / 10) / 100, einheit: gross } : { menge: Math.round(summe * 10) / 10, einheit: ga[0] as Einheit };
  }
  if (ea !== eb) return null;
  if (a.menge == null || b.menge == null) return a.menge == null ? b : a;
  return { menge: Math.round((a.menge + b.menge) * 100) / 100, einheit: a.einheit ?? b.einheit };
}
