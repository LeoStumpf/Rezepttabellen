<script lang="ts">
  import { faktorAusMenge, formatMenge, skaliereMenge, type Zutat } from '@mrt/shared';
  import { zurueckSchliesst } from '../zurueck.ts';

  /** „Ich habe nur 250 g Nudeln“ → alle Mengen auf diese Zutat umrechnen. */
  let { zutat, faktor, onfaktor, onclose }: { zutat: Zutat; faktor: number; onfaktor: (f: number) => void; onclose: () => void } = $props();

  $effect(() => zurueckSchliesst(() => onclose()));

  const original = $derived(zutat.menge ?? 0);
  let eingabe = $state(String(skaliereMenge(zutat.menge, zutat.einheit, faktor) ?? '').replace('.', ','));
  const wert = $derived(Number(eingabe.replace(',', '.')));
  const neuerFaktor = $derived(faktorAusMenge(wert, original));

  function uebernehmen(e: Event) {
    e.preventDefault();
    if (neuerFaktor) onfaktor(neuerFaktor);
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="hintergrund" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Umrechnen auf {zutat.name}">
  <form onsubmit={uebernehmen}>
    <header>
      <div>
        <strong>Umrechnen auf {zutat.name}</strong>
        <p class="leise">Im Rezept: {formatMenge(zutat.menge, zutat.einheit)}. Alle anderen Mengen werden im gleichen Verhältnis angepasst.</p>
      </div>
      <button type="button" class="zu" onclick={onclose} aria-label="Schließen">✕</button>
    </header>
    <label class="zeile">
      <span>Ich habe</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" inputmode="decimal" bind:value={eingabe} autofocus onfocus={(e) => e.currentTarget.select()} />
      <span>{zutat.einheit && zutat.einheit !== 'Stück' ? zutat.einheit : 'Stück'}</span>
    </label>
    {#if neuerFaktor}
      <p class="leise">= {neuerFaktor.toLocaleString('de-DE', { maximumFractionDigits: 2 })} × Rezept</p>
    {/if}
    <div class="knoepfe">
      {#if faktor !== 1}
        <button type="button" class="knopf" onclick={() => { onfaktor(1); onclose(); }}>Original</button>
      {/if}
      <button type="submit" class="knopf primaer" disabled={!neuerFaktor}>Umrechnen</button>
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
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    background: var(--flaeche);
    border-radius: 14px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.3);
    padding: 1rem;
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
  header p {
    margin: 0.2rem 0 0;
  }
  .zu {
    border: 0;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    align-self: flex-start;
  }
  .leise {
    margin: 0;
    color: var(--text-leise);
    font-size: 0.85rem;
  }
  .zeile {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1rem;
    color: var(--text);
  }
  .zeile input {
    width: 7em;
    font-size: 1.1rem;
    text-align: right;
  }
  .knoepfe {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
