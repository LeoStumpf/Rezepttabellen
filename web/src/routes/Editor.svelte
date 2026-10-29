<script lang="ts">
  import { EINHEITEN, ERNAEHRUNG, ernaehrungVon, neueId, pruefeRezept, slugify, type Rezept } from '@mrt/shared';
  import { store } from '../lib/app.ts';
  import { zurueck, zurueckZu } from '../lib/router.svelte.ts';
  import { bildVerkleinern, freierBildname } from '../lib/bild-verkleinern.ts';
  import { ApiFehler } from '../lib/storage/types.ts';
  import RezeptTabelle from '../lib/components/RezeptTabelle.svelte';
  import Markdown from '../lib/components/Markdown.svelte';
  import { geteilt, urlIn, vonWebseite } from '../lib/import.svelte.ts';

  let { id }: { id?: string } = $props();

  interface ZutatForm { id: string; menge: string; einheit: string; name: string; hinweis: string; auto: boolean }
  interface SchrittForm { id: string; text: string; nimmt: string[] }
  interface BildForm { name: string; url: string; blob?: Blob }

  let geladen = $state(!id);
  let basisRev = $state<number | null>(null);
  let slug = $state('');
  let rezeptId = $state(neueId());
  let titel = $state('');
  let untertitel = $state('');
  let variantenGruppe = $state('');
  let variantenName = $state('');
  let variantenNr = $state<number | undefined>();
  let portionen = $state('4');
  let gesamt = $state('');
  let aktiv = $state('');
  let tags = $state('');
  let quelleName = $state('');
  let quelleUrl = $state('');
  let videoUrl = $state('');
  let videoDatei = $state<string | null>(null);
  let bilder = $state<BildForm[]>([]);
  let zutaten = $state<ZutatForm[]>([]);
  let schritte = $state<SchrittForm[]>([]);
  let notizen = $state('');
  let notizenVorschau = $state(false);
  let speichernFehler = $state<string[]>([]);
  let speichert = $state(false);
  let ladeFehler = $state('');

  /** Formular aus einem Rezept füllen (Bearbeiten oder Import). */
  function fuellen(r: Rezept, notizenText: string) {
    rezeptId = r.id;
    titel = r.titel;
    untertitel = r.untertitel ?? '';
    variantenGruppe = r.variante?.gruppe ?? '';
    variantenName = r.variante?.name ?? '';
    variantenNr = r.variante?.nr;
    portionen = r.portionen ? String(r.portionen) : '';
    gesamt = r.zeit?.gesamt_min != null ? String(r.zeit.gesamt_min) : '';
    aktiv = r.zeit?.aktiv_min != null ? String(r.zeit.aktiv_min) : '';
    tags = r.tags.join(', ');
    quelleName = r.quelle?.name ?? '';
    quelleUrl = r.quelle?.url ?? '';
    videoUrl = r.video?.url ?? '';
    videoDatei = r.video?.datei ?? null;
    zutaten = r.zutaten.map((z) => ({
      id: z.id,
      menge: z.menge != null ? String(z.menge).replace('.', ',') : '',
      einheit: z.einheit ?? '',
      name: z.name,
      hinweis: z.hinweis ?? '',
      auto: false,
    }));
    schritte = r.schritte.map((s) => ({ id: s.id, text: s.text, nimmt: [...s.nimmt] }));
    notizen = notizenText;
  }

  if (id) {
    store
      .laden(id)
      .then((d) => {
        if (!d.rezept) throw new Error('rezept.yaml ist fehlerhaft – bitte direkt in der Datei korrigieren: ' + (d.fehler ?? []).join('; '));
        const r = d.rezept;
        basisRev = d.rev;
        slug = d.slug;
        fuellen(r, d.notizen);
        bilder = r.bilder.map((name) => ({ name, url: d.medien.some((m) => m.name === name) ? store.medienUrl(d, name, 400) : '' }));
        geladen = true;
      })
      .catch((e) => (ladeFehler = (e as Error).message));
  }

  // ---------- Import von einer Webseite (nur bei neuen Rezepten) ----------
  let importUrl = $state('');
  let importLaeuft = $state(false);
  let importFehler = $state('');
  let importHinweise = $state<string[]>([]);

  async function importStarten() {
    const url = urlIn(importUrl) ?? importUrl.trim();
    if (!url) return;
    importLaeuft = true;
    importFehler = '';
    importHinweise = [];
    try {
      const erg = await vonWebseite(url);
      fuellen(erg.rezept, erg.notizen);
      bilder = [];
      if (erg.bild) {
        const blob = await (await fetch(`data:image/jpeg;base64,${erg.bild}`)).blob();
        bilder = [{ name: 'bild-1.jpg', url: URL.createObjectURL(blob), blob }];
      }
      importHinweise = erg.hinweise;
      importUrl = '';
    } catch (e) {
      importFehler = (e as Error).message;
    } finally {
      importLaeuft = false;
    }
  }

  // Aus Chrome & Co. an die App geteilte Adresse
  $effect(() => {
    if (!id && geteilt.url) {
      importUrl = geteilt.url;
      geteilt.url = '';
      void importStarten();
    }
  });

  const zahl = (s: string) => {
    const n = Number(s.replace(',', '.').trim());
    return s.trim() && Number.isFinite(n) ? n : undefined;
  };

  function bauen(): Rezept {
    const g = zahl(gesamt);
    const a = zahl(aktiv);
    return {
      id: rezeptId,
      titel: titel.trim(),
      untertitel: untertitel.trim() || undefined,
      variante: variantenGruppe.trim() ? { gruppe: variantenGruppe.trim(), name: variantenName.trim() || titel.trim(), nr: variantenNr } : undefined,
      portionen: zahl(portionen),
      zeit: g != null || a != null ? { gesamt_min: g, aktiv_min: a } : undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      bilder: bilder.map((b) => b.name),
      quelle: quelleName.trim() || quelleUrl.trim() ? { name: quelleName.trim() || undefined, url: quelleUrl.trim() || undefined } : undefined,
      video: videoUrl.trim() || videoDatei ? { url: videoUrl.trim() || undefined, datei: videoDatei } : undefined,
      zutaten: zutaten.map((z) => ({
        id: z.id,
        menge: z.einheit === 'nach Geschmack' ? undefined : zahl(z.menge),
        einheit: (z.einheit || undefined) as Rezept['zutaten'][number]['einheit'],
        name: z.name.trim(),
        hinweis: z.hinweis.trim() || undefined,
      })),
      schritte: schritte.map((s) => ({ id: s.id, text: s.text.trim(), nimmt: s.nimmt })),
    };
  }

  const entwurf = $derived(bauen());
  const pruefung = $derived(pruefeRezept(JSON.parse(JSON.stringify(entwurf))));
  const hinweise = $derived([
    ...(bilder.length === 0 ? ['Mindestens ein Bild ist Pflicht.'] : []),
    ...(pruefung.ok ? [] : pruefung.fehler),
    ...zutaten.filter((z) => !schritte.some((s) => s.nimmt.includes(z.id))).map((z) => `Hinweis: „${z.name || z.id}“ wird in keinem Schritt verwendet.`),
  ]);
  const verwendetIn = $derived(new Map(schritte.flatMap((s) => s.nimmt.map((n) => [n, s.id] as const))));

  // ---------- Bilder ----------
  async function bilderHinzufuegen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    for (const datei of Array.from(input.files ?? [])) {
      const blob = await bildVerkleinern(datei);
      bilder.push({ name: freierBildname(bilder.map((b) => b.name), blob), url: URL.createObjectURL(blob), blob });
    }
    input.value = '';
  }
  function bildVerschieben(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= bilder.length) return;
    [bilder[i], bilder[j]] = [bilder[j], bilder[i]];
  }

  // ---------- Zutaten ----------
  function eindeutigeId(basis: string, ausser?: string): string {
    const belegt = new Set([...zutaten.map((z) => z.id), ...schritte.map((s) => s.id)].filter((x) => x !== ausser));
    let kandidat = basis || 'zutat';
    for (let i = 2; belegt.has(kandidat); i++) kandidat = `${basis}${i}`;
    return kandidat;
  }
  function zutatHinzufuegen() {
    zutaten.push({ id: eindeutigeId('zutat'), menge: '', einheit: 'g', name: '', hinweis: '', auto: true });
  }
  /** Automatische IDs werden aus dem Namen abgeleitet (lesbares YAML); Verweise werden mitgezogen. */
  function zutatBenannt(z: ZutatForm) {
    if (!z.auto || !z.name.trim()) return;
    const neu = eindeutigeId(slugify(z.name).replace(/-/g, '_').slice(0, 30), z.id);
    for (const s of schritte) s.nimmt = s.nimmt.map((n) => (n === z.id ? neu : n));
    z.id = neu;
    z.auto = false;
  }
  function zutatEntfernen(i: number) {
    const zid = zutaten[i].id;
    for (const s of schritte) s.nimmt = s.nimmt.filter((n) => n !== zid);
    zutaten.splice(i, 1);
  }
  function verschieben<T>(liste: T[], i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }

  // ---------- Schritte ----------
  function schrittHinzufuegen() {
    let n = schritte.length + 1;
    while (schritte.some((s) => s.id === `s${n}`)) n++;
    schritte.push({ id: `s${n}`, text: '', nimmt: [] });
  }
  function schrittEntfernen(i: number) {
    const sid = schritte[i].id;
    for (const s of schritte) s.nimmt = s.nimmt.filter((n) => n !== sid);
    schritte.splice(i, 1);
  }
  function umschalten(s: SchrittForm, ref: string) {
    s.nimmt = s.nimmt.includes(ref) ? s.nimmt.filter((n) => n !== ref) : [...s.nimmt, ref];
  }
  const schrittName = (i: number) => {
    const t = schritte[i].text.trim();
    return `Schritt ${i + 1}${t ? ': ' + (t.length > 24 ? t.slice(0, 24) + '…' : t) : ''}`;
  };

  // ---------- Speichern ----------
  async function speichern() {
    speichernFehler = [];
    if (bilder.length === 0) {
      speichernFehler = ['Mindestens ein Bild ist Pflicht.'];
      return;
    }
    if (!pruefung.ok) {
      speichernFehler = pruefung.fehler;
      return;
    }
    speichert = true;
    try {
      const neue: Record<string, Blob> = {};
      for (const b of bilder) if (b.blob) neue[b.name] = b.blob;
      const res = await store.speichern(pruefung.rezept, notizen, neue, basisRev);
      zurueckZu(`/rezept/${encodeURIComponent(res.id)}`);
    } catch (e) {
      const f = e as ApiFehler;
      speichernFehler = [f.message, ...(Array.isArray(f.details) ? f.details.map(String) : [])];
    } finally {
      speichert = false;
    }
  }
