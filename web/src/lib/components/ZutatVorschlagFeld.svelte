<script lang="ts">
  import { zurueckSchliesst } from '../zurueck.ts';

  /**
   * Textfeld mit eigener, deckender Vorschlagsliste (statt <datalist>, das in der App durchsichtig aufklappt).
   * Gehört in ein <form>; Enter schickt das Formular ab, ein Tipp auf einen Vorschlag ruft `onwaehlen`.
   */
  let {
    value = $bindable(''),
    vorschlaege,
    ausschliessen = [],
    placeholder = '',
    label,
    oninput,
    onwaehlen,
  }: {
    value?: string;
    vorschlaege: string[];
    ausschliessen?: string[];
    placeholder?: string;
    label: string;
    oninput?: () => void;
    onwaehlen: (v: string) => void;
  } = $props();

  const listeId = `vorschlaege-${Math.random().toString(36).slice(2, 8)}`;
  let offen = $state(false);
  const falten = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const passend = $derived.by(() => {
    const q = falten(value.trim());
    if (!q) return [];
    const gewaehlt = new Set(ausschliessen.map(falten));
    const kandidaten = vorschlaege.filter((v) => !gewaehlt.has(falten(v)));
    const anfang = kandidaten.filter((v) => falten(v).startsWith(q));
    const drin = kandidaten.filter((v) => !falten(v).startsWith(q) && falten(v).includes(q));
    return [...anfang, ...drin].slice(0, 8);
  });
  const sichtbar = $derived(offen && passend.length > 0);
  $effect(() => {
    if (sichtbar) return zurueckSchliesst(() => (offen = false));
  });
</script>

<div class="feld">
  <input
    type="text"
    {placeholder}
    bind:value
    oninput={() => {
      offen = true;
      oninput?.();
    }}
    onfocus={() => (offen = true)}
    onclick={() => (offen = true)}
    onblur={() => setTimeout(() => (offen = false), 150)}
    autocomplete="off"
    role="combobox"
    aria-label={label}
    aria-expanded={sichtbar}
    aria-controls={listeId}
  />
  {#if sichtbar}
    <ul class="vorschlaege" id={listeId} role="listbox">
      {#each passend as v (v)}
        <li role="option" aria-selected="false">
          <!-- pointerdown verhindert, dass das Feld vorher den Fokus verliert -->
          <button type="button" onpointerdown={(e) => e.preventDefault()} onclick={() => onwaehlen(v)}>{v}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .feld {
    position: relative;
    flex: 1;
  }
  .feld input {
    width: 100%;
  }
  .vorschlaege {
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
    background: var(--flaeche);
    border: 1px solid var(--linie);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    max-height: 50vh;
    overflow-y: auto;
  }
  .vorschlaege button {
    display: block;
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: var(--text);
  }
  .vorschlaege button:hover,
  .vorschlaege button:focus-visible {
    background: var(--zutat-bg);
  }
</style>
