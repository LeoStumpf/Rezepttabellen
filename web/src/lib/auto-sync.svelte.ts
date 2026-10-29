import { App } from '@capacitor/app';
import { geraeteStore } from './app.ts';
import { einstellungen } from './einstellungen.ts';
import { hochladen } from './foto-warteschlange.svelte.ts';
import { vorratLaden } from './vorrat.svelte.ts';
import { sammlungenLaden } from './sammlung.svelte.ts';
import { updatePruefen } from './app-update.svelte.ts';

/** Stiller Hintergrund-Sync der App: beim Start und beim Zurückkehren, höchstens alle 2 min. */
export const autoSync = $state({ laeuft: false, fehler: '' });

const ABSTAND_MS = 2 * 60_000;
let zuletzt = 0;

export async function jetztSynchronisieren(erzwingen = false) {
  if (!geraeteStore || !einstellungen.serverUrl || autoSync.laeuft) return;
  if (!erzwingen && Date.now() - zuletzt < ABSTAND_MS) return;
  zuletzt = Date.now();
  void updatePruefen();
  autoSync.laeuft = true;
  try {
    const erg = await geraeteStore.synchronisieren(einstellungen.serverUrl, einstellungen.passwort);
    autoSync.fehler = erg.fehler.length ? erg.fehler.join('; ') : '';
    if (erg.geladen || erg.hochgeladen || erg.vorrat || erg.sammlungen) {
      await Promise.all([vorratLaden(), sammlungenLaden()]);
      window.dispatchEvent(new Event('sync-fertig'));
    }
    void hochladen();
  } catch (e) {
    // unterwegs ohne Heimnetz ist das normal – nur anzeigen, nicht stören
    autoSync.fehler = (e as Error).message;
  } finally {
    autoSync.laeuft = false;
  }
}

export function autoSyncEinrichten() {
  if (!geraeteStore) return;
  void jetztSynchronisieren(true);
  void App.addListener('resume', () => void jetztSynchronisieren());
}
