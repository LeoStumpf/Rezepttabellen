<script lang="ts">
  import { berechneLayout, formatMenge, skaliereMenge, type Rezept, type Zutat } from '@mrt/shared';
  import { vorratMarkierung, VORRAT_ICON } from '../vorrat.svelte.ts';
  import SchrittText from './SchrittText.svelte';

  let {
    rezept,
    kompakt = false,
    einkauf = false,
    vorratZeigen = false,
    faktor = 1,
    onzutat,
    onmenge,
    timerTitel,
    zoom = 1,
  }: {
    rezept: Pick<Rezept, 'zutaten' | 'schritte'>;
    kompakt?: boolean;
    /** Einkaufsansicht: alle Zutaten nach Vorrat einfärben, auch was fehlt */
    einkauf?: boolean;
    /** dezent markieren, was laut Vorrat da oder knapp ist */
    vorratZeigen?: boolean;
    /** Umrechnungsfaktor für die Mengen (Portionen bzw. vorhandene Menge) */
    faktor?: number;
    onzutat?: (z: Zutat) => void;
    onmenge?: (z: Zutat) => void;
    /** Zeitangaben in Schritten als Timer-Knöpfe (Titel des Rezepts für die Anzeige) */
    timerTitel?: string;
    /** CSS-Zoom (von TabellenZoom) */
    zoom?: number;
  } = $props();

  const markierung = (z: Zutat) => vorratMarkierung(z, einkauf, vorratZeigen);
  const menge = (z: Zutat) => formatMenge(skaliereMenge(z.menge, z.einheit, faktor), z.einheit);
  const layout = $derived(berechneLayout(rezept));

  // Spaltenbreiten verteilt der Browser (table-layout: auto): keine Spalte wird schmaler als ihr
  // längstes Wort, Text läuft also nie in die Nachbarzelle. Der Druck verkleinert notfalls die Schrift.
</script>

{#if rezept.zutaten.length || rezept.schritte.length}
  <table class="rt" class:kompakt style:--spalten={layout.schrittSpalten} style:zoom={zoom !== 1 ? zoom : undefined}>
    <tbody>
      {#each layout.zeilen as zeile, i (i)}
        <tr>
          {#each zeile as zelle, j (j)}
            {#if zelle.art === 'menge'}
              {@const m = markierung(zelle.zutat)}
              <td class="menge {einkauf && m ? `e-${m}` : ''}" class:skaliert={faktor !== 1}>
                {#if onmenge && zelle.zutat.menge != null && zelle.zutat.einheit !== 'nach Geschmack'}
                  <button class="menge-knopf" onclick={() => onmenge(zelle.zutat)} title="Auf diese Zutat umrechnen">{menge(zelle.zutat)}</button>
                {:else}{menge(zelle.zutat)}{/if}
              </td>
            {:else if zelle.art === 'zutat'}
              {@const m = markierung(zelle.zutat)}
              <td class="zutat {einkauf && m ? `e-${m}` : ''}" colspan={zelle.colspan}>
                {#if onzutat && zelle.zutat.name}
                  <button class="zutat-knopf" onclick={() => onzutat(zelle.zutat)} title="Vorrat bearbeiten">
                    {#if m}<span class="icon status-{m}">{VORRAT_ICON[m]}</span>{/if}
                    <span>{zelle.zutat.name}{#if zelle.zutat.hinweis}{' '}<span class="hinweis">({zelle.zutat.hinweis})</span>{/if}</span>
                  </button>
                {:else}
                  {#if m}<span class="icon status-{m}">{VORRAT_ICON[m]}</span>{/if}{zelle.zutat.name}{#if zelle.zutat.hinweis}{' '}<span class="hinweis">({zelle.zutat.hinweis})</span>{/if}
                {/if}
              </td>
            {:else}
              <td class="schritt" class:lang={zelle.colspan > 1} rowspan={zelle.rowspan} colspan={zelle.colspan}>
                <span class="schritt-inhalt"><span class="nr">{zelle.nummer}</span>{#if timerTitel}<SchrittText text={zelle.schritt.text} titel="{timerTitel} · Schritt {zelle.nummer}" />{:else}{zelle.schritt.text}{/if}</span>
              </td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .rt {
    border-collapse: collapse;
    table-layout: auto;
    width: 100%;
    min-width: calc(14rem + var(--spalten) * 6.5rem);
    font-size: 0.95rem;
    line-height: 1.35;
    background: var(--flaeche);
    /* schmale Schrittspalten: lange Wörter trennen statt in die Nachbarzelle laufen */
    hyphens: auto;
    overflow-wrap: break-word;
  }
  td {
    border: 1px solid var(--linie);
    padding: 0.45em 0.6em;
    vertical-align: middle;
  }
  .menge {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    font-weight: 600;
    background: var(--zutat-bg);
  }
  .zutat {
    background: var(--zutat-bg);
    min-width: 8em;
  }
  .e-da {
    background: var(--da-bg);
    color: var(--text-leise);
  }
  .e-knapp {
    background: var(--knapp-bg);
  }
  .e-kaufen {
    background: var(--kaufen-bg);
    font-weight: 600;
  }
  .skaliert {
    color: var(--akzent);
  }
  .menge-knopf {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline dotted color-mix(in srgb, currentColor 40%, transparent);
    text-underline-offset: 0.2em;
  }
  .zutat-knopf {
    display: flex;
    gap: 0.45em;
    align-items: baseline;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .zutat-knopf:hover span:last-child {
    text-decoration: underline dotted;
  }
  .icon {
    flex: none;
    width: 1.2em;
    text-align: center;
  }
  .hinweis {
    color: var(--text-leise);
    font-size: 0.9em;
  }
  .schritt {
    background: var(--schritt-bg);
    min-width: 9em;
  }
  .schritt:not(.lang) {
    max-width: 22em;
  }
  /* Lange Schritte (über mehrere Spalten) behalten ihren Text beim Querscrollen im Blick,
     bis die Zelle endet, also bis der Schritt in den nächsten eingeht. Dafür ist der Textblock
     schmaler als die Zelle; 100cqw = sichtbare Breite des Scrollbereichs (container-type am Wrapper). */
  .lang .schritt-inhalt {
    position: sticky;
    left: 0.6em;
    display: inline-block;
    max-width: min(13em, calc(100cqw - 2em));
  }
  .nr {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5em;
    height: 1.5em;
    margin-right: 0.45em;
    border-radius: 999px;
    background: var(--akzent);
    color: var(--akzent-text);
    font-size: 0.75em;
    font-weight: 700;
    vertical-align: 0.1em;
  }
  .kompakt {
    min-width: 0;
    font-size: calc(8.6pt * var(--s, 1));
    line-height: 1.25;
  }
  .kompakt td {
    padding: 0.3em 0.45em;
  }
  .kompakt .schritt {
    min-width: 0;
    max-width: none;
  }
  .kompakt .lang .schritt-inhalt {
    position: static;
    display: inline;
    max-width: none;
  }
  .kompakt .zutat {
    min-width: 0;
  }
</style>
