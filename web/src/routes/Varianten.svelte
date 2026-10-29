<script lang="ts">
  import { formatDauer, vergleicheVarianten, variantenDerGruppe, type Rezept } from '@mrt/shared';
  import { store } from '../lib/app.ts';
  import type { RezeptVoll } from '../lib/storage/types.ts';
  import Bild from '../lib/components/Bild.svelte';

  /** Alle Varianten einer Gruppe nebeneinander: was alle gemeinsam haben, und was nur manche dazunehmen. */
  let { gruppe }: { gruppe: string } = $props();

  let varianten = $state<(RezeptVoll & { rezept: Rezept })[]>([]);
  let fehler = $state('');
  let geladen = $state(false);

  store
    .liste()
    .then((l) => Promise.all(variantenDerGruppe(l, gruppe).map((i) => store.laden(i.id))))
    .then((alle) => (varianten = alle.filter((d): d is RezeptVoll & { rezept: Rezept } => !!d.rezept)))
    .catch((e) => (fehler = (e as Error).message))
    .finally(() => (geladen = true));

  const zeilen = $derived(vergleicheVarianten(varianten.map((v) => v.rezept)));
  const basis = $derived(zeilen.filter((z) => z.basis));
  const extras = $derived(zeilen.filter((z) => !z.basis));
  const href = (v: RezeptVoll) => `#/rezept/${encodeURIComponent(v.id)}`;
</script>

<div class="seite-rand">
  <h1>⧉ {gruppe}</h1>
  {#if fehler}<div class="fehlerbox">{fehler}</div>{/if}
  {#if geladen && !varianten.length && !fehler}<p>Keine Rezepte in dieser Gruppe.</p>{/if}

  {#if varianten.length}
    <p class="leise">{varianten.length} Varianten. Tippe eine an, um sie zu öffnen; unten siehst du, was sie gemeinsam haben und was jede extra braucht.</p>
    <ul class="karten">
      {#each varianten as v (v.id)}
        <li>
          <a class="karte" href={href(v)}>
            <div class="bild"><Bild rezept={v} name={v.rezept.bilder[0]} breite={500} alt={v.rezept.titel} /></div>
            <div class="text">
              <h2>{v.rezept.variante?.name}</h2>
              {#if v.rezept.untertitel}<p class="unter">{v.rezept.untertitel}</p>{/if}
              <p class="meta">
                {#if v.rezept.zeit?.gesamt_min}<span>⏱ {formatDauer(v.rezept.zeit.gesamt_min)}{#if v.rezept.zeit.aktiv_min}{' '}(aktiv {formatDauer(v.rezept.zeit.aktiv_min)}){/if}</span>{/if}
                {#if v.rezept.portionen}<span>🍽 {v.rezept.portionen}</span>{/if}
                <span>🥄 {v.rezept.zutaten.length}</span>
              </p>
            </div>
          </a>
        </li>
      {/each}
    </ul>

    <h2 class="abschnitt">Zutaten im Vergleich</h2>
    <div class="tabelle-rahmen">
      <table>
        <thead>
          <tr>
            <th class="name"></th>
            {#each varianten as v (v.id)}<th><a href={href(v)}>{v.rezept.variante?.name}</a></th>{/each}
          </tr>
        </thead>
        <tbody>
          {#if basis.length}
            <tr class="gruppe"><th colspan={varianten.length + 1}>Gemeinsame Basis</th></tr>
            {#each basis as z (z.name)}
              <tr class:abweichend={z.abweichend}>
                <th class="name">{z.name}</th>
                {#each z.mengen as m, i (i)}<td>{m}</td>{/each}
              </tr>
            {/each}
          {/if}
          {#if extras.length}
            <tr class="gruppe"><th colspan={varianten.length + 1}>Extras – nur in manchen Varianten</th></tr>
            {#each extras as z (z.name)}
              <tr>
                <th class="name">{z.name}</th>
                {#each z.mengen as m, i (i)}<td class:hat={!!m} class:leer={!m}>{m || '–'}</td>{/each}
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    <p class="leise">Kursiv: in allen Varianten, aber unterschiedlich viel. Gleiche Zutaten innerhalb einer Variante (z. B. Butter für Teig und Streusel) sind zusammengezählt.</p>
  {/if}
</div>

<style>
  h1 {
    font-family: var(--serif);
    font-size: clamp(1.6rem, 4vw, 2.3rem);
    margin: 1rem 0 0.3rem;
  }
  .leise {
    color: var(--text-leise);
    font-size: 0.9rem;
  }
  .karten {
    list-style: none;
    padding: 0;
    margin: 0.8rem 0 0;
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
  .karte {
    display: block;
    height: 100%;
    text-decoration: none;
    background: var(--flaeche);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: var(--schatten);
  }
  .bild {
    aspect-ratio: 16 / 10;
    overflow: hidden;
  }
  .text {
    padding: 0.6rem 0.9rem 0.8rem;
  }
  .karte h2 {
    font-family: var(--serif);
    font-size: 1.1rem;
    margin: 0;
  }
  .unter {
    margin: 0.25rem 0 0;
    color: var(--text-leise);
    font-size: 0.85rem;
  }
  .meta {
    margin: 0.4rem 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    font-size: 0.85rem;
    color: var(--text-leise);
  }
  .abschnitt {
    font-family: var(--serif);
    font-size: 1.35rem;
    margin: 1.6rem 0 0.6rem;
  }
  .tabelle-rahmen {
    overflow-x: auto;
    border-radius: 10px;
    box-shadow: var(--schatten);
    background: var(--flaeche);
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }
  th,
  td {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--linie);
    text-align: left;
    white-space: nowrap;
  }
  thead th {
    font-weight: 700;
    vertical-align: bottom;
  }
  thead a {
    color: var(--akzent);
  }
  .name {
    position: sticky;
    left: 0;
    background: var(--flaeche);
    font-weight: 600;
    white-space: normal;
    min-width: 8rem;
  }
  .gruppe th {
    position: sticky;
    left: 0;
    background: var(--zutat-bg);
    font-family: var(--serif);
    font-size: 0.95rem;
  }
  .abweichend td {
    font-style: italic;
  }
  td.hat {
    color: var(--akzent);
    font-weight: 600;
  }
  td.leer {
    color: var(--text-leise);
  }
</style>
