<script lang="ts">
  import { findeZeiten } from '@mrt/shared';
  import { timerStarten } from '../timer.svelte.ts';

  /** Schritttext; Zeitangaben („10 Minuten“) starten auf Antippen einen Timer. */
  let { text, titel, timer = true }: { text: string; titel: string; timer?: boolean } = $props();

  const teile = $derived(timer ? findeZeiten(text) : [{ text }]);
</script>

{#each teile as t, i (i)}{#if t.sekunden}<button
      class="zeit"
      onclick={(e) => {
        e.stopPropagation();
        timerStarten(titel, t.sekunden!);
      }}
      title="Timer starten">⏱ {t.text}</button
    >{:else}{t.text}{/if}{/each}

<style>
  .zeit {
    display: inline;
    padding: 0 0.3em;
    margin: 0 0.05em;
    border: 1px solid color-mix(in srgb, var(--akzent) 45%, transparent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--akzent) 10%, transparent);
    color: inherit;
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  @media print {
    .zeit {
      border: 0;
      background: none;
      padding: 0;
    }
  }
</style>
