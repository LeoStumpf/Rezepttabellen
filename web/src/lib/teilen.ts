import { Share } from '@capacitor/share';
import { istApp } from './app.ts';
import { zeigeMeldung } from './meldung.svelte.ts';

/** Text über das Teilen-Menü verschicken; im Browser ohne Web-Share in die Zwischenablage. */
export async function teilen(titel: string, text: string) {
  try {
    if (istApp) return void (await Share.share({ title: titel, text, dialogTitle: titel }));
    if (navigator.share) return void (await navigator.share({ title: titel, text }));
    await navigator.clipboard.writeText(text);
    zeigeMeldung('In die Zwischenablage kopiert');
  } catch (e) {
    // Abbrechen des Teilen-Dialogs ist kein Fehler
    if (!/cancel|abort/i.test(String((e as Error).message ?? e)) && (e as Error).name !== 'AbortError') zeigeMeldung(`Teilen fehlgeschlagen: ${(e as Error).message}`);
  }
}
