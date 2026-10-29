import { Capacitor, registerPlugin } from '@capacitor/core';
import { HttpStore } from './storage/http-store.ts';
import { DeviceStore } from './storage/device-store.ts';
import type { Store } from './storage/types.ts';

export const istApp = Capacitor.isNativePlatform();

/** Im Browser direkt gegen den Server, in der Android-App gegen den lokalen Offline-Speicher. */
export const store: Store = istApp ? new DeviceStore() : new HttpStore('');
export const geraeteStore = store instanceof DeviceStore ? store : null;

interface DruckerPlugin {
  drucken(opts: { titel: string }): Promise<void>;
}
/** Eigenes Mini-Plugin (android/…/DruckerPlugin.java): Android-Druckdialog → „Als PDF speichern“ */
export const Drucker = registerPlugin<DruckerPlugin>('Drucker');

interface TeilenEmpfangPlugin {
  holen(): Promise<{ text?: string }>;
  addListener(ereignis: 'geteilt', fn: (d: { text: string }) => void): Promise<{ remove: () => Promise<void> }>;
}
/** Eigenes Mini-Plugin (android/…/TeilenEmpfangPlugin.java): aus anderen Apps geteilter Text */
export const TeilenEmpfang = registerPlugin<TeilenEmpfangPlugin>('TeilenEmpfang');
