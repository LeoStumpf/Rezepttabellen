<script lang="ts">
  import { ernaehrungVon, formatDauer } from '@mrt/shared';
  import { ERNAEHRUNG_ICON, eintragHref, zutatenWort, type UebersichtEintrag } from '../uebersicht.ts';
  import { vorWann } from '../verlauf.ts';
  import Bild from './Bild.svelte';

  /** Liste mit mehr Infos: Bild links, rechts Titel, Beschreibung, Eckdaten, Einkaufsstand und die wichtigsten Zutaten. */
  let { eintraege }: { eintraege: UebersichtEintrag[] } = $props();

  const vorschau = (namen: string[]) => namen.slice(0, 6).join(', ') + (namen.length > 6 ? ' …' : '');
</script>

<ul class="liste">
  {#each eintraege as { r, k, zutaten, zuKaufen, favorit, zuletzt, varianten } (r.id)}
    {@const form = ernaehrungVon(r.tags)}
    {@const fehlt = k ? k.fehlend : zuKaufen}
    <li>
      <a class="zeile" href={eintragHref(r, varianten)}>
        <div class="bild"><Bild rezept={r} name={r.bild} breite={300} alt={r.titel} /></div>
        <div class="text">
          <h2>{#if favorit}<span class="stern" aria-label="Favorit">★</span>{' '}{/if}{#if varianten && r.variante}{r.variante.gruppe}{:else}{r.titel}{/if}</h2>
          {#if varianten && varianten > 1}<p class="unter varianten">⧉ {varianten} Varianten zum Vergleichen</p>
          {:else if r.untertitel}<p class="unter">{r.untertitel}</p>{/if}
          <p class="meta">
            {#if form}<span>{ERNAEHRUNG_ICON[form]} {form}</span>{/if}
            {#if r.gesamtMin}<span>⏱ {formatDauer(r.gesamtMin)}</span>{/if}
            {#if zuletzt}<span>✓ gekocht {vorWann(zuletzt)}</span>{/if}
            {#if zutaten.length}<span>🥄 {zutaten.length} {zutatenWort(zutaten.length)}</span>{/if}
            {#if r.fehler}<span class="warn">⚠ Fehler in rezept.yaml</span>{/if}
          </p>
          {#if k}
            <p class="meta">
              <span class="status-da">✓ {k.treffer.map((t) => t.begriff).join(', ')}</span>
              {#if k.fehlt.length}<span>✗ {k.fehlt.join(', ')}</span>{/if}
            </p>
          {/if}
          {#if fehlt}
            <p class="meta">
              {#if fehlt.length === 0}<span class="status-da">✓ laut Vorrat alles da</span>
              {:else}<span class="status-kaufen">🛒 noch {fehlt.length} {zutatenWort(fehlt.length)} kaufen:</span> <span class="fehlt">{vorschau(fehlt)}</span>{/if}
            </p>
          {:else if zutaten.length}
            <p class="zutaten">{vorschau(zutaten)}</p>
          {/if}
        </div>
      </a>
    </li>
  {/each}
</ul>

<style>
  .liste {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 2rem;
    display: grid;
    gap: 0.6rem;
  }
  .zeile {
    display: flex;
    gap: 0.8rem;
    padding: 0.6rem;
    text-decoration: none;
    background: var(--flaeche);
    border-radius: 12px;
    box-shadow: var(--schatten);
  }
  .bild {
    flex: none;
    width: 96px;
    height: 96px;
    border-radius: 8px;
    overflow: hidden;
  }
  .bild :global(.platzhalter) {
    min-height: 0;
    font-size: 0.7rem;
  }
  .text {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 0.25rem;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.05rem;
    margin: 0;
    line-height: 1.25;
  }
  .unter {
    margin: 0;
    color: var(--text-leise);
    font-size: 0.85rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-leise);
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.8rem;
  }
  .zutaten,
  .fehlt {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-leise);
    overflow-wrap: anywhere;
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
