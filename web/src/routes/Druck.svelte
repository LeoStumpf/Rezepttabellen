<script lang="ts">
  import { tick } from 'svelte';
  import QRCode from 'qrcode';
  import { formatDauer } from '@mrt/shared';
  import { store, istApp, Drucker } from '../lib/app.ts';
  import { zurueck } from '../lib/router.svelte.ts';
  import type { RezeptVoll } from '../lib/storage/types.ts';
  import Bild from '../lib/components/Bild.svelte';
  import RezeptTabelle from '../lib/components/RezeptTabelle.svelte';
  import Markdown from '../lib/components/Markdown.svelte';

  let { id }: { id: string } = $props();

  // Im Server-PDF-Renderer (Playwright) keine Werkzeugleiste
  const renderer = navigator.webdriver;

  let daten = $state<RezeptVoll | null>(null);
  let fehler = $state('');
  let qrQuelle = $state('');
  let qrVideo = $state('');
  let skala = $state(1);
  let gekuerzt = $state(false);
  let zoom = $state(1);
  let bildGeladen = $state(false);
  let inhalt: HTMLDivElement | undefined = $state();
  let notizenEl: HTMLDivElement | undefined = $state();

  const r = $derived(daten?.rezept ?? null);
  const hauptbild = $derived(r && daten ? r.bilder.find((b) => daten!.medien.some((m) => m.name === b)) : undefined);

  store
    .laden(id)
    .then(async (d) => {
      daten = d;
      const opts = { type: 'svg' as const, margin: 0, errorCorrectionLevel: 'M' as const };
      if (d.rezept?.quelle?.url) qrQuelle = await QRCode.toString(d.rezept.quelle.url, opts);
      if (d.rezept?.video?.url) qrVideo = await QRCode.toString(d.rezept.video.url, opts);
    })
    .catch((e) => (fehler = (e as Error).message));

  // passt in Höhe und Breite (eine breite Tabelle mit vielen Schrittspalten wird ebenfalls verkleinert)
  const passt = () => !!inhalt && inhalt.scrollHeight <= inhalt.clientHeight + 1 && inhalt.scrollWidth <= inhalt.clientWidth + 1;

  /** Verkleinert schrittweise, bis alles auf eine A4-Seite passt; kürzt notfalls die Notizen. */
  async function einpassen() {
    skala = 1;
    gekuerzt = false;
    if (notizenEl) notizenEl.style.maxHeight = '';
    await tick();
    while (!passt() && skala > 0.62) {
      skala = Math.round((skala - 0.04) * 100) / 100;
      await tick();
    }
    if (!passt() && notizenEl && inhalt) {
      const ueber = inhalt.scrollHeight - inhalt.clientHeight;
      notizenEl.style.maxHeight = `${Math.max(0, notizenEl.offsetHeight - ueber - 24)}px`;
      gekuerzt = true;
      await tick();
    }
    (window as unknown as { __druckFertig: boolean }).__druckFertig = true;
  }

  $effect(() => {
    if (daten && bildGeladen && (!r?.quelle?.url || qrQuelle)) einpassen();
  });

  function zoomBerechnen() {
    zoom = Math.min(1, (window.innerWidth - 16) / 794);
  }
  zoomBerechnen();

  async function drucken() {
    if (istApp) await Drucker.drucken({ titel: r?.titel ?? 'Rezept' });
    else window.print();
  }
</script>

<svelte:window onresize={zoomBerechnen} />

