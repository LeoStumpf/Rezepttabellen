import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { zurueckTasteEinrichten } from './lib/zurueck.ts';
import { autoSyncEinrichten } from './lib/auto-sync.svelte.ts';
import { sammlungenLaden } from './lib/sammlung.svelte.ts';
import { teilenEmpfangEinrichten } from './lib/import.svelte.ts';

zurueckTasteEinrichten();
autoSyncEinrichten();
void sammlungenLaden();
teilenEmpfangEinrichten();
mount(App, { target: document.getElementById('app')! });
