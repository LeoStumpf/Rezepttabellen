<script lang="ts">
  import { KATEGORIEN, findeArtikel, normalisiere, rateKategorie, vorschlagName, type VorratArtikel, type VorratStatus } from '@mrt/shared';
  import { store } from '../lib/app.ts';
  import { zutatenLaden } from '../lib/rezept-zutaten.ts';
  import { vorrat, vorratLaden, setzeStatus, setzeKategorie, loeschen, neuerArtikel, umbenennen } from '../lib/vorrat.svelte.ts';

  void vorratLaden();

  let eingabe = $state('');
  let kategorie = $state<string>('');
  let suche = $state('');
  let nurFehlend = $state(false);
  let loeschKandidat = $state<string | null>(null);
  let bearbeiten = $state<string | null>(null);

  // Alle Zutaten aller Rezepte – für Autovervollständigung und „Aus Rezepten abhaken“
  let rezeptZutaten = $state<{ name: string; anzahl: number; zutatName: string }[]>([]);
  let zeigeAbhaken = $state(false);
  (async () => {
    const liste = await store.liste().catch(() => []);
    const zaehler = new Map<string, { name: string; anzahl: number; zutatName: string }>();
    for (const zutaten of (await zutatenLaden(liste)).values()) {
      for (const zutatName of zutaten) {
        const name = vorschlagName(zutatName);
        const key = normalisiere(name);
        const e = zaehler.get(key);
        if (e) e.anzahl++;
        else zaehler.set(key, { name, anzahl: 1, zutatName });
      }
    }
    rezeptZutaten = [...zaehler.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
  })();

  const offeneZutaten = $derived(rezeptZutaten.filter((z) => !findeArtikel(z.zutatName, vorrat.artikel)));
  const vorschlagKategorie = $derived(eingabe.trim() ? rateKategorie(eingabe) : 'Sonstiges');

  const gruppen = $derived.by(() => {
    const q = suche.trim().toLowerCase();
    const gefiltert = vorrat.artikel.filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!nurFehlend || a.status !== 'da'));
    const map = new Map<string, VorratArtikel[]>();
    for (const a of gefiltert) {
      const k = a.kategorie || 'Sonstiges';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    const reihenfolge = [...KATEGORIEN] as string[];
    return [...map.entries()]
      .sort(([a], [b]) => (reihenfolge.indexOf(a) + 1 || 99) - (reihenfolge.indexOf(b) + 1 || 99))
      .map(([k, liste]) => ({ kategorie: k, liste: liste.sort((a, b) => a.name.localeCompare(b.name, 'de')) }));
  });

  const zaehler = $derived({
    da: vorrat.artikel.filter((a) => a.status === 'da').length,
    knapp: vorrat.artikel.filter((a) => a.status === 'knapp').length,
    leer: vorrat.artikel.filter((a) => a.status === 'leer').length,
  });

  const NAECHSTER: Record<VorratStatus, VorratStatus> = { da: 'knapp', knapp: 'leer', leer: 'da' };
  const LABEL: Record<VorratStatus, string> = { da: '✓ da', knapp: '⚠ knapp', leer: '🛒 leer' };

  async function hinzufuegen(e: SubmitEvent) {
    e.preventDefault();
    if (!eingabe.trim()) return;
    await neuerArtikel(eingabe, 'da', kategorie || vorschlagKategorie);
    eingabe = '';
    kategorie = '';
  }
</script>

