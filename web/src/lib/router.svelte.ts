/** Minimaler Hash-Router (funktioniert identisch im Browser, in der App und für den PDF-Renderer). */
export type Route =
  | { seite: 'uebersicht' }
  | { seite: 'rezept'; id: string }
  | { seite: 'varianten'; gruppe: string }
  | { seite: 'druck'; id: string }
  | { seite: 'bearbeiten'; id: string }
  | { seite: 'neu' }
  | { seite: 'einstellungen' }
  | { seite: 'vorrat' }
  | { seite: 'einkauf' }
  | { seite: 'fotos' };

function parse(hash: string): Route {
  const teile = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (teile[0]) {
    case 'rezept':
      return { seite: 'rezept', id: teile[1] };
    case 'varianten':
      return { seite: 'varianten', gruppe: teile[1] };
    case 'druck':
      return { seite: 'druck', id: teile[1] };
    case 'bearbeiten':
      return { seite: 'bearbeiten', id: teile[1] };
    case 'neu':
      return { seite: 'neu' };
    case 'einstellungen':
      return { seite: 'einstellungen' };
    case 'vorrat':
      return { seite: 'vorrat' };
    case 'einkauf':
      return { seite: 'einkauf' };
    case 'fotos':
      return { seite: 'fotos' };
    default:
      return { seite: 'uebersicht' };
  }
}

const normHash = (h: string) => '#/' + h.replace(/^#?\/?/, '');

export const router = $state({ route: parse(location.hash) });

// Scroll-Position je Seite merken, damit „Zurück“ zur Übersicht an der alten Stelle landet
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const scrollPositionen = new Map<string, number>();
let aktuellerScroll = 0;
window.addEventListener('scroll', () => (aktuellerScroll = window.scrollY), { passive: true });

/**
 * Eigener Verlauf dieser Sitzung. Die Browser-History allein reicht nicht: Die Android-WebView
 * überspringt Einträge ohne Nutzergeste, und nach einem Neustart der App gibt es gar keine.
 */
const verlauf: string[] = [normHash(location.hash)];
let ersetzt = false;

window.addEventListener('hashchange', () => {
  const neu = normHash(location.hash);
  scrollPositionen.set(verlauf[verlauf.length - 1], aktuellerScroll);
  if (ersetzt) verlauf[verlauf.length - 1] = neu;
  else if (verlauf.length > 1 && verlauf[verlauf.length - 2] === neu) verlauf.pop(); // zurück
  else verlauf.push(neu);
  ersetzt = false;
  router.route = parse(location.hash);
  aktuellerScroll = 0;
  window.scrollTo(0, 0);
});

const aktuellerHash = () => verlauf[verlauf.length - 1];

function ersetzen(pfad: string) {
  ersetzt = true;
  location.replace(normHash(pfad));
}

/** Gemerkte Scroll-Position der aktuellen Seite (nach dem Laden der Inhalte aufrufen). */
export function scrollWiederherstellen() {
  const y = scrollPositionen.get(aktuellerHash());
  if (y) requestAnimationFrame(() => window.scrollTo(0, y));
}

export function geheZu(pfad: string) {
  location.hash = pfad;
}

/** Zu `pfad`, ohne einen Verlaufseintrag anzulegen (Wechsel zwischen Varianten: „Zurück“ führt aus der Gruppe heraus). */
export function wechsleZu(pfad: string) {
  ersetzen(pfad);
}

/** Wohin „Zurück“ führt, wenn es keinen Verlauf gibt. */
function elternVon(r: Route): string {
  if (r.seite === 'druck' || r.seite === 'bearbeiten') return `/rezept/${encodeURIComponent(r.id)}`;
  return '/';
}

/**
 * Eine Seite zurück (Zurück-Taste, „← Zurück“, „Abbrechen“): in den Verlauf, wenn es einen gibt,
 * sonst zur logischen Elternseite. Bleibt `history.back()` wirkungslos, greift ebenfalls die Elternseite.
 */
export function zurueck() {
  const vorher = aktuellerHash();
  if (verlauf.length > 1) {
    history.back();
    setTimeout(() => {
      if (aktuellerHash() === vorher) ersetzen(elternVon(router.route));
    }, 400);
  } else {
    ersetzen(elternVon(router.route));
  }
}

/** Zurück zu `pfad`: per History, wenn man von dort kam (kein doppelter Eintrag), sonst ersetzen. */
export function zurueckZu(pfad: string) {
  if (verlauf.length > 1 && verlauf[verlauf.length - 2] === normHash(pfad)) zurueck();
  else ersetzen(pfad);
}
