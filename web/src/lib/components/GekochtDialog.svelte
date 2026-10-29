<script lang="ts">
  import { zurueckSchliesst } from '../zurueck.ts';

  /** „Gekocht?“ – nach dem Kochmodus oder aus dem Menü: Datum heute, optional Sterne und Notiz. */
  let { titel, oneintragen, onclose }: { titel: string; oneintragen: (bewertung?: number, notiz?: string) => void; onclose: () => void } = $props();

  $effect(() => zurueckSchliesst(() => onclose()));

  let bewertung = $state<number | undefined>();
  let notiz = $state('');

  function absenden(e: Event) {
    e.preventDefault();
    oneintragen(bewertung, notiz);
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="hintergrund" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Gekocht eintragen">
  <form onsubmit={absenden}>
    <header>
      <strong>Heute gekocht: {titel}</strong>
      <button type="button" class="zu" onclick={onclose} aria-label="Schließen">✕</button>
    </header>
    <div class="sterne" role="group" aria-label="Bewertung (optional)">
      {#each [1, 2, 3, 4, 5] as n (n)}
        <button type="button" class:an={(bewertung ?? 0) >= n} onclick={() => (bewertung = bewertung === n ? undefined : n)} aria-label="{n} Sterne" aria-pressed={bewertung === n}>★</button>
      {/each}
    </div>
    <input type="text" bind:value={notiz} placeholder="Notiz (optional), z. B. „mehr Chili“" aria-label="Notiz" />
    <div class="knoepfe">
      <button type="button" class="knopf" onclick={onclose}>Nicht eintragen</button>
      <button type="submit" class="knopf primaer">✓ Eintragen</button>
    </div>
  </form>
</div>

<style>
  .hintergrund {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }
  .dialog {
    position: fixed;
    z-index: 41;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(480px, 100vw);
    background: var(--flaeche);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -10px 40px rgb(0 0 0 / 0.3);
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  }
  form {
    display: grid;
    gap: 0.8rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  .zu {
    border: 0;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    align-self: flex-start;
  }
  .sterne {
    display: flex;
    gap: 0.2rem;
  }
  .sterne button {
    border: 0;
    background: none;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    color: var(--linie);
    padding: 0.1rem;
  }
  .sterne .an {
    color: #e0a400;
  }
  .knoepfe {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