<div class="seite-rand inhalt">
  <h1>Vorrat</h1>
  <p class="leise">Was du zu Hause hast. In der <strong>Einkaufsansicht</strong> eines Rezepts siehst du dann sofort, was du noch kaufen musst.</p>

  {#if vorrat.fehler}<div class="fehlerbox">{vorrat.fehler}</div>{/if}

  <form class="karte neu" onsubmit={hinzufuegen}>
    <input type="text" list="zutat-vorschlaege" placeholder="z. B. Kreuzkümmel" bind:value={eingabe} aria-label="Neuer Artikel" />
    <select bind:value={kategorie} aria-label="Kategorie">
      <option value="">{vorschlagKategorie} (automatisch)</option>
      {#each KATEGORIEN as k (k)}<option value={k}>{k}</option>{/each}
    </select>
    <button class="knopf primaer" type="submit" disabled={!eingabe.trim()}>＋ Hinzufügen</button>
    <datalist id="zutat-vorschlaege">
      {#each rezeptZutaten as z (z.name)}<option value={z.name}></option>{/each}
    </datalist>
  </form>

  <div class="karte">
    <button class="aufklapp" onclick={() => (zeigeAbhaken = !zeigeAbhaken)} aria-expanded={zeigeAbhaken}>
      <span><strong>Aus Rezepten abhaken</strong> <span class="leise">· {offeneZutaten.length} Zutaten aus deinen Rezepten sind noch nicht im Vorrat</span></span>
      <span>{zeigeAbhaken ? '▲' : '▼'}</span>
    </button>
    {#if zeigeAbhaken}
      <p class="leise">Tippe an, was du zu Hause hast. Es wird als „da“ angelegt.</p>
      <div class="chips">
        {#each offeneZutaten as z (z.name)}
          <button class="chip" onclick={() => neuerArtikel(z.name, 'da', rateKategorie(z.name), z.zutatName)}>
            {z.name}{#if z.anzahl > 1}<span class="anzahl">{z.anzahl}</span>{/if}
          </button>
        {:else}
          <span class="leise">Alles erfasst 🎉</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="filter">
    <input type="text" placeholder="Vorrat durchsuchen …" bind:value={suche} aria-label="Suche" />
    <label class="check"><input type="checkbox" bind:checked={nurFehlend} /> nur knapp/leer</label>
  </div>
  <p class="leise zaehler">
    <span class="status-da">✓ {zaehler.da} da</span> · <span class="status-knapp">⚠ {zaehler.knapp} knapp</span> · <span class="status-leer">🛒 {zaehler.leer} leer</span>
  </p>

  {#if vorrat.geladen && vorrat.artikel.length === 0}
    <p class="leise leer">Noch nichts im Vorrat. Füge oben Artikel hinzu oder hake sie aus deinen Rezepten ab.</p>
  {/if}

  {#each gruppen as g (g.kategorie)}
    <section>
      <h2>{g.kategorie}</h2>
      <ul class="artikel">
        {#each g.liste as a (a.id)}
          <li>
            {#if bearbeiten === a.id}
              <input
                type="text"
                value={a.name}
                aria-label="Name"
                onkeydown={(e) => {
                  if (e.key === 'Enter') { umbenennen(a, e.currentTarget.value); bearbeiten = null; }
                  if (e.key === 'Escape') bearbeiten = null;
                }}
                onblur={(e) => { umbenennen(a, e.currentTarget.value); bearbeiten = null; }}
              />
            {:else}
              <button class="name" onclick={() => (bearbeiten = a.id)} title="Umbenennen">{a.name}</button>
            {/if}
            <select value={a.kategorie || 'Sonstiges'} onchange={(e) => setzeKategorie(a, e.currentTarget.value)} aria-label="Kategorie">
              {#each KATEGORIEN as k (k)}<option value={k}>{k}</option>{/each}
            </select>
            <button class="status-knopf s-{a.status}" onclick={() => setzeStatus(a, NAECHSTER[a.status])} title="Status wechseln">{LABEL[a.status]}</button>
            {#if loeschKandidat === a.id}
              <button class="knopf gefahr klein" onclick={() => { loeschen(a); loeschKandidat = null; }}>Löschen?</button>
            {:else}
              <button class="x" onclick={() => (loeschKandidat = a.id)} aria-label="{a.name} löschen">✕</button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .inhalt {
    padding-bottom: 3rem;
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
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.5rem;
  }
  .neu select {
    width: auto;
  }
  @media (max-width: 560px) {
    .neu {
      grid-template-columns: 1fr 1fr;
    }
    .neu input {
      grid-column: 1 / -1;
    }
  }
  .aufklapp {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    border: 0;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .chip {
    border: 1px solid var(--linie);
    background: var(--bg);
    border-radius: 999px;
    padding: 0.25em 0.75em;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .chip:hover {
    border-color: var(--da);
    background: var(--da-bg);
  }
  .anzahl {
    margin-left: 0.4em;
    font-size: 0.75em;
    color: var(--text-leise);
  }
  .filter {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    margin-top: 1rem;
  }
  .check {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    white-space: nowrap;
    font-size: 0.9rem;
    color: var(--text);
  }
  .zaehler {
    margin: 0.4rem 0 0;
  }
  .artikel {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--flaeche);
    border-radius: 10px;
    box-shadow: var(--schatten);
    overflow: hidden;
  }
  .artikel li {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.35rem 0.6rem;
  }
  .artikel li + li {
    border-top: 1px solid var(--linie);
  }
  .artikel select {
    width: auto;
    font-size: 0.8rem;
    padding: 0.2em 0.3em;
    color: var(--text-leise);
  }
  .name {
    border: 0;
    background: none;
    text-align: left;
    padding: 0.3rem 0;
    cursor: text;
  }
  .status-knopf {
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 0.25em 0.8em;
    cursor: pointer;
    font-size: 0.85rem;
    min-width: 6.5em;
    font-weight: 600;
  }
  .s-da {
    background: var(--da-bg);
    color: var(--da);
  }
  .s-knapp {
    background: var(--knapp-bg);
    color: var(--knapp);
  }
  .s-leer {
    background: var(--kaufen-bg);
    color: var(--kaufen);
  }
  .x {
    border: 0;
    background: none;
    color: var(--text-leise);
    cursor: pointer;
    padding: 0.3rem;
  }
  .klein {
    padding: 0.2em 0.6em;
    font-size: 0.8rem;
  }
  @media (max-width: 480px) {
    .artikel li {
      grid-template-columns: 1fr auto auto;
    }
    .artikel select {
      display: none;
    }
  }
  .leer {
    text-align: center;
    padding: 2rem 0;
  }
</style>