{#if !renderer}
  <div class="leiste nicht-drucken">
    <button class="knopf" onclick={zurueck}>← Zurück</button>
    <span class="info">{#if skala < 1}Auf {Math.round(skala * 100)} % verkleinert{/if}{#if gekuerzt} · Notizen gekürzt{/if}</span>
    <div class="rechts">
      <button class="knopf primaer" onclick={drucken}>🖨 {istApp ? 'Drucken / als PDF' : 'Drucken'}</button>
      {#if !istApp}<a class="knopf" href="/api/rezepte/{encodeURIComponent(id)}/pdf">⤓ PDF</a>{/if}
    </div>
  </div>
{/if}

{#if fehler}
  <div class="seite-rand"><div class="fehlerbox">{fehler}</div></div>
{/if}

{#if daten && r}
  <div class="buehne" style:zoom={renderer ? 1 : zoom}>
    <div class="blatt" style:--s={skala}>
      <div class="inhalt" bind:this={inhalt}>
        <header class="kopf">
          <div class="kopf-text">
            <h1>{r.titel}</h1>
            {#if r.untertitel}<p class="unter">{r.untertitel}</p>{/if}
            <dl class="meta">
              {#if r.portionen}<div><dt>Portionen</dt><dd>{r.portionen}</dd></div>{/if}
              {#if r.zeit?.gesamt_min}<div><dt>Gesamtzeit</dt><dd>{formatDauer(r.zeit.gesamt_min)}</dd></div>{/if}
              {#if r.zeit?.aktiv_min}<div><dt>Aktiv</dt><dd>{formatDauer(r.zeit.aktiv_min)}</dd></div>{/if}
            </dl>
          </div>
          <div class="kopf-bild">
            <Bild rezept={daten} name={hauptbild} breite={1200} alt={r.titel} onload={() => (bildGeladen = true)} />
          </div>
        </header>

        <RezeptTabelle rezept={r} kompakt />

        {#if daten.notizen.trim()}
          <div class="notizen" class:gekuerzt bind:this={notizenEl}>
            <Markdown text={daten.notizen} />
          </div>
          {#if gekuerzt}<p class="kuerzung">… vollständige Notizen in der App</p>{/if}
        {/if}

        <footer class="fuss">
          <div class="quelle">
            {#if r.quelle?.name || r.quelle?.url}
              <strong>Quelle:</strong> {r.quelle.name ?? ''}<br />
              {#if r.quelle.url}<span class="url">{r.quelle.url}</span>{/if}
            {/if}
          </div>
          <div class="qrs">
            {#if qrQuelle}<figure><div class="qr">{@html qrQuelle}</div><figcaption>Quelle</figcaption></figure>{/if}
            {#if qrVideo}<figure><div class="qr">{@html qrVideo}</div><figcaption>Video</figcaption></figure>{/if}
          </div>
        </footer>
      </div>
    </div>
  </div>
{/if}

<style>
  :global {
    @page {
      size: A4;
      margin: 0;
    }
  }
  .leiste {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.6rem 16px;
    padding-top: calc(0.6rem + env(safe-area-inset-top));
    background: var(--bg);
    border-bottom: 1px solid var(--linie);
  }
  .leiste .info {
    color: var(--text-leise);
    font-size: 0.85rem;
    flex: 1;
  }
  .leiste .rechts {
    display: flex;
    gap: 0.5rem;
  }
  .buehne {
    padding: 8px 0 24px;
    display: flex;
    justify-content: center;
  }
  .blatt {
    /* immer helles Papier, unabhängig vom Dunkelmodus */
    --text: #1f1915;
    --text-leise: #6b5d53;
    --linie: #cbbfb1;
    --zutat-bg: #f5eee4;
    --schritt-bg: #ffffff;
    --flaeche: #ffffff;
    --akzent: #b4532a;
    --akzent-text: #ffffff;
    width: 210mm;
    height: 297mm;
    padding: 11mm 12mm 9mm;
    background: #fff;
    color: var(--text);
    box-shadow: 0 2px 20px rgb(0 0 0 / 0.25);
    overflow: hidden;
    flex: none;
  }
  .inhalt {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(4mm * var(--s));
    overflow: hidden;
  }
  .inhalt > :global(*) {
    flex-shrink: 0;
  }
  .kopf {
    display: grid;
    grid-template-columns: 1fr 44%;
    gap: 6mm;
    align-items: stretch;
  }
  .kopf-bild {
    height: calc(62mm * var(--s));
    border-radius: 3mm;
    overflow: hidden;
  }
  h1 {
    font-family: var(--serif);
    font-size: calc(24pt * var(--s));
    line-height: 1.1;
    margin: 0;
  }
  .unter {
    margin: 2mm 0 0;
    color: var(--text-leise);
    font-size: calc(11pt * var(--s));
  }
  .meta {
    display: flex;
    gap: 6mm;
    margin: calc(4mm * var(--s)) 0 0;
  }
  .meta div {
    border-left: 2px solid var(--akzent);
    padding-left: 2mm;
  }
  dt {
    font-size: calc(7pt * var(--s));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-leise);
  }
  dd {
    margin: 0;
    font-size: calc(11pt * var(--s));
    font-weight: 600;
  }
  .notizen {
    font-size: calc(8pt * var(--s));
    line-height: 1.35;
    column-count: 2;
    column-gap: 6mm;
    overflow: hidden;
  }
  .notizen.gekuerzt {
    column-fill: auto;
  }
  .notizen :global(h2) {
    font-size: 1.25em;
    margin: 0 0 0.3em;
    break-after: avoid;
  }
  .notizen :global(ul),
  .notizen :global(ol) {
    padding-left: 1.2em;
    margin: 0 0 0.6em;
  }
  .notizen :global(p) {
    margin: 0 0 0.5em;
  }
  .notizen :global(li) {
    margin: 0.1em 0;
  }
  .kuerzung {
    margin: -2mm 0 0;
    font-size: 7pt;
    color: var(--text-leise);
    font-style: italic;
  }
  .fuss {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 6mm;
    border-top: 1px solid var(--linie);
    padding-top: 2.5mm;
    font-size: 7.5pt;
    color: var(--text-leise);
  }
  .url {
    word-break: break-all;
  }
  .qrs {
    display: flex;
    gap: 4mm;
  }
  figure {
    margin: 0;
    text-align: center;
  }
  .qr {
    width: 17mm;
    height: 17mm;
  }
  .qr :global(svg) {
    width: 100%;
    height: 100%;
  }
  figcaption {
    font-size: 6.5pt;
  }
  @media print {
    .buehne {
      padding: 0;
      zoom: 1 !important;
    }
    .blatt {
      box-shadow: none;
    }
  }
</style>
