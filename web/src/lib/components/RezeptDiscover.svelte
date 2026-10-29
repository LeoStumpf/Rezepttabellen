<script lang="ts" module>
  import type { UebersichtEintrag } from '../uebersicht.ts';

  // Modulweit, damit „Zurück“ aus einem Rezept wieder am selben Bild landet
  const gemerkt = { schluessel: '', runden: [] as UebersichtEintrag[][], index: 0 };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { ernaehrungVon, formatDauer } from '@mrt/shared';
  import { ERNAEHRUNG_ICON, eintragHref, zutatenWort } from '../uebersicht.ts';
  import Bild from './Bild.svelte';

  /** Vollbild-Feed: ein Rezept pro Bildschirm, hochwischen, endlos (danach gemischt von vorn). */
  let { eintraege }: { eintraege: UebersichtEintrag[] } = $props();

  let feed = $state<HTMLDivElement>();
  let runden = $state<UebersichtEintrag[][]>([]);
  const alle = $derived(runden.flatMap((r, ri) => r.map((e, i) => ({ e, schluessel: `${ri}-${i}` }))));

  function gemischt(liste: UebersichtEintrag[], vorher?: UebersichtEintrag): UebersichtEintrag[] {
    const neu = [...liste];
    for (let i = neu.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neu[i], neu[j]] = [neu[j], neu[i]];
    }
    // nicht zweimal dasselbe Rezept hintereinander über die Rundengrenze
    if (neu.length > 1 && vorher && neu[0].r.id === vorher.r.id) [neu[0], neu[1]] = [neu[1], neu[0]];
    return neu;
  }

  function weitereRunde() {
    if (!eintraege.length) return;
    const letzte = runden.at(-1)?.at(-1);
    runden = [...runden, gemischt(eintraege, letzte)];
  }

  // Neue Liste (Filter geändert) ⇒ von vorn; gleiche Liste ⇒ gemerkte Runden und Position übernehmen
  $effect(() => {
    const schluessel = eintraege.map((e) => e.r.id).join(',');
    untrack(() => {
      if (schluessel === gemerkt.schluessel && gemerkt.runden.length) {
        runden = gemerkt.runden;
        requestAnimationFrame(() => feed?.scrollTo({ top: gemerkt.index * feed.clientHeight, behavior: 'instant' }));
      } else {
        gemerkt.schluessel = schluessel;
        gemerkt.index = 0;
        runden = eintraege.length ? [eintraege] : [];
        feed?.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
  });
  $effect(() => {
    gemerkt.runden = runden;
  });

  function gescrollt() {
    if (!feed || !feed.clientHeight) return;
    const index = Math.round(feed.scrollTop / feed.clientHeight);
    gemerkt.index = index;
    if (index >= alle.length - 3) weitereRunde();
  }
</script>

<div class="feed" bind:this={feed} onscroll={gescrollt}>
  {#each alle as { e, schluessel }, i (schluessel)}
    {@const form = ernaehrungVon(e.r.tags)}
    {@const fehlt = e.k ? e.k.fehlend : e.zuKaufen}
    <a class="seite" href={eintragHref(e.r, e.varianten)}>
      <div class="bild"><Bild rezept={e.r} name={e.r.bild} breite={1200} alt={e.r.titel} /></div>
      <div class="text">
        <h2>{#if e.favorit}<span class="stern" aria-label="Favorit">★</span>{' '}{/if}{#if e.varianten && e.r.variante}{e.r.variante.gruppe}{:else}{e.r.titel}{/if}</h2>
        {#if e.varianten && e.varianten > 1}<p class="unter">⧉ {e.varianten} Varianten zum Vergleichen</p>
        {:else if e.r.untertitel}<p class="unter">{e.r.untertitel}</p>{/if}
        <p class="meta">
          {#if form}<span>{ERNAEHRUNG_ICON[form]} {form}</span>{/if}
          {#if e.r.gesamtMin}<span>⏱ {formatDauer(e.r.gesamtMin)}</span>{/if}
          {#if e.k}<span>✓ {e.k.treffer.map((t) => t.begriff).join(', ')}</span>{/if}
          {#if fehlt}
            {#if fehlt.length === 0}<span>✓ alles da</span>{:else}<span>🛒 noch {fehlt.length} {zutatenWort(fehlt.length)}</span>{/if}
          {/if}
        </p>
        {#if i === 0}<p class="hinweis" aria-hidden="true">↑ wischen für mehr</p>{/if}
      </div>
    </a>
  {/each}
</div>

<style>
  .feed {
    height: 100%;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    overscroll-behavior: contain;
    scrollbar-width: none;
    border-radius: 16px;
    background: #000;
  }
  .feed::-webkit-scrollbar {
    display: none;
  }
  .seite {
    position: relative;
    display: block;
    height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    overflow: hidden;
    color: #fff;
    text-decoration: none;
  }
  .bild {
    position: absolute;
    inset: 0;
  }
  .text {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 4rem 1.2rem 1.4rem;
    background: linear-gradient(to top, rgb(0 0 0 / 0.85), rgb(0 0 0 / 0.55) 55%, transparent);
    display: grid;
    gap: 0.4rem;
  }
  h2 {
    margin: 0;
    font-family: var(--serif);
    font-size: clamp(1.6rem, 6vw, 2.4rem);
    line-height: 1.1;
    text-shadow: 0 1px 8px rgb(0 0 0 / 0.5);
  }
  .unter {
    margin: 0;
    font-size: 0.95rem;
    opacity: 0.9;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta {
    margin: 0.2rem 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.85rem;
  }
  .meta span {
    padding: 0.2em 0.65em;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.18);
    backdrop-filter: blur(6px);
  }
  .stern {
    color: #e0a400;
  }
  .hinweis {
    margin: 0.4rem 0 0;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.7;
  }
</style>
