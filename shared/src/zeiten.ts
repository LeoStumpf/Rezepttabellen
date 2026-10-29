/** Zeitangaben in Schritttexten („10–15 Minuten köcheln“) für antippbare Timer. */
export type TextTeil = { text: string; sekunden?: number };

const BRUCH: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const ZAHL = String.raw`\d+(?:[.,]\d+)?`;
const MUSTER = new RegExp(
  String.raw`(?<![\p{L}\d])` +
    String.raw`(?:(${ZAHL})\s?([½¼¾])?|([½¼¾])|(eine[rn]?\s+halben?|halbe[rn]?|eine[rn]?))` +
    String.raw`\s*(?:(?:-|–|bis)\s*(${ZAHL})\s*)?` +
    String.raw`(Sekunden?|Sek\.?|Minuten?|Min\.?|Stunden?|Std\.?|h)(?![\p{L}])`,
  'giu',
);

function einheitSekunden(e: string): number {
  const k = e.toLowerCase();
  if (k.startsWith('sek')) return 1;
  if (k.startsWith('min')) return 60;
  return 3600;
}

/** Zerlegt einen Text in Teile; Zeitangaben bekommen ihre Dauer in Sekunden (bei Spannen der obere Wert). */
export function findeZeiten(text: string): TextTeil[] {
  const teile: TextTeil[] = [];
  let pos = 0;
  for (const m of text.matchAll(MUSTER)) {
    const [ganz, zahl, bruch, nurBruch, wort, bis, einheit] = m;
    let wert: number;
    if (bis) wert = Number(bis.replace(',', '.'));
    else if (zahl) wert = Number(zahl.replace(',', '.')) + (bruch ? BRUCH[bruch] : 0);
    else if (nurBruch) wert = BRUCH[nurBruch];
    else wert = /halbe/i.test(wort) ? 0.5 : 1;
    const sekunden = Math.round(wert * einheitSekunden(einheit));
    if (!(sekunden > 0) || sekunden > 48 * 3600) continue;
    if (m.index > pos) teile.push({ text: text.slice(pos, m.index) });
    teile.push({ text: ganz, sekunden });
    pos = m.index + ganz.length;
  }
  if (pos < text.length) teile.push({ text: text.slice(pos) });
  return teile;
}

/** 90 → „1:30“, 3700 → „1:01:40“ */
export function formatRestzeit(sekunden: number): string {
  const s = Math.max(0, Math.ceil(sekunden));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
