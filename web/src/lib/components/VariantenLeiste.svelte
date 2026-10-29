<script lang="ts">
  import { variantenDerGruppe, type RezeptInfo } from '@mrt/shared';
  import { store } from '../app.ts';
  import { wechsleZu } from '../router.svelte.ts';

  /** Umschalter zwischen den Varianten einer Gruppe, oben im Rezept. */
  let { gruppe, id }: { gruppe: string; id: string } = $props();

  let liste = $state<RezeptInfo[]>([]);
  store.liste().then((l) => (liste = l), () => {});

  const varianten = $derived(variantenDerGruppe(liste, gruppe));
</script>

{#if varianten.length > 1}
  <nav class="varianten nicht-drucken" aria-label="Varianten von {gruppe}">
    <a class="kopf" href="#/varianten/{encodeURIComponent(gruppe)}">⧉ {gruppe} · {varianten.length} Varianten <span class="vergleich">⇄ Vergleichen</span></a>
    <div class="chips">
      {#each varianten as v (v.id)}
        <button class="chip" class:aktiv={v.id === id} aria-current={v.id === id ? 'page' : undefined} onclick={() => v.id !== id && wechsleZu(`/rezept/${encodeURIComponent(v.id)}`)}>{v.variante!.name}</button>
      {/each}
    </div>
  </nav>
{/if}

<style>
  .varianten {
    margin: 0.9rem 0 0;
    padding: 0.6rem 0.7rem;
    border-radius: 12px;
    background: var(--zutat-bg);
  }
  .kopf {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-leise);
    text-decoration: none;
  }
  .vergleich {
    color: var(--akzent);
    font-weight: 600;
    white-space: nowrap;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chip {
    flex: none;
    padding: 0.45em 0.85em;
    border: 1px solid var(--linie);
    border-radius: 999px;
    background: var(--flaeche);
    cursor: pointer;
    font-size: 0.9rem;
  }
  .chip.aktiv {
    background: var(--akzent);
    border-color: var(--akzent);
    color: var(--akzent-text);
    font-weight: 600;
    cursor: default;
  }
</style>
