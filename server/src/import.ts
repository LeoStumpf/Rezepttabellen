import sharp from 'sharp';
import { neueId, pruefeRezept, slugify, woerter, zutatAusZeile, type Rezept, type Schritt, type Zutat } from '@mrt/shared';
import { StoreFehler } from './store.ts';

/**
 * Rezept von einer Webseite übernehmen. Fast alle Rezeptseiten (Chefkoch, BBC Good Food, Blogs mit
 * WordPress-Rezeptplugins …) liefern die Daten maschinenlesbar als schema.org/Recipe in JSON-LD mit.
 * Ergebnis ist ein Entwurf für den Editor; gespeichert wird erst dort.
 */
export interface ImportErgebnis {
  rezept: Rezept;
  notizen: string;
  /** Bild als JPEG, base64 */
  bild?: string;
  /** Hinweise für den Nutzer, z. B. wenn die Schrittzuordnung geraten ist */
  hinweise: string[];
}

/** Markierung in den Notizen: Inhaltsregeln (deutsche Zutaten, vegetarisch, ohne Tomaten) noch offen. */
export const IMPORT_MARKE = '<!-- import: Inhaltsregeln offen -->';

const MAX_BYTES = 5 * 1024 * 1024;
const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

type Json = Record<string, unknown>;

export async function importieren(url: string): Promise<ImportErgebnis> {
  let adresse: URL;
  try {
    adresse = new URL(url.trim());
  } catch {
    throw new StoreFehler(400, 'Das ist keine gültige Adresse');
  }
  if (!/^https?:$/.test(adresse.protocol)) throw new StoreFehler(400, 'Nur http- und https-Adressen');
  const html = (await laden(adresse.href, 'text/html')).toString('utf8');
  const erg = rezeptAusHtml(html, adresse.href);
  if (erg.bildUrl) {
    try {
      const roh = await laden(new URL(erg.bildUrl, adresse.href).href, 'image/*');
      erg.bild = (await sharp(roh).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64');
    } catch {
      erg.hinweise.push('Das Bild der Seite ließ sich nicht laden – bitte selbst eins hinzufügen.');
    }
  }
  const { bildUrl: _, ...rest } = erg;
  return rest;
}

async function laden(url: string, accept: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: accept, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5' }, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
  } catch (e) {
    throw new StoreFehler(502, `Seite nicht erreichbar: ${(e as Error).message}`);
  }
  if (!res.ok || !res.body) throw new StoreFehler(502, `Seite antwortet mit ${res.status}`);
  const teile: Buffer[] = [];
  let groesse = 0;
  for await (const stueck of res.body as unknown as AsyncIterable<Uint8Array>) {
    groesse += stueck.length;
    if (groesse > MAX_BYTES) throw new StoreFehler(413, 'Seite ist zu groß');
    teile.push(Buffer.from(stueck));
  }
  return Buffer.concat(teile);
}

