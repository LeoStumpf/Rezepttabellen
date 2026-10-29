<script lang="ts" module>
  import type { Ernaehrung } from '@mrt/shared';
  import { einstellungen } from '../lib/einstellungen.ts';

  // Modulweit, damit die Filter beim Zurückkommen aus einem Rezept erhalten bleiben
  const filter = $state({
    modus: 'suche' as 'suche' | 'kuehlschrank',
    suche: '',
    ernaehrung: '' as Ernaehrung | '',
    maxMin: 0,
    kuehlschrank: einstellungen.kuehlschrank,
    alle: true,
    favoriten: false,
  });
</script>

<script lang="ts">
  import type { RezeptInfo } from '@mrt/shared';
  import { ERNAEHRUNG, einkaufStatus, ernaehrungVon, kuehlschrankTreffer, passtErnaehrung, vorschlagName } from '@mrt/shared';
  import { SORTIERUNGEN, type Sortierung, type UebersichtModus } from '../lib/einstellungen.ts';
  import { favoriten } from '../lib/sammlung.svelte.ts';
  import { zuletztGekocht } from '../lib/verlauf.ts';
  import { variantenZusammenfassen, type UebersichtEintrag } from '../lib/uebersicht.ts';
  import RezeptKacheln from '../lib/components/RezeptKacheln.svelte';
  import RezeptDetails from '../lib/components/RezeptDetails.svelte';
  import RezeptDiscover from '../lib/components/RezeptDiscover.svelte';
  import ZutatVorschlagFeld from '../lib/components/ZutatVorschlagFeld.svelte';
  import { store, istApp } from '../lib/app.ts';
  import { scrollWiederherstellen } from '../lib/router.svelte.ts';
  import { tick } from 'svelte';
  import { bekannteZutaten, zutatenLaden } from '../lib/rezept-zutaten.ts';
  import { vorrat, vorratLaden } from '../lib/vorrat.svelte.ts';

  let rezepte = $state<RezeptInfo[]>([]);
  let zutaten = $state(new Map<string, string[]>());
  let fehler = $state('');
  let geladen = $state(false);
  let eingabe = $state('');

  const listeLaden = () =>
    store.liste().then((l) => {
      rezepte = l;
      zutaten = bekannteZutaten(l);
      void zutatenLaden(l).then((m) => (zutaten = m));
    });
  listeLaden()
    .catch((e) => (fehler = (e as Error).message))
    .finally(() => {
      geladen = true;
      void tick().then(scrollWiederherstellen);
    });
  void vorratLaden();
  // Auto-Sync der App hat neue Rezepte geholt
  $effect(() => {
    const neu = () => void listeLaden().catch(() => {});
    window.addEventListener('sync-fertig', neu);
    return () => window.removeEventListener('sync-fertig', neu);
  });

  const ZEITEN = [30, 45, 60];
  const ICON: Record<Ernaehrung, string> = { Vegan: '🌱', Vegetarisch: '🥕', Pescetarisch: '🐟', Fleisch: '🍖' };

  const vorschlaege = $derived([...new Set([...zutaten.values()].flat().map(vorschlagName))].sort((a, b) => a.localeCompare(b, 'de')));
  const filterAktiv = $derived(!!(filter.suche.trim() || filter.ernaehrung || filter.maxMin || filter.favoriten));
  const favoritIds = $derived(new Set(favoriten.eintraege.map((f) => f.id)));
  const zuletzt = $derived(zuletztGekocht());
  let sortierung = $state<Sortierung>(einstellungen.sortierung);
  function sortierungWechseln(s: Sortierung) {
    sortierung = s;
    einstellungen.sortierung = s;
  }
  const passtFavorit = (r: RezeptInfo) => !filter.favoriten || favoritIds.has(r.id);
  function sortiert(liste: RezeptInfo[]): RezeptInfo[] {
    const titel = (a: RezeptInfo, b: RezeptInfo) => a.titel.localeCompare(b.titel, 'de');
    const z = (r: RezeptInfo) => zuletzt.get(r.id) ?? '';
    switch (sortierung) {
      case 'neu':
        return [...liste].sort((a, b) => (b.erstellt ?? '').localeCompare(a.erstellt ?? '') || titel(a, b));
      case 'schnell':
        return [...liste].sort((a, b) => (a.gesamtMin ?? 9999) - (b.gesamtMin ?? 9999) || titel(a, b));
      case 'zuletzt':
        return [...liste].sort((a, b) => z(b).localeCompare(z(a)) || titel(a, b));
      case 'lange':
        // nie gekocht zählt als „am längsten her“
        return [...liste].sort((a, b) => z(a).localeCompare(z(b)) || titel(a, b));
      default:
        return liste;
    }
  }

  const gefiltert = $derived(
    rezepte.filter((r) => {
      const q = filter.suche.trim().toLowerCase();
      const passt = !q || [r.titel, r.untertitel ?? '', ...r.tags, ...(zutaten.get(r.id) ?? [])].some((t) => t.toLowerCase().includes(q));
      return (
        passt &&
        passtErnaehrung(ernaehrungVon(r.tags), filter.ernaehrung) &&
        passtFavorit(r) &&
        (!filter.maxMin || (r.gesamtMin != null && r.gesamtMin <= filter.maxMin))
      );
    }),
  );

  const kuehlErgebnis = $derived.by(() => {
    const begriffe = filter.kuehlschrank;
    if (!begriffe.length) return [];
    return rezepte
      .filter((r) => passtErnaehrung(ernaehrungVon(r.tags), filter.ernaehrung) && passtFavorit(r))
      .map((r) => {
        const namen = zutaten.get(r.id) ?? [];
        const treffer = kuehlschrankTreffer(namen, begriffe);
        const genutzt = new Set(treffer.flatMap((t) => t.zutaten));
        const fehlend = vorrat.artikel.length ? namen.filter((n) => !genutzt.has(n) && einkaufStatus(n, vorrat.artikel).status === 'kaufen') : null;
        return { r, treffer, fehlt: begriffe.filter((b) => !treffer.some((t) => t.begriff === b)), fehlend };
      })
      .filter((e) => (filter.alle ? e.fehlt.length === 0 : e.treffer.length > 0))
      .sort(
        (a, b) =>
          b.treffer.length - a.treffer.length ||
          (a.fehlend?.length ?? 0) - (b.fehlend?.length ?? 0) ||
          a.r.titel.localeCompare(b.r.titel, 'de'),
      );
  });

  const eintraege = $derived.by<UebersichtEintrag[]>(() => {
    const mitVorrat = vorrat.artikel.length > 0;
    const basis = (r: RezeptInfo): UebersichtEintrag => {
      const namen = zutaten.get(r.id) ?? [];
      return {
        r,
        zutaten: namen,
        zuKaufen: mitVorrat ? namen.filter((n) => einkaufStatus(n, vorrat.artikel).status === 'kaufen') : null,
        favorit: favoritIds.has(r.id),
        zuletzt: zuletzt.get(r.id),
      };
    };
    return filter.modus === 'suche'
      ? variantenZusammenfassen(sortiert(gefiltert).map(basis))
      : kuehlErgebnis.map(({ r, ...k }) => ({ ...basis(r), k }));
  });

  // ---------- Darstellung ----------
  let darstellung = $state<UebersichtModus>(einstellungen.uebersicht);
  let sucheOffen = $state(false);
  const DARSTELLUNGEN: { wert: UebersichtModus; icon: string; label: string }[] = [
    { wert: 'kacheln', icon: '▦', label: 'Kacheln' },
    { wert: 'details', icon: '☰', label: 'Details' },
    { wert: 'discover', icon: '▶', label: 'Discover' },
  ];
  function darstellungWechseln(d: UebersichtModus) {
    darstellung = d;
    einstellungen.uebersicht = d;
  }
  const discover = $derived(darstellung === 'discover');

  function zuruecksetzen() {
    filter.suche = '';
    filter.ernaehrung = '';
    filter.maxMin = 0;
    filter.favoriten = false;
  }

  function kuehlSetzen(neu: string[]) {
    filter.kuehlschrank = neu;
    einstellungen.kuehlschrank = neu;
  }

  function hinzufuegen(text = eingabe) {
    const neu = text
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && !filter.kuehlschrank.some((k) => k.toLowerCase() === t.toLowerCase()));
    if (neu.length) kuehlSetzen([...filter.kuehlschrank, ...neu]);
    eingabe = '';
  }

  function ausVorrat() {
    const namen = vorrat.artikel.filter((a) => (a.kategorie === 'Kühlschrank' || a.kategorie === 'Frisch') && a.status !== 'leer').map((a) => a.name);
    hinzufuegen(namen.join(','));
  }
