import { App } from '@capacitor/app';
import { istApp } from './app.ts';
import { einstellungen } from './einstellungen.ts';

/** Eigene Version und ob der Server eine neuere anbietet (scripts/apk-veroeffentlichen.sh). */
export const appVersion = $state({
  name: '',
  code: 0,
  update: null as { name: string; url: string } | null,
  /** Server hat geantwortet (sonst ist „aktuell“ nicht belegt) */
  geprueft: false,
});

const AUSGEBLENDET = 'mrt.updateAusgeblendet';

export async function updatePruefen() {
  if (!istApp) return;
  try {
    if (!appVersion.code) {
      const info = await App.getInfo();
      appVersion.name = info.version;
      appVersion.code = Number(info.build);
    }
    const server = einstellungen.serverUrl;
    if (!server) return;
    const res = await fetch(`${server}/api/app`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const neu = (await res.json()) as { versionCode: number; versionName: string };
    appVersion.geprueft = true;
    appVersion.update = neu.versionCode > appVersion.code ? { name: neu.versionName, url: `${server}/app/rezepttabellen.apk` } : null;
  } catch {
    /* offline – beim nächsten Mal */
  }
}

/** Banner nur ausblenden, bis eine noch neuere Version kommt. */
export function updateAusgeblendet(): boolean {
  try {
    return !!appVersion.update && localStorage.getItem(AUSGEBLENDET) === appVersion.update.name;
  } catch {
    return false;
  }
}
export function updateAusblenden() {
  try {
    if (appVersion.update) localStorage.setItem(AUSGEBLENDET, appVersion.update.name);
  } catch {
    /* egal */
  }
}
