<script lang="ts">
  import { KATEGORIEN, normalisiere, rateKategorie, vorschlagName, type Zutat, type VorratStatus } from '@mrt/shared';
  import { vorrat, statusVon, setzeStatus, neuerArtikel, zuordnen, zuordnungLoesen } from '../vorrat.svelte.ts';
  import { zurueckSchliesst } from '../zurueck.ts';

  let { zutat, onclose }: { zutat: Zutat; onclose: () => void } = $props();
  $effect(() => zurueckSchliesst(() => onclose()));

  const treffer = $derived(statusVon(zutat.name));
  const artikel = $derived(treffer.artikel);
  const gelernt = $derived(!!artikel && artikel.begriffe.includes(normalisiere(zutat.name)));

  let modus = $state<'start' | 'zuordnen' | 'neu'>('start');
  let suche = $state('');
  let neuName = $state(vorschlagName(zutat.name));
  let neuKategorie = $state(rateKategorie(zutat.name));

  const kandidaten = $derived(
    vorrat.artikel
      .filter((a) => !suche.trim() || a.name.toLowerCase().includes(suche.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .slice(0, 40),
  );

  const STATUS: { wert: VorratStatus; label: string }[] = [
    { wert: 'da', label: '✓ Da' },
    { wert: 'knapp', label: '⚠ Knapp' },
    { wert: 'leer', label: '🛒 Leer' },
  ];

  async function status(s: VorratStatus) {
    if (artikel) await setzeStatus(artikel, s);
    else await neuerArtikel(vorschlagName(zutat.name), s, rateKategorie(zutat.name), zutat.name);
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="hintergrund" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Vorrat: {zutat.name}">
  <header>
    <div>
      <strong>{zutat.name}</strong>
      <p class="leise">
        {#if artikel}
          Im Vorrat als <b>{artikel.name}</b>{gelernt ? ' (zugeordnet)' : ''}
        {:else}
          Nicht im Vorrat
        {/if}
      </p>
    </div>
    <button class="zu" onclick={onclose} aria-label="Schließen">✕</button>
  </header>

  {#if modus === 'start'}
    <div class="status">
      {#each STATUS as s (s.wert)}
        <button class="knopf status-{s.wert}" class:aktiv={artikel?.status === s.wert} onclick={() => status(s.wert)}>{s.label}</button>
      {/each}
    </div>
    {#if !artikel}<p class="leise">Ein Tipp auf einen Status legt „{vorschlagName(zutat.name)}“ im Vorrat an.</p>{/if}
    <div class="weitere">
      <button class="knopf" onclick={() => (modus = 'zuordnen')}>Anderem Artikel zuordnen …</button>
      <button class="knopf" onclick={() => (modus = 'neu')}>Neuer Artikel …</button>
      {#if gelernt}
        <button class="knopf" onclick={async () => { await zuordnungLoesen(zutat.name); onclose(); }}>Zuordnung lösen</button>
      {/if}
    </div>
  {:else if modus === 'zuordnen'}
    <input type="text" placeholder="Vorrat durchsuchen …" bind:value={suche} />
    <ul class="liste">
      {#each kandidaten as a (a.id)}
        <li>
          <button onclick={async () => { await zuordnen(zutat.name, a); onclose(); }}>
            {a.name} <span class="leise">{a.kategorie ?? ''} · {a.status}</span>
          </button>
        </li>
      {:else}
        <li class="leise">Keine Treffer</li>
      {/each}
    </ul>
    <button class="knopf" onclick={() => (modus = 'start')}>← Zurück</button>
  {:else}
    <label>Name <input type="text" bind:value={neuName} /></label>
    <label>Kategorie
      <select bind:value={neuKategorie}>
        {#each KATEGORIEN as k (k)}<option value={k}>{k}</option>{/each}
      </select>
    </label>
    <div class="status">
      {#each STATUS as s (s.wert)}
        <button class="knopf status-{s.wert}" onclick={async () => { await neuerArtikel(neuName, s.wert, neuKategorie, zutat.name); onclose(); }}>{s.label}</button>
      {/each}
    </div>
    <button class="knopf" onclick={() => (modus = 'start')}>← Zurück</button>
  {/if}
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
    max-height: calc(100vh - 64px);
    overflow: auto;
    background: var(--flaeche);
    border-radius: 14px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.3);
    padding: 1rem;
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
    color: var(--text-leise);
    font-size: 0.85rem;
  }
  .status {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
  }
  .status .knopf {
    justify-content: center;
  }
  .status .aktiv {
    outline: 2px solid var(--akzent);
    outline-offset: 1px;
    font-weight: 700;
  }
  .weitere {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 40vh;
    overflow: auto;
    border: 1px solid var(--linie);
    border-radius: 8px;
  }
  .liste li + li {
    border-top: 1px solid var(--linie);
  }
  .liste button {
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    padding: 0.5rem 0.7rem;
    cursor: pointer;
  }
  .liste button:hover {
    background: var(--zutat-bg);
  }
  .liste li.leise {
    padding: 0.5rem 0.7rem;
  }
</style>
