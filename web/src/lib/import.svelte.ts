import type { Rezept } from '@mrt/shared';
import { istApp, TeilenEmpfang } from './app.ts';
import { einstellungen } from './einstellungen.ts';
import { geheZu } from './router.svelte.ts';

export interface ImportErgebnis {
  rezept: Rezept;
  notizen: string;
  bild?: string;
  hinweise: string[];
}

/** Rezept von einer Webseite holen – der Server lädt und liest die Seite (in der App: der eingestellte Server). */
export async function vonWebseite(url: string): Promise<ImportErgebnis> {
  const basis = istApp ? einstellungen.serverUrl : '';
  if (istApp && !basis) throw new Error('Für den Import muss in „Sync“ ein Server eingetragen sein.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (einstellungen.passwort) headers['X-App-Passwort'] = einstellungen.passwort;
  let res: Response;
  try {
    res = await fetch(`${basis}/api/import`, { method: 'POST', headers, body: JSON.stringify({ url }) });
  } catch {
    throw new Error('Server nicht erreichbar – der Import geht nur im Heimnetz.');
  }
  const daten = await res.json().catch(() => null);
  if (!res.ok) throw new Error(daten?.fehler ?? res.statusText);
  return daten as ImportErgebnis;
}

/** Erste Adresse in einem geteilten Text („Schau mal: https://…“). */
export const urlIn = (text: string) => text.match(/https?:\/\/[^\s<>"]+/)?.[0];

/** Von Android geteilte Adresse, die der Editor beim Öffnen importiert. */
export const geteilt = $state({ url: '' });

function angekommen(text?: string) {
  const url = text && urlIn(text);
  if (!url) return;
  geteilt.url = url;
  geheZu('/neu');
}

/** An die App geteilte Links (Chrome → Teilen → Rezepttabellen) landen im Import des Editors. */
export function teilenEmpfangEinrichten() {
  if (!istApp) return;
  void TeilenEmpfang.holen().then((d) => angekommen(d.text), () => {});
  void TeilenEmpfang.addListener('geteilt', (d) => angekommen(d.text));
}