</script>

<div class="seite-rand" class:discover>
  <div class="filter">
    <div class="werkzeuge">
      <div class="umschalter" role="group" aria-label="Modus">
        <button class:aktiv={filter.modus === 'suche'} onclick={() => (filter.modus === 'suche' && discover ? (sucheOffen = !sucheOffen) : (filter.modus = 'suche'))}>🔍 Suchen</button>
        <button class:aktiv={filter.modus === 'kuehlschrank'} onclick={() => (filter.modus = 'kuehlschrank')}>🧊 Kühlschrank</button>
      </div>
      <div class="umschalter" role="group" aria-label="Darstellung">
        {#each DARSTELLUNGEN as d (d.wert)}
          <button class:aktiv={darstellung === d.wert} onclick={() => darstellungWechseln(d.wert)} aria-label={d.label} title={d.label}>{d.icon}</button>
        {/each}
      </div>
    </div>

    {#if filter.modus === 'suche'}
      {#if !discover || sucheOffen || filter.suche}
        <input type="text" placeholder="Rezepte oder Zutaten suchen …" bind:value={filter.suche} aria-label="Suche" />
      {/if}
    {:else}
      <p class="hinweis">Was hast du da? Ich suche Rezepte, in denen das vorkommt.</p>
      <form
        class="eingabe"
        onsubmit={(e) => {
          e.preventDefault();
          hinzufuegen();
        }}
      >
        <ZutatVorschlagFeld
          bind:value={eingabe}
          {vorschlaege}
          ausschliessen={filter.kuehlschrank}
          placeholder="z. B. Paprika, Karotten …"
          label="Zutat hinzufügen"
          oninput={() => eingabe.includes(',') && hinzufuegen()}
          onwaehlen={(v) => hinzufuegen(v)}
        />
        <button class="knopf" type="submit" disabled={!eingabe.trim()}>＋</button>
      </form>
      <div class="tags">
        {#each filter.kuehlschrank as k (k)}
          <span class="chip-kuehl">
            {k}
            <button aria-label="{k} entfernen" onclick={() => kuehlSetzen(filter.kuehlschrank.filter((x) => x !== k))}>×</button>
          </span>
        {/each}
        {#if vorrat.artikel.length}
          <button class="tag klickbar" onclick={ausVorrat} title="Artikel der Kategorien Kühlschrank und Frisch, die da oder knapp sind">＋ aus Vorrat</button>
        {/if}
        {#if filter.kuehlschrank.length}
          <button class="tag klickbar" onclick={() => kuehlSetzen([])}>leeren</button>
        {/if}
      </div>
      {#if filter.kuehlschrank.length > 1}
        <div class="umschalter klein" role="group" aria-label="Verknüpfung">
          <button class:aktiv={filter.alle} onclick={() => (filter.alle = true)}>alle müssen drin sein</button>
          <button class:aktiv={!filter.alle} onclick={() => (filter.alle = false)}>mindestens eine</button>
        </div>
      {/if}
    {/if}

    <div class="chips" role="group" aria-label="Filter">
      {#if filter.modus === 'suche' && !discover}
        <label class="sortierung tag">
          <span aria-hidden="true">↕</span>
          <select value={sortierung} onchange={(e) => sortierungWechseln(e.currentTarget.value as Sortierung)} aria-label="Sortierung">
            {#each Object.entries(SORTIERUNGEN) as [wert, label] (wert)}<option value={wert}>{label}</option>{/each}
          </select>
        </label>
      {/if}
      {#if favoriten.eintraege.length || filter.favoriten}
        <button class="tag klickbar" class:aktiv={filter.favoriten} onclick={() => (filter.favoriten = !filter.favoriten)}>★ Favoriten</button>
      {/if}
      {#each ERNAEHRUNG as e (e)}
        <button class="tag klickbar" class:aktiv={filter.ernaehrung === e} onclick={() => (filter.ernaehrung = filter.ernaehrung === e ? '' : e)}>{ICON[e]} {e}</button>
      {/each}
      {#if filter.modus === 'suche'}
        <span class="trenner" aria-hidden="true"></span>
        {#each ZEITEN as z (z)}
          <button class="tag klickbar" class:aktiv={filter.maxMin === z} onclick={() => (filter.maxMin = filter.maxMin === z ? 0 : z)}>⏱ ≤ {z} min</button>
        {/each}
      {/if}
    </div>

    {#if filter.modus === 'suche'}
      {#if filterAktiv && geladen}
        <p class="anzahl">
          {gefiltert.length} von {rezepte.length} Rezepten
          <button class="link" onclick={zuruecksetzen}>Filter zurücksetzen</button>
        </p>
      {/if}
    {/if}
  </div>

  {#if fehler}
    <div class="fehlerbox">Rezepte konnten nicht geladen werden: {fehler}</div>
  {:else if geladen && rezepte.length === 0}
    <div class="leer">
      <p>Noch keine Rezepte vorhanden.</p>
      {#if istApp}<p><a class="knopf primaer" href="#/einstellungen">Mit Server synchronisieren</a></p>{/if}
      <p><a class="knopf" href="#/neu">Erstes Rezept anlegen</a></p>
    </div>
  {:else if geladen && filter.modus === 'kuehlschrank' && !filter.kuehlschrank.length}
    <div class="leer"><p>Füge oben hinzu, was im Kühlschrank liegt.</p></div>
  {:else if geladen && eintraege.length === 0}
    <div class="leer">
      {#if filter.modus === 'kuehlschrank' && filter.alle && filter.kuehlschrank.length > 1}
        <p>Kein Rezept enthält alles davon.</p>
        <p><button class="knopf" onclick={() => (filter.alle = false)}>Rezepte mit mindestens einer Zutat zeigen</button></p>
      {:else}
        <p>Nichts gefunden.</p>
      {/if}
    </div>
  {/if}

  {#if eintraege.length}
    {#if darstellung === 'discover'}
      <div class="discover-feed"><RezeptDiscover {eintraege} /></div>
    {:else if darstellung === 'details'}
      <RezeptDetails {eintraege} />
    {:else}
      <RezeptKacheln {eintraege} />
    {/if}
  {/if}
</div>

<style>
  .filter {
    padding: 1rem 0 0.5rem;
    display: grid;
    gap: 0.6rem;
  }
  .tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 -16px;
    padding: 0.1rem 16px;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chips .tag {
    flex: none;
    font-size: 0.85rem;
    padding: 0.3em 0.75em;
  }
  .chips .aktiv {
    background: var(--akzent);
    color: var(--akzent-text);
  }
  .sortierung {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    padding: 0 0.2em 0 0.7em !important;
  }
  .sortierung select {
    width: auto;
    field-sizing: content;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    padding: 0.3em 0.2em;
  }
  .trenner {
    flex: none;
    width: 1px;
    height: 1.2em;
    background: var(--linie);
  }
  .klickbar {
    border: 1px solid transparent;
    cursor: pointer;
  }
  .umschalter {
    display: inline-flex;
    justify-self: start;
    border: 1px solid var(--linie);
    border-radius: 8px;
    overflow: hidden;
  }
  .umschalter button {
    border: 0;
    background: var(--flaeche);
    color: var(--text);
    padding: 0.45em 0.9em;
    cursor: pointer;
    font: inherit;
  }
  .umschalter.klein button {
    font-size: 0.85rem;
    padding: 0.3em 0.7em;
  }
  .umschalter .aktiv {
    background: var(--akzent);
    color: var(--akzent-text);
  }
  .hinweis {
    margin: 0;
    color: var(--text-leise);
    font-size: 0.9rem;
  }
  .eingabe {
    display: flex;
    gap: 0.4rem;
  }
  .werkzeuge {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  @media (max-width: 480px) {
    .werkzeuge .umschalter button {
      padding: 0.4em 0.6em;
      font-size: 0.9rem;
    }
  }
  /* Discover: Filter oben, der Feed füllt den Rest des Bildschirms */
  .discover {
    height: calc(100dvh - 56px - env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
  }
  .discover .filter {
    padding: 0.6rem 0;
    gap: 0.5rem;
  }
  .discover-feed {
    flex: 1;
    min-height: 0;
    margin: 0 -16px;
    padding-bottom: env(safe-area-inset-bottom);
  }
  @media (max-width: 700px) {
    .discover-feed :global(.feed) {
      border-radius: 0;
    }
  }
  @media (min-width: 701px) {
    .discover-feed {
      margin: 0 0 1rem;
    }
  }
  .chip-kuehl {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    padding: 0.15em 0.3em 0.15em 0.7em;
    border-radius: 999px;
    background: var(--da-bg);
    color: var(--da);
    font-size: 0.9rem;
  }
  .chip-kuehl button {
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    font-size: 1.1em;
    line-height: 1;
    padding: 0 0.3em;
  }
  .anzahl {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-leise);
  }
  .link {
    border: 0;
    background: none;
    color: var(--akzent);
    cursor: pointer;
    text-decoration: underline;
    font: inherit;
    margin-left: 0.5em;
  }
  .leer {
    text-align: center;
    padding: 3rem 0;
    color: var(--text-leise);
  }
</style>
