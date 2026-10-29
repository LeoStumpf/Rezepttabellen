<script lang="ts">
  import { ernaehrungVon, formatDauer } from '@mrt/shared';
  import { ERNAEHRUNG_ICON, eintragHref, zutatenWort, type UebersichtEintrag } from '../uebersicht.ts';
  import { vorWann } from '../verlauf.ts';
  import Bild from './Bild.svelte';

  let { eintraege }: { eintraege: UebersichtEintrag[] } = $props();
</script>

<ul class="raster">
  {#each eintraege as { r, k, favorit, zuletzt, varianten } (r.id)}
    {@const form = ernaehrungVon(r.tags)}
    <li>
      <a class="karte" href={eintragHref(r, varianten)}>
        <div class="bild"><Bild rezept={r} name={r.bild} breite={600} alt={r.titel} /></div>
        <div class="text">
          <h2>{#if favorit}<span class="stern" aria-label="Favorit">★</span>{' '}{/if}{#if varianten && r.variante}{r.variante.gruppe}{:else}{r.titel}{/if}</h2>
          {#if varianten && varianten > 1}<p class="unter varianten">⧉ {varianten} Varianten zum Vergleichen</p>
          {:else if r.untertitel}<p class="unter">{r.untertitel}</p>{/if}
          {#if k}
            <p class="kuehl">
              <span class="status-da">✓ {k.treffer.map((t) => t.begriff).join(', ')}</span>
              {#if k.fehlt.length}<span class="leise">✗ {k.fehlt.join(', ')}</span>{/if}
            </p>
            {#if k.fehlend}
              <p class="kuehl">
                {#if k.fehlend.length === 0}<span class="status-da">alles andere ist laut Vorrat da</span>
                {:else}<span class="status-kaufen" title={k.fehlend.join(', ')}>🛒 noch {k.fehlend.length} {zutatenWort(k.fehlend.length)} kaufen</span>{/if}
              </p>
            {/if}
          {/if}
          <p class="meta">
            {#if form}<span>{ERNAEHRUNG_ICON[form]} {form}</span>{/if}
            {#if r.gesamtMin}<span>⏱ {formatDauer(r.gesamtMin)}</span>{/if}
            {#if zuletzt}<span>✓ {vorWann(zuletzt)}</span>{/if}
            {#if r.fehler}<span class="warn">⚠ Fehler in rezept.yaml</span>{/if}
          </p>
        </div>
      </a>
    </li>
  {/each}
</ul>

<style>
  .raster {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 2rem;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
  .karte {
    display: block;
    text-decoration: none;
    background: var(--flaeche);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: var(--schatten);
    height: 100%;
    transition: transform 0.15s;
  }
  .karte:hover {
    transform: translateY(-2px);
  }
  .bild {
    aspect-ratio: 4 / 3;
    overflow: hidden;
  }
  .text {
    padding: 0.75rem 1rem 1rem;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.15rem;
    margin: 0;
    line-height: 1.25;
  }
  .unter {
    margin: 0.3rem 0 0;
    color: var(--text-leise);
    font-size: 0.9rem;
  }
  .kuehl {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .leise {
    color: var(--text-leise);
  }
  .meta {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--text-leise);
    display: flex;
    gap: 0.8rem;
  }
  .stern {
    color: #e0a400;
  }
  .warn {
    color: var(--warn);
  }
  .varianten {
    color: var(--akzent);
    font-weight: 600;
  }
</style>
