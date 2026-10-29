import { App } from '@capacitor/app';
import { istApp } from './app.ts';
import { router, zurueck } from './router.svelte.ts';

/** Offene Dialoge/Menüs, die die Zurück-Taste zuerst schließt (zuletzt geöffnet zuerst). */
const schliesser: (() => void)[] = [];

/** Registriert einen Dialog für die Zurück-Taste; gibt die Abmeldung zurück (passt als $effect-Rückgabe). */
export function zurueckSchliesst(fn: () => void): () => void {
  schliesser.push(fn);
  return () => {
    const i = schliesser.lastIndexOf(fn);
    if (i >= 0) schliesser.splice(i, 1);
  };
}

/** Android-Zurück-Taste: Dialog schließen → eine Seite zurück (siehe `zurueck`) → auf der Übersicht App minimieren. */
export function zurueckTasteEinrichten() {
  if (!istApp) return;
  void App.addListener('backButton', () => {
    const schliessen = schliesser.pop();
    if (schliessen) return schliessen();
    if (router.route.seite === 'uebersicht') return void App.minimizeApp();
    zurueck();
  });
}
