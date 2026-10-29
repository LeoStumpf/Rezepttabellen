<script lang="ts">
  import { berechneLayout, formatMenge, skaliereMenge, type Rezept, type Zutat } from '@mrt/shared';
  import { vorratMarkierung, VORRAT_ICON } from '../vorrat.svelte.ts';
  import SchrittText from './SchrittText.svelte';

  /** Handy-Ansicht: jeder Schritt als Karte, darüber genau die Zutaten, die in ihn eingehen. */
  let {
    rezept,
    einkauf = false,
    faktor = 1,
    abgehakt,
    onzutat,
    onmenge,
    onhaken,
    timerTitel,
  }: {
    rezept: Pick<Rezept, 'zutaten' | 'schritte'>;
    einkauf?: boolean;
    faktor?: number;
    /** Kochmodus: erledigte Schritte (ohne = kein Abhaken) */
    abgehakt?: Set<string>;
    onzutat?: (z: Zutat) => void;
    onmenge?: (z: Zutat) => void;
    onhaken?: (schrittId: string) => void;
    timerTitel?: string;
  } = $props();

  const karten = $derived.by(() => {
    const zutaten = new Map(rezept.zutaten.map((z) => [z.id, z]));
    const { reihenfolge } = berechneLayout(rezept);
    const nummer = new Map(reihenfolge.map((e) => [e.schritt.id, e.nummer]));
    const karten = reihenfolge.map(({ schritt, nummer: nr }) => ({
      schritt,
      nr,
      zutaten: schritt.nimmt.map((n) => zutaten.get(n)).filter((z): z is Zutat => !!z),
      aus: schritt.nimmt.map((n) => nummer.get(n)).filter((n): n is number => n != null),
    }));
    // Zutaten, die in keinen Schritt eingehen (z. B. „zum Servieren“), stehen am Ende
    const genutzt = new Set(rezept.schritte.flatMap((s) => s.nimmt));
    const rest = rezept.zutaten.filter((z) => !genutzt.has(z.id));
    return { karten, rest };
  });

  const menge = (z: Zutat) => formatMenge(skaliereMenge(z.menge, z.einheit, faktor), z.einheit);
  const kannUmrechnen = (z: Zutat) => !!onmenge && z.menge != null && z.einheit !== 'nach Geschmack';
</script>

{#snippet zutatZeile(z: Zutat)}
  {@const m = vorratMarkierung(z, einkauf, true)}
  <li class={einkauf && m ? `e-${m}` : ''}>
    {#if kannUmrechnen(z)}
      <button class="m" class:skaliert={faktor !== 1} onclick={() => onmenge?.(z)} title="Auf diese Zutat umrechnen">{menge(z)}</button>
    {:else}
      <span class="m" class:skaliert={faktor !== 1}>{menge(z)}</span>
    {/if}
    <button class="name" onclick={() => onzutat?.(z)} disabled={!onzutat} title="Vorrat bearbeiten">
      {#if m}<span class="icon status-{m}">{VORRAT_ICON[m]}</span>{/if}{z.name}{#if z.hinweis}{' '}<span class="h">({z.hinweis})</span>{/if}
    </button>
  </li>
{/snippet}

<ol class="karten">
  {#each karten.karten as k (k.schritt.id)}
    {@const fertig = abgehakt?.has(k.schritt.id) ?? false}
    <li class="karte" class:fertig>
      {#if k.zutaten.length}
        <ul class="zutaten">
          {#each k.zutaten as z (z.id)}{@render zutatZeile(z)}{/each}
        </ul>
      {/if}
      <div class="schritt">
        {#if abgehakt}
          <button class="nr haken" onclick={() => onhaken?.(k.schritt.id)} aria-pressed={fertig} aria-label="Schritt {k.nr} erledigt">{fertig ? '✓' : k.nr}</button>
        {:else}
          <span class="nr">{k.nr}</span>
        {/if}
        <p>
          {#if k.aus.length}<span class="aus">mit {k.aus.length === 1 ? 'Schritt' : 'Schritten'} {k.aus.join(', ')}:</span>{' '}{/if}{#if timerTitel}<SchrittText text={k.schritt.text} titel="{timerTitel} · Schritt {k.nr}" />{:else}{k.schritt.text}{/if}
        </p>
      </div>
    </li>
  {/each}
  {#if karten.rest.length}
    <li class="karte">
      <ul class="zutaten">
        {#each karten.rest as z (z.id)}{@render zutatZeile(z)}{/each}
      </ul>
    </li>
  {/if}
</ol>

<style>
  .karten {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.7rem;
  }
  .karte {
    background: var(--schritt-bg);
    border: 1px solid var(--linie);
    border-radius: 12px;
    overflow: hidden;
    transition: opacity 0.2s;
  }
  .karte.fertig {
    opacity: 0.45;
  }
  .zutaten {
    list-style: none;
    margin: 0;
    padding: 0.45rem 0.8rem;
    background: var(--zutat-bg);
    border-bottom: 1px solid var(--linie);
  }
  .karte:has(> .zutaten:only-child) .zutaten {
    border-bottom: 0;
  }
  .zutaten li {
    display: flex;
    gap: 0.6em;
    align-items: baseline;
    padding: 0.2rem 0;
    line-height: 1.35;
  }
  .zutaten li.e-kaufen {
    font-weight: 600;
  }
  .zutaten li.e-da {
    color: var(--text-leise);
  }
  .m {
    flex: none;
    min-width: 5.2em;
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  button.m {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 600;
    color: inherit;
    cursor: pointer;
    text-decoration: underline dotted color-mix(in srgb, currentColor 40%, transparent);
    text-underline-offset: 0.2em;
  }
  .skaliert {
    color: var(--akzent);
  }
  .name {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .name:disabled {
    cursor: default;
  }
  .icon {
    display: inline-block;
    width: 1.2em;
  }
  .h {
    color: var(--text-leise);
    font-size: 0.9em;
  }
  .schritt {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    padding: 0.65rem 0.8rem;
  }
  .schritt p {
    margin: 0;
    line-height: 1.45;
  }
  .aus {
    color: var(--text-leise);
    font-size: 0.9em;
  }
  .nr {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.8em;
    height: 1.8em;
    border-radius: 999px;
    background: var(--akzent);
    color: var(--akzent-text);
    font-size: 0.85rem;
    font-weight: 700;
  }
  .haken {
    border: 2px solid var(--akzent);
    cursor: pointer;
    width: 2.2em;
    height: 2.2em;
  }
  .fertig .haken {
    background: var(--da);
    border-color: var(--da);
  }
</style>
