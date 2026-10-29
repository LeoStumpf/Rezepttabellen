/** Rundet auf ein Vielfaches von `schritt`, aber nie auf 0. */
function runde(x: number, schritt: number): number {
  return Math.max(schritt, Math.round(x / schritt) * schritt);
}

/**
 * Menge für umgerechnete Portionen bzw. eine vorhandene Zutatmenge.
 * Gerundet wird so, wie man in der Küche abmisst: Gramm/Milliliter auf 1–50er-Schritte,
 * Löffel und Stückzahlen auf ¼ bzw. ½. „nach Geschmack“ bleibt unverändert.
 */
export function skaliereMenge(menge: number | null | undefined, einheit: string | undefined, faktor: number): number | null | undefined {
  if (menge == null || faktor === 1 || einheit === 'nach Geschmack') return menge;
  const x = menge * faktor;
  switch (einheit) {
    case 'g':
    case 'ml':
      return runde(x, x < 10 ? 1 : x < 100 ? 5 : x < 1000 ? 10 : 50);
    case 'kg':
    case 'l':
      return Math.round(runde(x, 0.05) * 100) / 100;
    case 'Prise':
      return runde(x, 1);
    default:
      return runde(x, x < 2 ? 0.25 : 0.5);
  }
}

/** Faktor aus einer vorhandenen Menge („ich habe 250 g statt 500 g“). */
export function faktorAusMenge(vorhanden: number, original: number | null | undefined): number | null {
  if (!original || !(vorhanden > 0)) return null;
  return vorhanden / original;
}