/** Reine Umwandlung HTML → Rezeptentwurf (ohne Netz, testbar). */
export function rezeptAusHtml(html: string, url: string): ImportErgebnis & { bildUrl?: string } {
  const gefunden = findeRezeptJson(html);
  if (!gefunden) throw new StoreFehler(422, 'Auf dieser Seite wurden keine Rezeptdaten gefunden');
  const { rezept: daten, knoten } = gefunden;
  // Verweise im @graph ({"@id": "…#primaryimage"}) auflösen
  const auf = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(auf);
    const id = x && typeof x === 'object' ? (x as Json)['@id'] : undefined;
    return typeof id === 'string' && knoten.has(id) && Object.keys(x as Json).length === 1 ? knoten.get(id) : x;
  };
  const hinweise: string[] = [];

  // Chefkoch hängt den Autor an („Kirschtaschen von Chefkoch_Christina“)
  const autor = text((auf([daten.author].flat()[0]) as Json | undefined)?.name);
  const nachsatz = autor ? new RegExp(`\\s+von\\s+${regexText(autor)}$`, 'i') : /\s+von\s+\S*_\S*$/;
  const titel = (text(daten.name) || 'Importiertes Rezept').replace(nachsatz, '');
  const beschreibung = text(daten.description);
  const zutaten = zutatenAus(daten.recipeIngredient ?? daten.ingredients);
  const schrittTexte = schritteAus(daten.recipeInstructions);
  if (!schrittTexte.length) hinweise.push('Die Seite enthält keine Arbeitsschritte – bitte ergänzen.');
  const schritte = nimmtZuordnen(schrittTexte, zutaten);
  if (schritte.length > 1) hinweise.push('Welche Zutat in welchen Schritt gehört, ist geraten – bitte in der Tabellenvorschau prüfen.');

  const gesamt = dauer(daten.totalTime) ?? summe(dauer(daten.prepTime), dauer(daten.cookTime));
  const aktiv = dauer(daten.prepTime);
  const diaet = [daten.suitableForDiet].flat().map((d) => String(d ?? ''));
  const tags = diaet.some((d) => /VeganDiet/i.test(d)) ? ['vegan'] : diaet.some((d) => /VegetarianDiet/i.test(d)) ? ['vegetarisch'] : [];

  const rezept: Rezept = {
    id: neueId(),
    titel,
    untertitel: beschreibung ? kuerzen(beschreibung, 220) : undefined,
    portionen: portionenAus(daten.recipeYield),
    zeit: gesamt || aktiv ? { gesamt_min: gesamt ?? undefined, aktiv_min: aktiv && aktiv !== gesamt ? aktiv : undefined } : undefined,
    tags,
    bilder: [],
    quelle: { name: quellName(auf([daten.publisher].flat()[0]) as Json | undefined, url), url },
    zutaten,
    schritte,
  };
  const pruef = pruefeRezept(rezept);
  if (!pruef.ok) hinweise.push(...pruef.fehler);

  const notizen = `${IMPORT_MARKE}\nImportiert von <${url}> am ${new Date().toLocaleDateString('de-DE')}.\n`;
  return { rezept: pruef.ok ? pruef.rezept : rezept, notizen, hinweise, bildUrl: bildAus(auf(daten.image)) };
}

// ---------- JSON-LD finden ----------

function findeRezeptJson(html: string): { rezept: Json; knoten: Map<string, Json> } | null {
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  const knoten = new Map<string, Json>();
  let rezept: Json | null = null;
  for (const m of html.matchAll(re)) {
    let daten: unknown;
    try {
      daten = JSON.parse(m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, ''));
    } catch {
      continue;
    }
    sammeln(daten, knoten);
    rezept ??= suche(daten);
  }
  return rezept ? { rezept, knoten } : null;
}

/** Alle Knoten mit @id merken (für Verweise auf Bild, Autor, Herausgeber). */
function sammeln(x: unknown, knoten: Map<string, Json>) {
  if (Array.isArray(x)) return x.forEach((e) => sammeln(e, knoten));
  if (!x || typeof x !== 'object') return;
  const o = x as Json;
  if (typeof o['@id'] === 'string' && Object.keys(o).length > 1) knoten.set(o['@id'], o);
  sammeln(o['@graph'], knoten);
}

function suche(x: unknown): Json | null {
  if (Array.isArray(x)) {
    for (const e of x) {
      const r = suche(e);
      if (r) return r;
    }
    return null;
  }
  if (!x || typeof x !== 'object') return null;
  const o = x as Json;
  const typ = [o['@type']].flat().map(String);
  if (typ.some((t) => t === 'Recipe' || t.endsWith('/Recipe'))) return o;
  return suche(o['@graph']) ?? suche(o.mainEntity) ?? null;
}

// ---------- Felder ----------

const regexText = (t: string) => t.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', frac12: '½', frac14: '¼', frac34: '¾' };