</script>

<div class="seite-rand editor">
  {#if ladeFehler}
    <div class="fehlerbox">{ladeFehler}</div>
  {:else if geladen}
    <h1>{id ? 'Rezept bearbeiten' : 'Neues Rezept'}</h1>
    {#if slug}<p class="leise">Ordner: <code>rezepte/{slug}/</code></p>{/if}

    {#if !id}
      <section class="karte import">
        <h2>🌐 Von einer Webseite übernehmen</h2>
        <form
          class="import-zeile"
          onsubmit={(e) => {
            e.preventDefault();
            void importStarten();
          }}
        >
          <input type="text" inputmode="url" autocomplete="off" bind:value={importUrl} placeholder="https://www.chefkoch.de/rezepte/…" aria-label="Adresse des Rezepts" />
          <button class="knopf primaer" type="submit" disabled={importLaeuft || !importUrl.trim()}>{importLaeuft ? 'Lädt …' : 'Übernehmen'}</button>
        </form>
        <p class="leise">Klappt bei fast allen Rezeptseiten. Tipp: In Chrome „Teilen“ → Rezepttabellen. Danach hier prüfen und speichern.</p>
        {#if importFehler}<div class="fehlerbox">{importFehler}</div>{/if}
        {#if importHinweise.length}
          <ul class="import-hinweise">{#each importHinweise as h (h)}<li>{h}</li>{/each}</ul>
        {/if}
      </section>
    {/if}

    <section class="karte">
      <h2>Bilder <span class="pflicht">(mindestens eins)</span></h2>
      <div class="bilder">
        {#each bilder as b, i (b.name)}
          <figure class:haupt={i === 0}>
            {#if b.url}<img src={b.url} alt={b.name} />{:else}<div class="fehlt">fehlt:<br />{b.name}</div>{/if}
            <figcaption>
              {i === 0 ? 'Hauptbild' : b.name}
              <span>
                <button type="button" onclick={() => bildVerschieben(i, -1)} aria-label="nach vorne">◀</button>
                <button type="button" onclick={() => bildVerschieben(i, 1)} aria-label="nach hinten">▶</button>
                <button type="button" onclick={() => bilder.splice(i, 1)} aria-label="entfernen">✕</button>
              </span>
            </figcaption>
          </figure>
        {/each}
        <label class="hinzu">
          <input type="file" accept="image/*" multiple onchange={bilderHinzufuegen} />
          <span>＋ Bild hinzufügen</span>
        </label>
      </div>
    </section>

    <section class="karte raster2">
      <div class="breit"><label>Titel <input type="text" bind:value={titel} placeholder="z. B. Linguine mit karamellisierten Zwiebeln" /></label></div>
      <div class="breit"><label>Untertitel <input type="text" bind:value={untertitel} /></label></div>
      <label>Variante von (Gruppe) <input type="text" bind:value={variantenGruppe} placeholder="z. B. Apfelkuchen" /></label>
      <label>Name der Variante <input type="text" bind:value={variantenName} placeholder="z. B. mit Streuseln" disabled={!variantenGruppe.trim()} /></label>
      <label>Portionen <input type="text" inputmode="numeric" bind:value={portionen} /></label>
      <div>
        <label>Tags (kommagetrennt) <input type="text" bind:value={tags} placeholder="Pasta, Vegetarisch" /></label>
        {#if !ernaehrungVon(tags.split(','))}
          <p class="tag-hinweis">
            Ernährung für den Filter:
            {#each ERNAEHRUNG as e (e)}
              <button type="button" class="chip" onclick={() => (tags = [e, tags.trim()].filter(Boolean).join(', '))}>{e}</button>
            {/each}
          </p>
        {/if}
      </div>
      <label>Gesamtzeit (min) <input type="text" inputmode="numeric" bind:value={gesamt} /></label>
      <label>Aktive Zeit (min) <input type="text" inputmode="numeric" bind:value={aktiv} /></label>
      <label>Quelle (Name) <input type="text" bind:value={quelleName} /></label>
      <label>Quelle (Link) <input type="url" bind:value={quelleUrl} placeholder="https://…" /></label>
      <div class="breit"><label>Video (Link) <input type="url" bind:value={videoUrl} placeholder="https://…" /></label></div>
    </section>

    <section class="karte">
      <h2>Zutaten</h2>
      <p class="leise">Deutsche Einheiten und praxistaugliche Mengen (z. B. 500 g Nudeln = 1 Packung).</p>
      <div class="zutaten">
        {#each zutaten as z, i (z)}
          <div class="zutat">
            <input class="menge" type="text" inputmode="decimal" bind:value={z.menge} placeholder="Menge" disabled={z.einheit === 'nach Geschmack'} aria-label="Menge" />
            <select bind:value={z.einheit} aria-label="Einheit">
              <option value="">–</option>
              {#each EINHEITEN as e (e)}<option value={e}>{e}</option>{/each}
            </select>
            <input type="text" bind:value={z.name} onblur={() => zutatBenannt(z)} placeholder="Zutat" aria-label="Zutat" />
            <input type="text" bind:value={z.hinweis} placeholder="Hinweis (optional)" aria-label="Hinweis" />
            <span class="werkzeug">
              <button type="button" onclick={() => verschieben(zutaten, i, -1)} aria-label="hoch">▲</button>
              <button type="button" onclick={() => verschieben(zutaten, i, 1)} aria-label="runter">▼</button>
              <button type="button" onclick={() => zutatEntfernen(i)} aria-label="entfernen">✕</button>
            </span>
          </div>
        {/each}
      </div>
      <button type="button" class="knopf" onclick={zutatHinzufuegen}>＋ Zutat</button>
    </section>

    <section class="karte">
      <h2>Arbeitsschritte</h2>
      <p class="leise">Jeder Schritt verarbeitet Zutaten und/oder Ergebnisse früherer Schritte. Daraus entsteht die Rezepttabelle.</p>
      {#each schritte as s, i (s)}
        <div class="schritt">
          <div class="schritt-kopf">
            <strong>Schritt {i + 1}</strong>
            <span class="werkzeug">
              <button type="button" onclick={() => verschieben(schritte, i, -1)} aria-label="hoch">▲</button>
              <button type="button" onclick={() => verschieben(schritte, i, 1)} aria-label="runter">▼</button>
              <button type="button" onclick={() => schrittEntfernen(i)} aria-label="entfernen">✕</button>
            </span>
          </div>
          <textarea rows="2" bind:value={s.text} placeholder="z. B. fein hacken"></textarea>
          <div class="chips">
            <span class="leise">nimmt:</span>
            {#each zutaten as z (z.id)}
              {@const belegt = verwendetIn.get(z.id)}
              {#if !belegt || belegt === s.id}
                <button type="button" class="chip" class:an={s.nimmt.includes(z.id)} onclick={() => umschalten(s, z.id)}>{z.name || z.id}</button>
              {/if}
            {/each}
            {#each schritte.slice(0, i) as v, j (v.id)}
              {@const belegt = verwendetIn.get(v.id)}
              {#if !belegt || belegt === s.id}
                <button type="button" class="chip schritt-chip" class:an={s.nimmt.includes(v.id)} onclick={() => umschalten(s, v.id)}>→ {schrittName(j)}</button>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
      <button type="button" class="knopf" onclick={schrittHinzufuegen}>＋ Schritt</button>

      {#if entwurf.zutaten.length}
        <h3>Vorschau</h3>
        <div class="vorschau"><RezeptTabelle rezept={entwurf} /></div>
      {/if}
    </section>

    <section class="karte">
      <div class="notiz-kopf">
        <h2>Notizen &amp; ausführliche Anleitung</h2>
        <button type="button" class="knopf" onclick={() => (notizenVorschau = !notizenVorschau)}>{notizenVorschau ? 'Bearbeiten' : 'Vorschau'}</button>
      </div>
      {#if notizenVorschau}
        <Markdown text={notizen} />
      {:else}
        <textarea rows="10" bind:value={notizen} placeholder="## Tipps&#10;- …"></textarea>
        <p class="leise">Markdown: <code>## Überschrift</code>, <code>- Liste</code>, <code>**fett**</code></p>
      {/if}
    </section>

    {#if hinweise.length}
      <div class="hinweise">
        <ul>{#each hinweise as h (h)}<li>{h}</li>{/each}</ul>
      </div>
    {/if}
    {#if speichernFehler.length}
      <div class="fehlerbox"><ul>{#each speichernFehler as f (f)}<li>{f}</li>{/each}</ul></div>
    {/if}

    <div class="leiste">
      <button type="button" class="knopf" onclick={zurueck}>Abbrechen</button>
      <button type="button" class="knopf primaer" onclick={speichern} disabled={speichert}>{speichert ? 'Speichert …' : 'Speichern'}</button>
    </div>
  {/if}
</div>

<style>
  .editor {
    padding-bottom: 6rem;
  }
  h1 {
    font-family: var(--serif);
    margin: 1.2rem 0 0.2rem;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.2rem;
    margin: 0 0 0.6rem;
  }
  h3 {
    font-size: 1rem;
    margin: 1.2rem 0 0.5rem;
  }
  .leise {
    color: var(--text-leise);
    font-size: 0.85rem;
    margin: 0 0 0.6rem;
  }
  .pflicht {
    font-size: 0.8rem;
    color: var(--warn);
    font-family: var(--sans);
    font-weight: normal;
  }
  .import-zeile {
    display: flex;
    gap: 0.5rem;
  }
  .import-zeile input {
    flex: 1;
    min-width: 0;
  }
  .import-hinweise {
    margin: 0.4rem 0 0;
    padding-left: 1.2rem;
    color: var(--warn);
    font-size: 0.9rem;
  }
  .karte {
    background: var(--flaeche);
    border-radius: 12px;
    box-shadow: var(--schatten);
    padding: 1rem;
    margin: 1rem 0;
  }
  .raster2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }
  .raster2 .breit {
    grid-column: 1 / -1;
  }
  @media (max-width: 640px) {
    .raster2 {
      grid-template-columns: 1fr;
    }
  }
  .bilder {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
  }
  figure {
    margin: 0;
    width: 150px;
    border: 1px solid var(--linie);
    border-radius: 8px;
    overflow: hidden;
  }
  figure.haupt {
    border-color: var(--akzent);
    border-width: 2px;
  }
  figure img,
  .fehlt {
    width: 100%;
    height: 110px;
    object-fit: cover;
    display: block;
  }
  .fehlt {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--warn);
    font-size: 0.8rem;
    background: var(--zutat-bg);
  }
  figcaption {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    padding: 0.2rem 0.3rem;
    gap: 0.2rem;
  }
  figcaption button,
  .werkzeug button {
    border: 0;
    background: none;
    cursor: pointer;
    padding: 0.2rem 0.3rem;
    color: var(--text-leise);
  }
  .hinzu {
    width: 150px;
    height: 136px;
    border: 2px dashed var(--linie);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text);
    font-size: 0.9rem;
  }
  .hinzu input {
    display: none;
  }
  .zutaten {
    display: grid;
    gap: 0.4rem;
    margin-bottom: 0.7rem;
  }
  .zutat {
    display: grid;
    grid-template-columns: 5.5rem 8rem 1fr 1fr auto;
    gap: 0.4rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .zutat {
      grid-template-columns: 4.5rem 6.5rem 1fr auto;
    }
    .zutat input:nth-of-type(3) {
      grid-column: 1 / 4;
      grid-row: 2;
    }
    .zutat {
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--linie);
    }
  }
  .werkzeug {
    white-space: nowrap;
  }
  .schritt {
    border: 1px solid var(--linie);
    border-radius: 8px;
    padding: 0.6rem;
    margin-bottom: 0.6rem;
  }
  .schritt-kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.3rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    margin-top: 0.4rem;
  }
  .chips .leise {
    margin: 0;
  }
  .chip {
    border: 1px solid var(--linie);
    background: var(--bg);
    border-radius: 999px;
    padding: 0.15em 0.7em;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .chip.an {
    background: var(--akzent);
    border-color: var(--akzent);
    color: var(--akzent-text);
  }
  .chip:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .schritt-chip {
    font-style: italic;
  }
  .vorschau {
    container-type: inline-size;
    overflow-x: auto;
  }
  .notiz-kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .hinweise {
    color: var(--warn);
    font-size: 0.9rem;
  }
  .leiste {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.7rem 16px;
    padding-bottom: calc(0.7rem + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(6px);
    border-top: 1px solid var(--linie);
  }
  .tag-hinweis {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--text-leise);
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
</style>
