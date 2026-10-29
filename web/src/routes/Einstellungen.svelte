<script lang="ts">
  import { istApp, geraeteStore } from '../lib/app.ts';
  import { einstellungen } from '../lib/einstellungen.ts';
  import type { SyncErgebnis } from '../lib/storage/device-store.ts';
  import { hochladen } from '../lib/foto-warteschlange.svelte.ts';
  import { vorratLaden } from '../lib/vorrat.svelte.ts';
  import { sammlungenLaden } from '../lib/sammlung.svelte.ts';
  import { appVersion, updatePruefen } from '../lib/app-update.svelte.ts';

  void updatePruefen();

  let serverUrl = $state(einstellungen.serverUrl);
  let passwort = $state(einstellungen.passwort);
  let laeuft = $state(false);
  let ergebnis = $state<SyncErgebnis | null>(null);
  let fehler = $state('');
  let ausstehend = $state(geraeteStore?.ausstehend ?? 0);
  let gespeichert = $state(false);

  function speichern() {
    einstellungen.serverUrl = serverUrl;
    einstellungen.passwort = passwort;
    serverUrl = einstellungen.serverUrl;
    gespeichert = true;
    setTimeout(() => (gespeichert = false), 1500);
  }

  async function sync() {
    speichern();
    if (!geraeteStore || !serverUrl) return;
    laeuft = true;
    fehler = '';
    ergebnis = null;
    try {
      ergebnis = await geraeteStore.synchronisieren(einstellungen.serverUrl, passwort);
      void hochladen();
      void vorratLaden();
      void sammlungenLaden();
      window.dispatchEvent(new Event('sync-fertig'));
    } catch (e) {
      fehler = `Server nicht erreichbar oder Fehler: ${(e as Error).message}`;
    } finally {
      laeuft = false;
      ausstehend = geraeteStore.ausstehend;
    }
  }
</script>

<div class="seite-rand inhalt">
  {#if istApp}
    <h1>Synchronisieren</h1>
    <p class="leise">Alle Rezepte liegen offline auf diesem Handy. Im Heimnetz gleichst du sie mit dem Server ab, und zwar in beide Richtungen.</p>
    <section class="karte">
      <label>Server-Adresse <input type="url" bind:value={serverUrl} placeholder="http://192.168.1.10:8080" /></label>
      <label>Passwort (falls am Server gesetzt) <input type="password" bind:value={passwort} /></label>
      <div class="zeile">
        <button class="knopf primaer" onclick={sync} disabled={laeuft || !serverUrl}>{laeuft ? 'Synchronisiere …' : '⇅ Jetzt synchronisieren'}</button>
        <button class="knopf" onclick={speichern}>Speichern</button>
        {#if gespeichert}<span class="ok">✓ gespeichert</span>{/if}
      </div>
      <p class="leise">Lokale Änderungen, die noch nicht übertragen sind: <strong>{ausstehend}</strong> · Letzter Serverstand: Rev. {geraeteStore?.letzteServerRev ?? 0}</p>
      {#if ergebnis}
        <p class="ok">✓ {ergebnis.geladen} empfangen, {ergebnis.hochgeladen} gesendet, {ergebnis.vorrat} Vorrats- und {ergebnis.sammlungen} Listenänderungen{#if ergebnis.konflikte}, <span class="warn">{ergebnis.konflikte} Konflikt(e): als „(Konflikt Handy)“ gespeichert</span>{/if}</p>
        {#if ergebnis.fehler.length}<div class="fehlerbox"><ul>{#each ergebnis.fehler as f (f)}<li>{f}</li>{/each}</ul></div>{/if}
      {/if}
      {#if fehler}<div class="fehlerbox">{fehler}</div>{/if}
    </section>
    <section class="karte">
      <h2>App</h2>
      <p>Version <strong>{appVersion.name || '…'}</strong>{#if appVersion.code} ({appVersion.code}){/if}</p>
      {#if appVersion.update}
        <div class="zeile">
          <a class="knopf primaer" href={appVersion.update.url}>⤓ Version {appVersion.update.name} installieren</a>
        </div>
        <p class="leise">Der Browser lädt die Datei, danach fragt Android, ob die App aktualisiert werden soll. Deine Rezepte bleiben erhalten.</p>
      {:else if appVersion.geprueft}
        <p class="leise">Aktuell, der Server hat keine neuere Version.</p>
      {/if}
    </section>
    <p class="leise">Die Dateien liegen lesbar unter <code>Android/data/io.github.leostumpf.rezepttabellen/files/MyRecipetables/rezepte/</code> und sind z. B. per USB erreichbar.</p>
  {:else}
    <h1>Einstellungen</h1>
    <section class="karte">
      <h2>Sicherung</h2>
      <p>Alle Rezepte liegen als lesbare Dateien im Server-Ordner <code>data/rezepte/</code> (je Rezept ein Ordner mit <code>rezept.yaml</code>, <code>notizen.md</code> und Bildern).</p>
      <p class="leise">Der Vorrat liegt in <code>data/vorrat.sqlite</code>, eine lesbare Kopie in <code>data/vorrat-backup.json</code>. Im ZIP-Export ist er als <code>vorrat.json</code> enthalten.</p>
      <a class="knopf" href="/api/export.zip">⤓ Alle Rezepte + Vorrat als ZIP herunterladen</a>
    </section>
    <section class="karte">
      <h2>Schreibschutz</h2>
      <p class="leise">Wenn am Server <code>APP_PASSWORT</code> gesetzt ist, wird es zum Speichern und Löschen benötigt.</p>
      <label>Passwort <input type="password" bind:value={passwort} /></label>
      <div class="zeile"><button class="knopf" onclick={speichern}>Speichern</button>{#if gespeichert}<span class="ok">✓ gespeichert</span>{/if}</div>
    </section>
  {/if}
</div>

<style>
  .inhalt {
    padding-bottom: 3rem;
    max-width: 700px;
  }
  h1 {
    font-family: var(--serif);
    margin: 1.2rem 0 0.4rem;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.15rem;
    margin: 0 0 0.5rem;
  }
  .karte {
    background: var(--flaeche);
    border-radius: 12px;
    box-shadow: var(--schatten);
    padding: 1rem;
    margin: 1rem 0;
    display: grid;
    gap: 0.8rem;
  }
  .leise {
    color: var(--text-leise);
    font-size: 0.9rem;
  }
  .zeile {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .ok {
    color: var(--ok);
  }
  .warn {
    color: var(--warn);
  }
  code {
    word-break: break-all;
  }
</style>
