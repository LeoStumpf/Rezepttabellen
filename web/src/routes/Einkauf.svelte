<script lang="ts">
  import { KATEGORIEN, einkaufAlsText, formatMenge, rateKategorie, vorschlagName, type EinkaufPosten } from '@mrt/shared';
  import { store } from '../lib/app.ts';
  import { zutatenLaden } from '../lib/rezept-zutaten.ts';
  import { einkauf } from '../lib/sammlung.svelte.ts';
  import { abhaken, einkaufFertig, postenHinzufuegen } from '../lib/einkauf.ts';
  import { vorratLaden } from '../lib/vorrat.svelte.ts';
  import { zeigeMeldung } from '../lib/meldung.svelte.ts';
  import { teilen } from '../lib/teilen.ts';
  import ZutatVorschlagFeld from '../lib/components/ZutatVorschlagFeld.svelte';

  void einkauf.laden();
  void vorratLaden();

  let eingabe = $state('');
  let leerenBestaetigen = $state(false);
  let vorschlaege = $state<string[]>([]);
  (async () => {
    const liste = await store.liste().catch(() => []);
    const namen = [...(await zutatenLaden(liste)).values()].flat().map(vorschlagName);
    vorschlaege = [...new Set(namen)].sort((a, b) => a.localeCompare(b, 'de'));
  })();

  const offen = $derived(einkauf.eintraege.filter((p) => !p.abgehakt));
  const erledigt = $derived(einkauf.eintraege.filter((p) => p.abgehakt).sort((a, b) => a.name.localeCompare(b.name, 'de')));

  const gruppen = $derived.by(() => {
    const map = new Map<string, EinkaufPosten[]>();
    for (const p of offen) {
      const k = rateKategorie(p.name);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    const reihenfolge = [...KATEGORIEN] as string[];
    return [...map.entries()]
      .sort(([a], [b]) => reihenfolge.indexOf(a) - reihenfolge.indexOf(b))
      .map(([kategorie, liste]) => ({ kategorie, liste: liste.sort((a, b) => a.name.localeCompare(b.name, 'de')) }));
  });

  function hinzufuegen(text = eingabe) {
    void postenHinzufuegen(text);
    eingabe = '';
  }

  async function fertig() {
    const n = await einkaufFertig();
    zeigeMeldung(`${n} ${n === 1 ? 'Zutat' : 'Zutaten'} als „da“ in den Vorrat übernommen`, { href: '#/vorrat', text: 'Vorrat' });
  }

  async function leeren() {
    await einkauf.loeschen(einkauf.eintraege);
    leerenBestaetigen = false;
  }
</script>

{#snippet zeile(p: EinkaufPosten)}
  <li class:erledigt={p.abgehakt}>
    <button class="posten" onclick={() => abhaken(p)} aria-pressed={p.abgehakt}>
      <span class="kasten" aria-hidden="true">{p.abgehakt ? '✓' : ''}</span>
      <span class="text">
        {#if formatMenge(p.menge, p.einheit)}<strong>{formatMenge(p.menge, p.einheit)}</strong>{' '}{/if}{p.name}
        {#if p.rezepte.length}<span class="rezepte">{p.rezepte.join(' · ')}</span>{/if}
      </span>
    </button>
    <button class="x" onclick={() => einkauf.loeschen([p])} aria-label="{p.name} entfernen">✕</button>
  </li>
{/snippet}

<div class="seite-rand inhalt">
  <h1>Einkaufsliste</h1>
  <p class="leise">Fehlende Zutaten kommen per „🛒 auf die Liste“ aus dem Rezept hierher. Abhaken beim Einkaufen, danach landet alles im Vorrat.</p>
  {#if einkauf.fehler}<div class="fehlerbox">{einkauf.fehler}</div>{/if}

  <form
    class="karte neu"
    onsubmit={(e) => {
      e.preventDefault();
      hinzufuegen();
    }}
  >
    <ZutatVorschlagFeld bind:value={eingabe} {vorschlaege} ausschliessen={offen.map((p) => p.name)} placeholder="z. B. Zitronen, Klopapier …" label="Zur Liste hinzufügen" onwaehlen={(v) => hinzufuegen(v)} />
    <button class="knopf primaer" type="submit" disabled={!eingabe.trim()}>＋</button>
  </form>

  {#if einkauf.geladen && einkauf.eintraege.length === 0}
    <div class="leer">
      <p>Die Liste ist leer.</p>
      <p class="leise">Im Rezept die 🛒-Einkaufsansicht öffnen und „auf die Liste“ tippen.</p>
    </div>
  {/if}

  {#each gruppen as g (g.kategorie)}
    <section>
      <h2>{g.kategorie}</h2>
      <ul class="liste">{#each g.liste as p (p.id)}{@render zeile(p)}{/each}</ul>
    </section>
  {/each}

  {#if erledigt.length}
    <section>
      <h2>Im Wagen ({erledigt.length})</h2>
      <ul class="liste">{#each erledigt as p (p.id)}{@render zeile(p)}{/each}</ul>
    </section>
  {/if}

  {#if einkauf.eintraege.length}
    <div class="leiste">
      <button class="knopf primaer" onclick={fertig} disabled={!erledigt.length}>✓ Einkauf fertig{#if erledigt.length}{' '}({erledigt.length}){/if}</button>
      <button class="knopf" onclick={() => teilen('Einkaufsliste', einkaufAlsText(einkauf.eintraege))}>↗ Teilen</button>
      {#if leerenBestaetigen}
        <button class="knopf gefahr" onclick={leeren}>Wirklich leeren?</button>
      {:else}
        <button class="knopf" onclick={() => (leerenBestaetigen = true)}>Leeren</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .inhalt {
    padding-bottom: 6rem;
    max-width: 760px;
  }
  h1 {
    font-family: var(--serif);
    margin: 1.2rem 0 0.3rem;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.1rem;
    margin: 1.2rem 0 0.4rem;
  }
  .leise {
    color: var(--text-leise);
    font-size: 0.9rem;
  }
  .karte {
    background: var(--flaeche);
    border-radius: 12px;
    box-shadow: var(--schatten);
    padding: 0.8rem;
    margin: 0.8rem 0;
  }
  .neu {
    display: flex;
    gap: 0.5rem;
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--flaeche);
    border-radius: 10px;
    box-shadow: var(--schatten);
    overflow: hidden;
  }
  .liste li {
    display: flex;
    align-items: center;
  }
  .liste li + li {
    border-top: 1px solid var(--linie);
  }
  .posten {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 0.7rem;
    align-items: center;
    padding: 0.65rem 0.8rem;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: var(--text);
  }
  .kasten {
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    border: 2px solid var(--akzent);
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: var(--akzent-text);
  }
  .erledigt .kasten {
    background: var(--da);
    border-color: var(--da);
  }
  .erledigt .text {
    text-decoration: line-through;
    color: var(--text-leise);
  }
  .text {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .rezepte {
    display: block;
    font-size: 0.8rem;
    color: var(--text-leise);
  }
  .x {
    border: 0;
    background: none;
    color: var(--text-leise);
    cursor: pointer;
    padding: 0.6rem 0.8rem;
  }
  .leiste {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.8rem 0 calc(0.8rem + env(safe-area-inset-bottom));
    margin-top: 1rem;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px);
  }
  .leiste .primaer {
    flex: 1;
  }
  .leer {
    text-align: center;
    padding: 2rem 0;
  }
</style>