function text(x: unknown): string {
  if (x == null) return '';
  if (Array.isArray(x)) return text(x[0]);
  if (typeof x === 'object') return text((x as Json).text ?? (x as Json).name ?? '');
  return String(x)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+\d*);/gi, (m, n) => ENTITAETEN[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function kuerzen(t: string, max: number): string {
  if (t.length <= max) return t;
  const satz = t.slice(0, max).match(/^.*[.!?](?=\s)/);
  return satz && satz[0].length > max / 2 ? satz[0] : `${t.slice(0, max).replace(/\s+\S*$/, '')} …`;
}

/** ISO-8601-Dauer („PT1H30M“, „P0DT0H45M“) → Minuten */
function dauer(x: unknown): number | null {
  const m = text(x).match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:\d+(?:\.\d+)?S)?)?$/i);
  if (!m) return null;
  const min = Math.round(Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
  return min > 0 ? min : null;
}
const summe = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));

function portionenAus(x: unknown): number | undefined {
  for (const v of [x].flat()) {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').match(/\d+/)?.[0]);
    if (Number.isInteger(n) && n > 0 && n < 100) return n;
  }
  return undefined;
}

function bildAus(x: unknown): string | undefined {
  const erstes = [x].flat()[0];
  if (!erstes) return undefined;
  if (typeof erstes === 'string') return erstes;
  const o = erstes as Json;
  return typeof o.url === 'string' ? o.url : typeof o.contentUrl === 'string' ? o.contentUrl : undefined;
}

function quellName(pub: Json | undefined, url: string): string {
  const name = text(pub?.name);
  return name || new URL(url).hostname.replace(/^www\./, '');
}

function zutatenAus(x: unknown): Zutat[] {
  const belegt = new Set<string>();
  const liste: Zutat[] = [];
  for (const zeile of [x].flat().map(text).filter(Boolean)) {
    const t = zutatAusZeile(zeile);
    const basis = slugify(t.name).replace(/-/g, '_').slice(0, 30) || 'zutat';
    let id = basis;
    for (let i = 2; belegt.has(id); i++) id = `${basis}${i}`;
    belegt.add(id);
    liste.push({ id, name: t.name, ...(t.menge != null && { menge: t.menge }), ...(t.einheit && { einheit: t.einheit }), ...(t.hinweis && { hinweis: t.hinweis }) });
  }
  return liste;
}

function schritteAus(x: unknown): string[] {
  if (x == null) return [];
  if (typeof x === 'string') return x.replace(/<\/(?:p|li)>|<br\s*\/?>/gi, '\n').split(/\n+/).map(text).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(schritteAus);
  const o = x as Json;
  if (o.itemListElement) return schritteAus(o.itemListElement); // HowToSection
  const t = text(o.text ?? o.name);
  return t ? [t] : [];
}

/**
 * Das Schema verlangt, dass jeder Schritt etwas „nimmt“ und jede Zutat genau einmal vorkommt.
 * Zutat → erster Schritt, in dem eines ihrer Wörter vorkommt; der Rest in Schritt 1.
 * Jeder weitere Schritt nimmt zusätzlich den vorigen (Kette).
 */
function nimmtZuordnen(texte: string[], zutaten: Zutat[]): Schritt[] {
  if (!texte.length) return [];
  const schrittWoerter = texte.map((t) => new Set(woerter(t)));
  const nimmt: string[][] = texte.map(() => []);
  for (const z of zutaten) {
    const zw = woerter(z.name).filter((w) => w.length >= 4);
    const i = schrittWoerter.findIndex((ws) => zw.some((w) => ws.has(w)));
    nimmt[i >= 0 ? i : 0].push(z.id);
  }
  // Schritt 1 braucht etwas: notfalls die Zutaten des ersten Schritts, der welche hat
  if (!nimmt[0].length) {
    const j = nimmt.findIndex((n) => n.length);
    if (j > 0) [nimmt[0], nimmt[j]] = [nimmt[j], []];
  }
  return texte.map((text, i) => ({ id: `s${i + 1}`, text, nimmt: i === 0 ? nimmt[0] : [`s${i}`, ...nimmt[i]] }));
}
