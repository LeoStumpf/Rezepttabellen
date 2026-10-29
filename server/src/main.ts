import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import chokidar from 'chokidar';
import sharp from 'sharp';
import archiver from 'archiver';
import type { FotoAuftragAnfrage, SpeichernAnfrage } from '@mrt/shared';
import { RezeptStore, StoreFehler } from './store.ts';
import { VorratStore } from './vorrat-store.ts';
import { SammlungStore } from './sammlung-store.ts';
import { FotoEingang } from './foto-eingang.ts';
import { erzeugePdf } from './pdf.ts';
import { importieren } from './import.ts';

const hier = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(hier, '../../data'));
const WEB_DIST = path.resolve(process.env.WEB_DIST ?? path.join(hier, '../../web/dist'));
const APP_PASSWORT = process.env.APP_PASSWORT ?? '';

const store = new RezeptStore(DATA_DIR);
store.abgleichen();
const vorrat = new VorratStore(DATA_DIR);
const sammlungen = new SammlungStore(DATA_DIR);
const fotos = new FotoEingang(DATA_DIR);

// Änderungen, die von Hand an den Dateien gemacht werden, übernehmen
let abgleichTimer: NodeJS.Timeout | undefined;
chokidar
  .watch(store.rezepteDir, { ignoreInitial: true, depth: 2, ignored: (p) => p.endsWith('.tmp') })
  .on('all', () => {
    clearTimeout(abgleichTimer);
    abgleichTimer = setTimeout(() => {
      try {
        store.abgleichen();
      } catch (e) {
        app.log.error(e);
      }
    }, 400);
  });

const app = Fastify({ logger: { level: 'info' }, bodyLimit: 200 * 1024 * 1024 });

// CORS – die Android-App läuft unter einem eigenen Origin
app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, X-App-Passwort');
  if (req.method === 'OPTIONS') return reply.code(204).send();
  if (APP_PASSWORT && req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-app-passwort'] !== APP_PASSWORT) {
    return reply.code(401).send({ fehler: 'Passwort erforderlich' });
  }
});

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof StoreFehler) return reply.code(err.status).send({ fehler: err.message, details: err.details });
  app.log.error(err);
  const e = err as { statusCode?: number; message?: string };
  return reply.code(e.statusCode ?? 500).send({ fehler: e.message ?? 'Interner Fehler' });
});

app.get('/api/status', async () => ({ ok: true, rev: store.rev, passwort: Boolean(APP_PASSWORT) }));

app.get('/api/rezepte', async () => store.liste());

app.get<{ Params: { id: string } }>('/api/rezepte/:id', async (req) => store.detail(req.params.id));

app.put<{ Params: { id: string }; Body: SpeichernAnfrage }>('/api/rezepte/:id', async (req) => store.speichern(req.params.id, req.body));

app.delete<{ Params: { id: string }; Querystring: { basisRev?: string } }>('/api/rezepte/:id', async (req) =>
  store.loeschen(req.params.id, req.query.basisRev ? Number(req.query.basisRev) : null),
);

app.get<{ Querystring: { seit?: string } }>('/api/sync/aenderungen', async (req) => store.aenderungen(Number(req.query.seit ?? 0)));

app.get('/api/vorrat', async () => vorrat.liste());

app.get<{ Querystring: { seit?: string } }>('/api/vorrat/aenderungen', async (req) => vorrat.aenderungen(Number(req.query.seit ?? 0)));

app.put<{ Body: { artikel: unknown } }>('/api/vorrat', async (req) => vorrat.uebernehmen(req.body?.artikel));

// Persönliche Listen: einkauf, favoriten, gekocht
app.get<{ Params: { name: string } }>('/api/sammlung/:name', async (req) => sammlungen.liste(req.params.name));

app.get<{ Params: { name: string }; Querystring: { seit?: string } }>('/api/sammlung/:name/aenderungen', async (req) =>
  sammlungen.aenderungen(req.params.name, Number(req.query.seit ?? 0)),
);

app.put<{ Params: { name: string }; Body: { eintraege: unknown } }>('/api/sammlung/:name', async (req) =>
  sammlungen.uebernehmen(req.params.name, req.body?.eintraege),
);

const THUMB_DIR = path.join(DATA_DIR, '.cache', 'thumbs');
const BILD = /\.(jpe?g|png|webp|gif|avif)$/i;

