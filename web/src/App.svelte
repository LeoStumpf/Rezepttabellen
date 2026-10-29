<script lang="ts">
  import { router } from './lib/router.svelte.ts';
  import { istApp } from './lib/app.ts';
  import Uebersicht from './routes/Uebersicht.svelte';
  import RezeptAnsicht from './routes/RezeptAnsicht.svelte';
  import Varianten from './routes/Varianten.svelte';
  import Druck from './routes/Druck.svelte';
  import Editor from './routes/Editor.svelte';
  import Einstellungen from './routes/Einstellungen.svelte';
  import Vorrat from './routes/Vorrat.svelte';
  import Fotos from './routes/Fotos.svelte';
  import Einkauf from './routes/Einkauf.svelte';
  import { einkauf } from './lib/sammlung.svelte.ts';
  import { meldung } from './lib/meldung.svelte.ts';
  import TimerLeiste from './lib/components/TimerLeiste.svelte';
  import { warteschlange } from './lib/foto-warteschlange.svelte.ts';
  import { autoSync } from './lib/auto-sync.svelte.ts';
  import { appVersion, updateAusgeblendet, updateAusblenden } from './lib/app-update.svelte.ts';

  let bannerZu = $state(false);

  const r = $derived(router.route);
  const offenEinkauf = $derived(einkauf.eintraege.filter((p) => !p.abgehakt).length);
</script>

{#if r.seite === 'druck'}
  {#key r.id}<Druck id={r.id} />{/key}
{:else}
  <header class="kopf nicht-drucken">
    <div class="seite-rand innen">
      <a href="#/" class="logo">
        <img src="./favicon.svg" alt="" width="28" height="28" />
        <span>Rezepttabellen</span>
      </a>
      <nav>
        <a class="knopf" href="#/einkauf" class:aktiv={r.seite === 'einkauf'} aria-label="Einkaufsliste">🛒{#if offenEinkauf}<span class="zahl">{offenEinkauf}</span>{/if}</a>
        <a class="knopf" href="#/vorrat" class:aktiv={r.seite === 'vorrat'} aria-label="Vorrat">🧂<span class="label"> Vorrat</span></a>
        <a class="knopf" href="#/fotos" class:aktiv={r.seite === 'fotos'} aria-label="Rezept abfotografieren">📷{#if warteschlange.wartend}<span class="zahl">{warteschlange.wartend}</span>{/if}</a>
        <a class="knopf" href="#/neu" aria-label="Neues Rezept">＋<span class="label"> Neu</span></a>
        <a class="knopf" href="#/einstellungen" aria-label="Einstellungen" title={autoSync.fehler ? `Letzter Sync fehlgeschlagen: ${autoSync.fehler}` : undefined}>{#if istApp}<span class:dreht={autoSync.laeuft}>⇅</span><span class="label"> Sync</span>{#if autoSync.fehler}<span class="punkt" aria-label="Sync fehlgeschlagen"></span>{/if}{:else}⚙{/if}</a>
      </nav>
    </div>
  </header>
  {#if appVersion.update && !bannerZu && !updateAusgeblendet()}
    <div class="update nicht-drucken">
      <div class="seite-rand update-innen">
        <span>Neue App-Version {appVersion.update.name}</span>
        <!-- fremder Host: Capacitor öffnet den Link im System-Browser, der lädt das APK und Android fragt nach dem Installieren -->
        <a class="knopf primaer" href={appVersion.update.url}>Installieren</a>
        <button class="zu" onclick={() => { updateAusblenden(); bannerZu = true; }} aria-label="Später">✕</button>
      </div>
    </div>
  {/if}
  <main>
    {#if r.seite === 'rezept'}
      {#key r.id}<RezeptAnsicht id={r.id} />{/key}
    {:else if r.seite === 'varianten'}
      {#key r.gruppe}<Varianten gruppe={r.gruppe} />{/key}
    {:else if r.seite === 'bearbeiten'}
      {#key r.id}<Editor id={r.id} />{/key}
    {:else if r.seite === 'neu'}
      <Editor />
    {:else if r.seite === 'vorrat'}
      <Vorrat />
    {:else if r.seite === 'einkauf'}
      <Einkauf />
    {:else if r.seite === 'fotos'}
      <Fotos />
    {:else if r.seite === 'einstellungen'}
      <Einstellungen />
    {:else}
      <Uebersicht />
    {/if}
  </main>
  <TimerLeiste />
{/if}
{#if meldung.text}
  <div class="meldung nicht-drucken" role="status">
    <span>{meldung.text}</span>
    {#if meldung.link}<a href={meldung.link} onclick={() => (meldung.text = '')}>{meldung.linkText}</a>{/if}
  </div>
{/if}

<style>
  .kopf {
    position: sticky;
    top: 0;
    z-index: 10;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--linie);
    padding-top: env(safe-area-inset-top);
  }
  .innen {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    font-family: var(--serif);
    font-size: 1.25rem;
    font-weight: 700;
  }
  nav {
    display: flex;
    gap: 0.5rem;
  }
  .update {
    background: color-mix(in srgb, var(--akzent) 12%, var(--bg));
    border-bottom: 1px solid var(--linie);
  }
  .update-innen {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 48px;
    font-size: 0.95rem;
  }
  .update-innen span {
    flex: 1;
  }
  .update .zu {
    border: 0;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .zahl {
    margin-left: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--warn);
  }
  .dreht {
    display: inline-block;
    animation: drehen 1.2s linear infinite;
  }
  @keyframes drehen {
    to {
      transform: rotate(360deg);
    }
  }
  .punkt {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: var(--warn);
  }
  .meldung {
    position: fixed;
    z-index: 60;
    left: 50%;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100vw - 32px);
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 0.7rem 1rem;
    border-radius: 12px;
    background: var(--text);
    color: var(--bg);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
    font-size: 0.95rem;
  }
  .meldung a {
    color: inherit;
    font-weight: 700;
  }
  nav .aktiv {
    border-color: var(--akzent);
    color: var(--akzent);
  }
  @media (max-width: 420px) {
    .logo span {
      display: none;
    }
  }
  /* schmale Handys bzw. große Systemschrift: nur Symbole, sonst wird die Seite breiter als der Bildschirm */
  @media (max-width: 480px) {
    nav {
      gap: 0.35rem;
    }
    nav .label {
      display: none;
    }
    nav .knopf {
      padding: 0.5em 0.75em;
    }
  }
</style>
