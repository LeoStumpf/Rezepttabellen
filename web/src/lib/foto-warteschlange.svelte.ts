import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { neueId, type FotoAuftrag, type FotoAuftragAnfrage } from '@mrt/shared';
import { istApp } from './app.ts';
import { einstellungen } from './einstellungen.ts';
import { blobZuBase64 } from './storage/types.ts';

/**
 * Foto-Aufträge (abfotografierte Rezepte) auf dem Weg zum Server.
 * In der App liegt jeder Auftrag zuerst auf dem Handy:
 *   <App-Speicher>/MyRecipetables/foto-warteschlange/<id>/{auftrag.json, bild-1.jpg, …}
 * und wird gelöscht, sobald der Server ihn bestätigt hat. Ist der Server nicht
 * erreichbar (unterwegs), bleibt er liegen und geht beim nächsten Versuch hoch.
 * Im Browser wird direkt hochgeladen.
 */
const DIR = Directory.External;
const WURZEL = 'MyRecipetables/foto-warteschlange';

interface LokalerAuftrag {
  id: string;
  erstellt: string;
  notiz: string;
  bilder: string[];
}

export const warteschlange = $state({ wartend: 0, laeuft: false, letzterFehler: '' });

function server() {
  return istApp ? einstellungen.serverUrl : '';
}

function kopfzeilen(): Record<string, string> {
  const pw = einstellungen.passwort;
  return pw ? { 'X-App-Passwort': pw } : {};
}

async function erreichbar(): Promise<boolean> {
  if (istApp && !server()) return false;
  try {
    const res = await fetch(`${server()}/api/status`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function senden(a: FotoAuftragAnfrage) {
  const res = await fetch(`${server()}/api/fotos`, {
    method: 'POST',
    headers: { ...kopfzeilen(), 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  });
  if (!res.ok) {
    const d = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    throw new Error(d?.fehler ?? `${res.status} ${res.statusText}`);
  }
}

async function lokaleAuftraege(): Promise<string[]> {
  try {
    const { files } = await Filesystem.readdir({ path: WURZEL, directory: DIR });
    return files.filter((f) => f.type === 'directory').map((f) => f.name);
  } catch {
    return [];
  }
}

export async function aktualisieren() {
  if (istApp) warteschlange.wartend = (await lokaleAuftraege()).length;
}

/** Legt einen Auftrag an (in der App erst lokal) und versucht sofort, ihn hochzuladen. */
export async function auftragAnlegen(bilder: Blob[], notiz: string): Promise<'gesendet' | 'wartet'> {
  const id = neueId();
  const erstellt = new Date().toISOString();
  const namen = bilder.map((b, i) => `bild-${i + 1}.${b.type === 'image/png' ? 'png' : b.type === 'image/webp' ? 'webp' : 'jpg'}`);

  if (!istApp) {
    const daten: Record<string, string> = {};
    for (let i = 0; i < bilder.length; i++) daten[namen[i]] = await blobZuBase64(bilder[i]);
    await senden({ id, erstellt, notiz, geraet: 'Browser', bilder: daten });
    return 'gesendet';
  }

  await Filesystem.mkdir({ path: `${WURZEL}/${id}`, directory: DIR, recursive: true });
  for (let i = 0; i < bilder.length; i++) {
    await Filesystem.writeFile({ path: `${WURZEL}/${id}/${namen[i]}`, directory: DIR, data: await blobZuBase64(bilder[i]) });
  }
  const info: LokalerAuftrag = { id, erstellt, notiz, bilder: namen };
  // auftrag.json zuletzt: erst wenn sie da ist, gilt der Auftrag als vollständig
  await Filesystem.writeFile({ path: `${WURZEL}/${id}/auftrag.json`, directory: DIR, data: JSON.stringify(info), encoding: Encoding.UTF8 });
  await aktualisieren();
  await hochladen();
  return (await lokaleAuftraege()).includes(id) ? 'wartet' : 'gesendet';
}

/** Lädt alle wartenden Aufträge hoch, falls der Server erreichbar ist. Gibt die Zahl der gesendeten zurück. */
export async function hochladen(): Promise<number> {
  if (!istApp || warteschlange.laeuft) return 0;
  const ids = await lokaleAuftraege();
  warteschlange.wartend = ids.length;
  if (!ids.length) return 0;
  warteschlange.laeuft = true;
  let gesendet = 0;
  try {
    if (!(await erreichbar())) {
      warteschlange.letzterFehler = 'Server nicht erreichbar';
      return 0;
    }
    warteschlange.letzterFehler = '';
    for (const id of ids) {
      let info: LokalerAuftrag;
      try {
        const { data } = await Filesystem.readFile({ path: `${WURZEL}/${id}/auftrag.json`, directory: DIR, encoding: Encoding.UTF8 });
        info = JSON.parse(String(data));
      } catch {
        continue; // unvollständig (App beim Speichern beendet) – nicht anfassen
      }
      try {
        const daten: Record<string, string> = {};
        for (const n of info.bilder) daten[n] = String((await Filesystem.readFile({ path: `${WURZEL}/${id}/${n}`, directory: DIR })).data);
        await senden({ id: info.id, erstellt: info.erstellt, notiz: info.notiz, geraet: 'Handy', bilder: daten });
        await Filesystem.rmdir({ path: `${WURZEL}/${id}`, directory: DIR, recursive: true });
        gesendet++;
      } catch (e) {
        warteschlange.letzterFehler = (e as Error).message;
      }
    }
  } finally {
    warteschlange.laeuft = false;
    await aktualisieren();
  }
  return gesendet;
}

/** Aufträge, die auf dem Server noch auf Auswertung warten. */
export async function serverAuftraege(): Promise<FotoAuftrag[]> {
  const res = await fetch(`${server()}/api/fotos`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function serverBildUrl(a: FotoAuftrag, name: string, breite?: number) {
  return `${server()}/fotos/${encodeURIComponent(a.ordner)}/${encodeURIComponent(name)}${breite ? `?w=${breite}` : ''}`;
}

export async function alsErledigt(a: FotoAuftrag) {
  const res = await fetch(`${server()}/api/fotos/${encodeURIComponent(a.ordner)}/erledigt`, { method: 'POST', headers: kopfzeilen() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

if (istApp) {
  // Beim Start und immer wenn die App wieder in den Vordergrund kommt
  setTimeout(() => void hochladen(), 1500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void hochladen();
  });
}