app.get<{ Params: { id: string; name: string }; Querystring: { w?: string } }>('/medien/:id/:name', async (req, reply) => {
  const { pfad, hash } = store.medienPfad(req.params.id, req.params.name);
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  return bildSenden(reply, pfad, hash, Number(req.query.w));
});

async function bildSenden(reply: FastifyReply, pfad: string, cacheName: string, w: number) {
  if (w && BILD.test(pfad)) {
    const breite = Math.min(Math.max(Math.round(w / 100) * 100, 200), 2000);
    const ziel = path.join(THUMB_DIR, `${cacheName}-${breite}.webp`);
    if (!fs.existsSync(ziel)) {
      fs.mkdirSync(THUMB_DIR, { recursive: true });
      await sharp(pfad).rotate().resize({ width: breite, withoutEnlargement: true }).webp({ quality: 80 }).toFile(ziel);
    }
    return reply.type('image/webp').send(fs.createReadStream(ziel));
  }
  return reply.sendFile(path.basename(pfad), path.dirname(pfad));
}

// Foto-Eingang: abfotografierte Rezepte, die noch ausgewertet werden
app.get('/api/fotos', async () => fotos.liste());

app.post<{ Body: FotoAuftragAnfrage }>('/api/fotos', async (req) => fotos.anlegen(req.body));

app.post<{ Params: { ordner: string } }>('/api/fotos/:ordner/erledigt', async (req) => {
  fotos.erledigt(req.params.ordner);
  return { ok: true };
});

app.get<{ Params: { ordner: string; name: string }; Querystring: { w?: string } }>('/fotos/:ordner/:name', async (req, reply) => {
  const pfad = fotos.bildPfad(req.params.ordner, req.params.name);
  reply.header('Cache-Control', 'private, max-age=86400');
  return bildSenden(reply, pfad, `foto-${req.params.ordner}-${req.params.name}`, Number(req.query.w));
});

// Rezept von einer Webseite als Entwurf für den Editor (schema.org/Recipe)
app.post<{ Body: { url?: string } }>('/api/import', async (req) => importieren(String(req.body?.url ?? '')));

app.get<{ Params: { id: string } }>('/api/rezepte/:id/pdf', async (req, reply) => {
  const d = store.detail(req.params.id);
  const pdf = await erzeugePdf(`http://127.0.0.1:${PORT}/#/druck/${encodeURIComponent(d.id)}`);
  return reply
    .type('application/pdf')
    .header('Content-Disposition', `attachment; filename="${d.slug}.pdf"`)
    .send(pdf);
});

app.get('/api/export.zip', async (_req, reply) => {
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.directory(store.rezepteDir, 'rezepte');
  zip.append(JSON.stringify(vorrat.liste(), null, 1), { name: 'vorrat.json' });
  zip.append(JSON.stringify(sammlungen.alles(), null, 1), { name: 'persoenlich.json' });
  void zip.finalize();
  const datum = new Date().toISOString().slice(0, 10);
  return reply.type('application/zip').header('Content-Disposition', `attachment; filename="rezepte-${datum}.zip"`).send(zip);
});

// Android-App zum Selbst-Aktualisieren (scripts/apk-veroeffentlichen.sh legt beides ab)
const APP_DIR = path.join(DATA_DIR, 'app');
app.get('/api/app', async (_req, reply) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(APP_DIR, 'version.json'), 'utf8'));
  } catch {
    return reply.code(404).send({ fehler: 'Keine App veröffentlicht' });
  }
});
app.get('/app/rezepttabellen.apk', async (_req, reply) => {
  const datei = path.join(APP_DIR, 'rezepttabellen.apk');
  if (!fs.existsSync(datei)) return reply.code(404).send({ fehler: 'Keine App veröffentlicht' });
  return reply
    .type('application/vnd.android.package-archive')
    .header('Content-Length', fs.statSync(datei).size)
    .header('Cache-Control', 'no-store')
    .send(fs.createReadStream(datei));
});

if (fs.existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/medien/') || req.url.startsWith('/fotos/') || req.url.startsWith('/app/')) return reply.code(404).send({ fehler: 'Nicht gefunden' });
    return reply.sendFile('index.html', WEB_DIST);
  });
} else {
  await app.register(fastifyStatic, { root: DATA_DIR, serve: false });
  app.log.warn(`Kein Web-Build unter ${WEB_DIST} – nur API aktiv (npm run build)`);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    vorrat.schliessen();
    sammlungen.schliessen();
    store.schliessen();
    process.exit(0);
  });
}

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info(`Daten: ${DATA_DIR}`);
