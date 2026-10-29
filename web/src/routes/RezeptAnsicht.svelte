<script lang="ts">
  import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
  import { SvelteSet } from 'svelte/reactivity';
  import { formatDauer, formatMenge, skaliereMenge, berechneLayout, ernaehrungVon, rezeptAlsText, type Ernaehrung, type Rezept } from '@mrt/shared';
  import { store, istApp } from '../lib/app.ts';
  import { zurueckZu } from '../lib/router.svelte.ts';
  import { einstellungen, type Ansicht } from '../lib/einstellungen.ts';
  import { zurueckSchliesst } from '../lib/zurueck.ts';
  import { bildVerkleinern, freierBildname } from '../lib/bild-verkleinern.ts';
  import type { RezeptVoll } from '../lib/storage/types.ts';
  import Bild from '../lib/components/Bild.svelte';
  import RezeptTabelle from '../lib/components/RezeptTabelle.svelte';
  import TabellenZoom from '../lib/components/TabellenZoom.svelte';
  import SchrittKarten from '../lib/components/SchrittKarten.svelte';
  import Markdown from '../lib/components/Markdown.svelte';
  import ZutatPopover from '../lib/components/ZutatPopover.svelte';
  import MengeDialog from '../lib/components/MengeDialog.svelte';
  import GekochtDialog from '../lib/components/GekochtDialog.svelte';
  import SchrittText from '../lib/components/SchrittText.svelte';
  import VariantenLeiste from '../lib/components/VariantenLeiste.svelte';
  import { aufDieListe } from '../lib/einkauf.ts';
  import { favoritUmschalten, gekochtEintragen, gekochtVon, istFavorit, vorWann } from '../lib/verlauf.ts';
  import { gekocht } from '../lib/sammlung.svelte.ts';
  import { teilen } from '../lib/teilen.ts';
  import { zeigeMeldung } from '../lib/meldung.svelte.ts';
  import { vorrat, vorratLaden, statusVon, vorratMarkierung, VORRAT_ICON } from '../lib/vorrat.svelte.ts';
  import type { Zutat } from '@mrt/shared';

  let { id }: { id: string } = $props();

  let daten = $state<RezeptVoll | null>(null);
  let fehler = $state('');
  let aktivesBild = $state(0);
  let ansicht = $state<Ansicht>(einstellungen.ansicht);
  let loeschenBestaetigen = $state(false);
  let videoLaden = $state(false);
  let einkauf = $state(einstellungen.einkauf);
  let gewaehlteZutat = $state<Zutat | null>(null);
  let mengeZutat = $state<Zutat | null>(null);
  /** Umrechnung der Mengen (nur Anzeige, wird nicht gespeichert) */
  let faktor = $state(1);
  let menueOffen = $state(false);
  let speichert = $state('');
  let fotoInput = $state<HTMLInputElement>();

  if (!vorrat.geladen) void vorratLaden();

  function laden() {
    return store
      .laden(id)
      .then((d) => (daten = d))
      .catch((e) => (fehler = (e as Error).message));
  }
  void laden();
  // Auto-Sync der App hat neue Daten geholt
  $effect(() => {
    const neu = () => void laden();
    window.addEventListener('sync-fertig', neu);
    return () => window.removeEventListener('sync-fertig', neu);
  });

  const r = $derived(daten?.rezept ?? null);
  const vorhandeneBilder = $derived(r && daten ? r.bilder.filter((b) => daten!.medien.some((m) => m.name === b)) : []);
  const reihenfolge = $derived(r ? berechneLayout(r).reihenfolge : []);

  const einkaufListe = $derived(
    r && einkauf ? r.zutaten.filter((z) => z.name).map((z) => ({ z, ...statusVon(z.name) })) : [],
  );
  const zuKaufen = $derived(einkaufListe.filter((e) => e.status === 'kaufen'));
  const knapp = $derived(einkaufListe.filter((e) => e.status === 'knapp'));

  // ---------- Einkaufsliste, Favorit, Kochverlauf, Teilen ----------
  const favorit = $derived(istFavorit(id));
  const verlauf = $derived(gekochtVon(id));
  let gekochtFragen = $state(false);

  async function aufListe(zutaten: Zutat[]) {
    if (!r || !zutaten.length) return;
    menueOffen = false;
    const n = await aufDieListe(r.titel, zutaten, faktor);
    zeigeMeldung(`${n} ${n === 1 ? 'Zutat' : 'Zutaten'} auf der Einkaufsliste`, { href: '#/einkauf', text: 'Liste' });
  }
  /** Ohne Vorrat: alles außer „nach Geschmack“; mit Vorrat: was fehlt */
  const fehlendeZutaten = () =>
    (r?.zutaten ?? []).filter((z) => z.name && z.einheit !== 'nach Geschmack' && (!vorrat.artikel.length || statusVon(z.name).status === 'kaufen'));

  function rezeptTeilen(nurZutaten: boolean) {
    if (!r || !daten) return;
    menueOffen = false;
    const basis = istApp ? einstellungen.serverUrl : location.origin;
    const link = basis ? `${basis}/#/rezept/${encodeURIComponent(daten.id)}` : undefined;
    void teilen(r.titel, rezeptAlsText(r, { faktor, nurZutaten, link }));
  }

  function verlaufLoeschen(g: (typeof verlauf)[number]) {
    void gekocht.loeschen([g]);
  }

  const anzahl = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const portionen = $derived(r?.portionen ? r.portionen * faktor : null);
  function portionenAendern(d: 1 | -1) {
    if (!r?.portionen || !portionen) return;
    const neu = d > 0 ? Math.floor(portionen + 1e-9) + 1 : Math.max(1, Math.ceil(portionen - 1e-9) - 1);
    faktor = neu / r.portionen;
  }

  function einkaufUmschalten() {
    einkauf = !einkauf;
    einstellungen.einkauf = einkauf;
  }

  function ansichtWechseln(a: Ansicht) {
    ansicht = a;
    einstellungen.ansicht = a;
  }

  $effect(() => {
    if (menueOffen) return zurueckSchliesst(() => (menueOffen = false));
  });

  async function loeschen() {
    if (!daten) return;
    try {
      await store.loeschen(daten.id, daten.rev);
      zurueckZu('/');
    } catch (e) {
      fehler = (e as Error).message;
    }
  }

  // ---------- Bilder direkt im Rezept ----------
  async function rezeptSpeichern(neu: Rezept, medien: Record<string, Blob>, was: string) {
    if (!daten) return;
    speichert = was;
    fehler = '';
    try {
      await store.speichern(neu, daten.notizen, medien, daten.rev);
      await laden();
    } catch (e) {
      fehler = `Speichern fehlgeschlagen: ${(e as Error).message}`;
    } finally {
      speichert = '';
    }
  }

  async function bildHinzufuegen(blob: Blob) {
    if (!r || !daten) return;
    const name = freierBildname([...r.bilder, ...daten.medien.map((m) => m.name)], blob);
    // nur Bilder behalten, die es wirklich gibt – sonst blockiert ein toter Eintrag das neue Hauptbild
    const bilder = [...vorhandeneBilder, name];
    await rezeptSpeichern({ ...$state.snapshot(r), bilder }, { [name]: blob }, 'Foto wird gespeichert …');
    aktivesBild = bilder.length - 1;
  }

  async function fotoAufnehmen() {
    if (!istApp) return fotoInput?.click();
    try {
      const foto = await Camera.getPhoto({ source: CameraSource.Prompt, resultType: CameraResultType.Uri, quality: 85, width: 2000, promptLabelHeader: 'Foto hinzufügen', promptLabelPhoto: 'Aus der Galerie', promptLabelPicture: 'Foto aufnehmen', promptLabelCancel: 'Abbrechen' });
      if (foto.webPath) await bildHinzufuegen(await (await fetch(foto.webPath)).blob());
    } catch (e) {
      if (!/cancel/i.test((e as Error)?.message ?? '')) fehler = `Kamera: ${(e as Error).message}`;
    }
  }

  async function dateiGewaehlt(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const datei = input.files?.[0];
    input.value = '';
    if (datei) await bildHinzufuegen(await bildVerkleinern(datei));
  }

  async function alsHauptbild(i: number) {
    if (!r) return;
    const name = vorhandeneBilder[i];
    await rezeptSpeichern({ ...$state.snapshot(r), bilder: [name, ...r.bilder.filter((b) => b !== name)] }, {}, 'Hauptbild wird gesetzt …');
    aktivesBild = 0;
  }

  // ---------- Kochmodus: Bildschirm bleibt an, Schritte abhaken ----------
  const kochSchluessel = `mrt.kochen.${id}`;
  const abgehakt = new SvelteSet<string>(gespeichertAbgehakt());
  let kochen = $state(abgehakt.size > 0);

  /** Abgehakte Schritte überleben einen Neustart der App, aber nicht bis zum nächsten Tag. */
  function gespeichertAbgehakt(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(kochSchluessel) ?? 'null');
      return v && Date.now() - v.zeit < 12 * 3600_000 && Array.isArray(v.ids) ? v.ids : [];
    } catch {
      return [];
    }
  }
  function haken(sid: string) {
    if (abgehakt.has(sid)) abgehakt.delete(sid);
    else abgehakt.add(sid);
    try {
      localStorage.setItem(kochSchluessel, JSON.stringify({ zeit: Date.now(), ids: [...abgehakt] }));
    } catch {
      /* egal */
    }
  }
  function kochenUmschalten() {
    kochen = !kochen;
    if (!kochen) {
      if (abgehakt.size) gekochtFragen = true;
      abgehakt.clear();
      try {
        localStorage.removeItem(kochSchluessel);
      } catch {
        /* egal */
      }
    } else if (ansicht === 'tabelle') ansicht = 'schritte'; // abhaken geht in den Karten
  }
  $effect(() => {
    if (!kochen || !('wakeLock' in navigator)) return;
    let sperre: WakeLockSentinel | null = null;
    const anfordern = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((s) => (sperre = s), () => {});
    };
    anfordern();
    document.addEventListener('visibilitychange', anfordern);
    return () => {
      document.removeEventListener('visibilitychange', anfordern);
      void sperre?.release();
    };
  });

  const ERNAEHRUNG_ICON: Record<Ernaehrung, string> = { Vegan: '🌱', Vegetarisch: '🥕', Pescetarisch: '🐟', Fleisch: '🍖' };
</script>

{#if gewaehlteZutat}<ZutatPopover zutat={gewaehlteZutat} onclose={() => (gewaehlteZutat = null)} />{/if}
{#if gekochtFragen && r}
  <GekochtDialog
    titel={r.titel}
    oneintragen={(b, n) => {
      void gekochtEintragen(id, b, n);
      zeigeMeldung('Im Kochverlauf eingetragen');
    }}
    onclose={() => (gekochtFragen = false)}
  />
{/if}
{#if mengeZutat}<MengeDialog zutat={mengeZutat} {faktor} onfaktor={(f) => (faktor = f)} onclose={() => (mengeZutat = null)} />{/if}
<input bind:this={fotoInput} type="file" accept="image/*" onchange={dateiGewaehlt} hidden />

<div class="seite-rand">
  {#if fehler}
    <div class="fehlerbox">{fehler}</div>
  {/if}

  {#if daten && !r}
    <div class="fehlerbox">
      <strong>rezept.yaml enthält Fehler</strong> (Ordner <code>{daten.slug}</code>):
      <ul>{#each daten.fehler ?? [] as f (f)}<li>{f}</li>{/each}</ul>
    </div>
  {/if}

  {#if daten && r}
    <article>
      <div class="held">
        <div class="hauptbild">
          <Bild rezept={daten} name={vorhandeneBilder[aktivesBild]} breite={1600} alt={r.titel} ganz />
          {#if aktivesBild > 0 && vorhandeneBilder[aktivesBild]}
            <button class="knopf hauptbild-knopf nicht-drucken" onclick={() => alsHauptbild(aktivesBild)} disabled={!!speichert}>★ Als Hauptbild</button>
          {/if}
        </div>
        {#if vorhandeneBilder.length > 1}
          <div class="vorschau">
            {#each vorhandeneBilder as b, i (b)}
              <button class:aktiv={i === aktivesBild} onclick={() => (aktivesBild = i)} aria-label="Bild {i + 1}">
                <Bild rezept={daten} name={b} breite={200} />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <header class="titel">
        <div class="titelzeile">
          <h1>{r.titel}</h1>
          <button class="stern nicht-drucken" class:an={favorit} onclick={() => favoritUmschalten(id)} aria-pressed={favorit} aria-label={favorit ? 'Kein Favorit mehr' : 'Als Favorit merken'}>{favorit ? '★' : '☆'}</button>
        </div>
        {#if r.untertitel}<p class="unter">{r.untertitel}</p>{/if}
        {#if r.variante}<VariantenLeiste gruppe={r.variante.gruppe} id={daten.id} />{/if}
        <p class="meta">
          {#if r.portionen && portionen}
            <span class="portionen">
              🍽
              <button class="mini nicht-drucken" onclick={() => portionenAendern(-1)} disabled={portionen <= 1} aria-label="Weniger Portionen">−</button>
              <span class:skaliert={faktor !== 1}>{anzahl(portionen)} {portionen === 1 ? 'Portion' : 'Portionen'}</span>
              <button class="mini nicht-drucken" onclick={() => portionenAendern(1)} aria-label="Mehr Portionen">+</button>
            </span>
          {/if}
          {#if r.zeit?.gesamt_min}<span>⏱ {formatDauer(r.zeit.gesamt_min)}{#if r.zeit.aktiv_min}{' '}(aktiv {formatDauer(r.zeit.aktiv_min)}){/if}</span>{/if}
          {#if ernaehrungVon(r.tags)}{@const e = ernaehrungVon(r.tags)!}<span>{ERNAEHRUNG_ICON[e]} {e}</span>{/if}
          {#if verlauf.length}<button class="gekocht-info" onclick={() => document.getElementById('verlauf')?.scrollIntoView({ behavior: 'smooth' })}>✓ zuletzt gekocht {vorWann(verlauf[0].datum)}{#if verlauf.length > 1}{' '}· {verlauf.length}×{/if}</button>{/if}
        </p>
        {#if vorhandeneBilder.length === 0}
          <p class="warnhinweis">⚠ Dieses Rezept hat noch kein Bild. Tippe auf „📷 Foto“, um eines hinzuzufügen.</p>
        {/if}
        <div class="aktionen nicht-drucken">
          <a class="knopf" href="#/bearbeiten/{encodeURIComponent(daten.id)}">✎ Bearbeiten</a>
          <button class="knopf" onclick={fotoAufnehmen} disabled={!!speichert}>📷 Foto</button>
          <button class="knopf" class:an={kochen} onclick={kochenUmschalten} aria-pressed={kochen} title="Bildschirm bleibt an, Schritte abhaken">👩‍🍳 Kochen</button>
          <div class="menue">
            <button class="knopf" onclick={() => (menueOffen = !menueOffen)} aria-expanded={menueOffen} aria-label="Weitere Aktionen">⋯</button>
            {#if menueOffen}
              <div class="menue-hintergrund" role="presentation" onclick={() => { menueOffen = false; loeschenBestaetigen = false; }}></div>
              <div class="menue-liste" role="menu">
                <button role="menuitem" onclick={() => aufListe(fehlendeZutaten())}>🛒 Auf die Einkaufsliste</button>
                <button role="menuitem" onclick={() => { menueOffen = false; gekochtFragen = true; }}>✓ Gekocht eintragen</button>
                <button role="menuitem" onclick={() => rezeptTeilen(false)}>↗ Rezept teilen</button>
                <button role="menuitem" onclick={() => rezeptTeilen(true)}>↗ Zutaten teilen</button>
                <a role="menuitem" href="#/druck/{encodeURIComponent(daten.id)}">🖨 A4-Ansicht</a>
                {#if !istApp}<a role="menuitem" href="/api/rezepte/{encodeURIComponent(daten.id)}/pdf">⤓ PDF</a>{/if}
                {#if loeschenBestaetigen}
                  <button role="menuitem" class="gefahr" onclick={loeschen}>Wirklich löschen?</button>
                {:else}
                  <button role="menuitem" class="gefahr" onclick={() => (loeschenBestaetigen = true)}>🗑 Löschen</button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        {#if speichert}<p class="leise">{speichert}</p>{/if}
      </header>

      <section>
        <div class="abschnitt-kopf">
          <h2>Rezept</h2>
          <div class="kopf-rechts nicht-drucken">
            <button class="knopf einkauf-knopf" class:an={einkauf} onclick={einkaufUmschalten} aria-pressed={einkauf} aria-label="Einkaufsansicht">🛒</button>
            <div class="umschalter" role="group" aria-label="Darstellung">
              <button class:aktiv={ansicht === 'schritte'} onclick={() => ansichtWechseln('schritte')}>Schritte</button>
              <button class:aktiv={ansicht === 'tabelle'} onclick={() => ansichtWechseln('tabelle')}>Tabelle</button>
              <button class:aktiv={ansicht === 'liste'} onclick={() => ansichtWechseln('liste')}>Liste</button>
            </div>
          </div>
        </div>
        {#if faktor !== 1}
          <p class="umgerechnet">
            Mengen umgerechnet (×{faktor.toLocaleString('de-DE', { maximumFractionDigits: 2 })}), Angaben in den Schritttexten gelten fürs Original.
            <button class="link" onclick={() => (faktor = 1)}>Original</button>
          </p>
        {:else}
          <p class="tipp nicht-drucken">Menge antippen, um das Rezept auf das umzurechnen, was du da hast.</p>
        {/if}
        {#if einkauf}
          <div class="einkauf-info">
            {#if vorrat.fehler}<span class="status-kaufen">Vorrat nicht erreichbar: {vorrat.fehler}</span>
            {:else if zuKaufen.length === 0}<strong class="status-da">✓ Alles da!</strong>{#if knapp.length} Nur knapp: {knapp.map((e) => e.z.name).join(', ')}.{/if}
            {:else}
              <strong class="status-kaufen">🛒 Zu kaufen: {zuKaufen.length} von {einkaufListe.length}</strong> – {zuKaufen.map((e) => e.z.name).join(', ')}{#if knapp.length}{" "}<span class="status-knapp">· ⚠ knapp: {knapp.map((e) => e.z.name).join(', ')}</span>{/if}
            {/if}
            {#if zuKaufen.length || knapp.length}
              <span class="liste-knoepfe">
                {#if zuKaufen.length}<button class="knopf primaer" onclick={() => aufListe(zuKaufen.map((e) => e.z))}>🛒 {zuKaufen.length} auf die Einkaufsliste</button>{/if}
                {#if knapp.length}<button class="knopf" onclick={() => aufListe(knapp.map((e) => e.z))}>＋ {knapp.length} knappe</button>{/if}
              </span>
            {/if}
            <span class="leise">Zutat antippen, um den Vorrat zu ändern · <a href="#/vorrat">Vorrat öffnen</a> · <a href="#/einkauf">Einkaufsliste</a></span>
          </div>
        {/if}
        {#if ansicht === 'schritte'}
          <SchrittKarten rezept={r} {einkauf} {faktor} timerTitel={r.titel} abgehakt={kochen ? abgehakt : undefined} onhaken={haken} onzutat={(z) => (gewaehlteZutat = z)} onmenge={(z) => (mengeZutat = z)} />
        {:else if ansicht === 'tabelle'}
          <TabellenZoom>
            {#snippet children(zoom)}
              <RezeptTabelle rezept={r} {einkauf} vorratZeigen {faktor} {zoom} timerTitel={r.titel} onzutat={(z) => (gewaehlteZutat = z)} onmenge={(z) => (mengeZutat = z)} />
            {/snippet}
          </TabellenZoom>
          <p class="leise tabelle-hinweis">Von links nach rechts lesen: Alles in der ersten Spalte kann sofort losgehen. Ein Schritt reicht so weit, bis er in den nächsten eingeht. Mit zwei Fingern zoomen, ⤢ zeigt die ganze Tabelle.</p>
        {:else}
          <div class="liste">
            <ul class="zutaten">
              {#each r.zutaten as z (z.id)}
                {@const m = vorratMarkierung(z, einkauf, true)}
                {@const kannUmrechnen = z.menge != null && z.einheit !== 'nach Geschmack'}
                <li class={einkauf && m ? `e-${m}` : ''}>
                  {#if kannUmrechnen}<button class="zutat-knopf m" class:skaliert={faktor !== 1} onclick={() => (mengeZutat = z)}>{formatMenge(skaliereMenge(z.menge, z.einheit, faktor), z.einheit)}</button>
                  {:else}<span class="m">{formatMenge(z.menge, z.einheit)}</span>{/if}
                  <button class="zutat-knopf" onclick={() => (gewaehlteZutat = z)}>{#if m}<span class="icon status-{m}">{VORRAT_ICON[m]}</span>{/if}{z.name}{#if z.hinweis}{' '}<span class="h">({z.hinweis})</span>{/if}</button>
                </li>
              {/each}
            </ul>
            <ol class="schritte">
              {#each reihenfolge as { schritt, nummer } (schritt.id)}
                {@const fertig = kochen && abgehakt.has(schritt.id)}
                <li class:fertig class:kochen>
                  {#if kochen}<button class="haken" onclick={() => haken(schritt.id)} aria-pressed={fertig} aria-label="Schritt {nummer} erledigt">{fertig ? '✓' : nummer}</button>{/if}
                  <span class="text"><SchrittText text={schritt.text} titel="{r.titel} · Schritt {nummer}" /></span>
                </li>
              {/each}
            </ol>
          </div>
        {/if}
      </section>

      {#if daten.notizen.trim()}
        <section class="notizen">
          <h2>Notizen</h2>
          <Markdown text={daten.notizen} />
        </section>
      {/if}
      {#if verlauf.length}
        <section class="verlauf" id="verlauf">
          <h2>Gekocht</h2>
          <ul>
            {#each verlauf as g (g.id)}
              <li>
                <span class="datum">{new Date(g.datum).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {#if g.bewertung}<span class="sterne" aria-label="{g.bewertung} von 5 Sternen">{'★'.repeat(g.bewertung)}<span class="leer-sterne">{'★'.repeat(5 - g.bewertung)}</span></span>{/if}
                {#if g.notiz}<span class="notiz">{g.notiz}</span>{/if}
                <button class="x nicht-drucken" onclick={() => verlaufLoeschen(g)} aria-label="Eintrag löschen">✕</button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      {#if r.video?.datei || r.video?.url}
        <section>
          <h2>Video</h2>
          {#if r.video.datei && daten.medien.some((m) => m.name === r.video?.datei)}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video controls preload="metadata" src={store.medienUrl(daten, r.video.datei)}></video>
          {:else if r.video.url}
            {#if videoLaden}
              <div class="video-rahmen"><iframe src={r.video.url} title="Video" allow="fullscreen; encrypted-media" allowfullscreen></iframe></div>
            {:else}
              <p>
                <button class="knopf" onclick={() => (videoLaden = true)}>▶ Video hier laden (online)</button>
                <a class="knopf" href={r.video.url} target="_blank" rel="noopener">Video in neuem Tab ↗</a>
              </p>
            {/if}
          {/if}
        </section>
      {/if}

      {#if r.quelle?.url || r.quelle?.name}
        <p class="quelle">
          Quelle:
          {#if r.quelle.url}<a href={r.quelle.url} target="_blank" rel="noopener">{r.quelle.name ?? r.quelle.url}</a>{:else}{r.quelle.name}{/if}
        </p>
      {/if}
    </article>
  {/if}
</div>

<style>
  article {
    padding: 1rem 0 3rem;
  }
  .held {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: var(--schatten);
    background: var(--flaeche);
  }
  .hauptbild {
    position: relative;
    height: clamp(200px, 40vh, 600px);
    width: 100%;
  }
  .hauptbild-knopf {
    position: absolute;
    right: 0.6rem;
    bottom: 0.6rem;
    font-size: 0.85rem;
    background: color-mix(in srgb, var(--flaeche) 90%, transparent);
  }
  .vorschau {
    display: flex;
    gap: 0.4rem;
    padding: 0.5rem;
    overflow-x: auto;
  }
  .vorschau button {
    width: 72px;
    height: 54px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 6px;
    overflow: hidden;
    flex: none;
    cursor: pointer;
  }
  .vorschau .aktiv {
    border-color: var(--akzent);
  }
  .titel {
    margin: 1rem 0 0.5rem;
  }
  h1 {
    font-family: var(--serif);
    font-size: clamp(1.7rem, 4vw, 2.5rem);
    margin: 0;
    line-height: 1.15;
  }
  .unter {
    color: var(--text-leise);
    margin: 0.4rem 0 0;
    font-size: 1.05rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    color: var(--text-leise);
    font-size: 0.95rem;
  }
  .warnhinweis {
    color: var(--warn);
    font-size: 0.9rem;
  }
  .portionen {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .mini {
    width: 1.9rem;
    height: 1.9rem;
    padding: 0;
    border: 1px solid var(--linie);
    border-radius: 999px;
    background: var(--flaeche);
    cursor: pointer;
    font-weight: 700;
    line-height: 1;
  }
  .mini:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .skaliert {
    color: var(--akzent);
    font-weight: 600;
  }
  .aktionen {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .knopf.an {
    background: var(--akzent);
    border-color: var(--akzent);
    color: var(--akzent-text);
  }
  .menue {
    position: relative;
  }
  .menue-hintergrund {
    position: fixed;
    inset: 0;
    z-index: 20;
  }
  .menue-liste {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 21;
    min-width: 12rem;
    display: grid;
    background: var(--flaeche);
    border: 1px solid var(--linie);
    border-radius: 10px;
    box-shadow: var(--schatten);
    overflow: hidden;
  }
  .menue-liste a,
  .menue-liste button {
    padding: 0.7rem 0.9rem;
    border: 0;
    background: none;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .menue-liste > * + * {
    border-top: 1px solid var(--linie);
  }
  @media (max-width: 700px) {
    /* Aktionen in einer Zeile; das Menü kommt als Blatt von unten, statt neben dem Knopf aus dem Bild zu ragen */
    .aktionen {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    }
    .aktionen > .knopf {
      justify-content: center;
      padding-inline: 0.5em;
    }
    .menue-hintergrund {
      background: rgb(0 0 0 / 0.35);
    }
    .menue-liste {
      position: fixed;
      left: 0;
      right: 0;
      top: auto;
      bottom: 0;
      border-radius: 16px 16px 0 0;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .menue-liste a,
    .menue-liste button {
      padding: 1rem 1.2rem;
      font-size: 1rem;
    }
  }
  .menue-liste .gefahr {
    color: var(--fehler);
  }
  .leise {
    color: var(--text-leise);
    font-size: 0.85rem;
  }
  .umgerechnet,
  .tipp {
    margin: 0 0 0.7rem;
    font-size: 0.85rem;
    color: var(--text-leise);
  }
  .umgerechnet {
    color: var(--akzent);
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--akzent);
    text-decoration: underline;
    cursor: pointer;
    font-size: inherit;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.35rem;
    margin: 1.5rem 0 0.7rem;
  }
  .abschnitt-kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .kopf-rechts {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .einkauf-info {
    margin: 0 0 0.8rem;
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    background: var(--flaeche);
    box-shadow: var(--schatten);
    line-height: 1.5;
  }
  .einkauf-info .leise {
    display: block;
    color: var(--text-leise);
    font-size: 0.85rem;
  }
  .einkauf-info a {
    color: var(--akzent);
  }
  .zutaten li.e-da {
    color: var(--text-leise);
  }
  .zutaten li.e-kaufen {
    font-weight: 600;
  }
  .zutaten li.e-kaufen .m,
  .zutaten li.e-knapp .m {
    color: inherit;
  }
  .zutat-knopf {
    border: 0;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .icon {
    display: inline-block;
    width: 1.4em;
  }
  .umschalter {
    display: inline-flex;
    border: 1px solid var(--linie);
    border-radius: 8px;
    overflow: hidden;
  }
  .umschalter button {
    border: 0;
    background: var(--flaeche);
    padding: 0.45em 0.7em;
    cursor: pointer;
  }
  .umschalter .aktiv {
    background: var(--akzent);
    color: var(--akzent-text);
  }
  .tabelle-hinweis {
    margin: 0.5rem 0 0;
  }
  .liste {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 2fr;
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .liste {
      grid-template-columns: 1fr;
    }
  }
  .zutaten {
    list-style: none;
    padding: 1rem;
    margin: 0;
    background: var(--zutat-bg);
    border-radius: 10px;
  }
  .zutaten li {
    padding: 0.25rem 0;
  }
  .zutaten .m {
    font-weight: 600;
    display: inline-block;
    min-width: 5.5em;
  }
  .zutaten .h {
    color: var(--text-leise);
    font-size: 0.9em;
  }
  .schritte li {
    margin: 0 0 0.6rem;
    line-height: 1.45;
  }
  .schritte li.fertig {
    opacity: 0.45;
  }
  .schritte li.fertig .text {
    text-decoration: line-through;
  }
  .schritte li.kochen {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    list-style: none;
    margin-left: -1.4rem;
  }
  .haken {
    flex: none;
    width: 2.2em;
    height: 2.2em;
    border-radius: 999px;
    border: 2px solid var(--akzent);
    background: var(--akzent);
    color: var(--akzent-text);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .fertig .haken {
    background: var(--da);
    border-color: var(--da);
  }
  .titelzeile {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.6rem;
  }
  .stern {
    flex: none;
    border: 0;
    background: none;
    font-size: 1.9rem;
    line-height: 1;
    padding: 0.1rem 0.2rem;
    cursor: pointer;
    color: var(--text-leise);
  }
  .stern.an {
    color: #e0a400;
  }
  .gekocht-info {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    color: var(--da);
    cursor: pointer;
  }
  .liste-knoepfe {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.5rem 0 0.3rem;
  }
  .verlauf ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 640px;
  }
  .verlauf li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    align-items: baseline;
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--linie);
  }
  .verlauf .datum {
    font-weight: 600;
    min-width: 7.5em;
  }
  .verlauf .sterne {
    color: #e0a400;
    letter-spacing: 0.05em;
  }
  .verlauf .leer-sterne {
    color: var(--linie);
  }
  .verlauf .notiz {
    flex: 1;
    color: var(--text-leise);
  }
  .verlauf .x {
    margin-left: auto;
    border: 0;
    background: none;
    color: var(--text-leise);
    cursor: pointer;
  }
  .notizen {
    line-height: 1.55;
    max-width: 75ch;
  }
  video,
  .video-rahmen {
    width: 100%;
    max-width: 800px;
    aspect-ratio: 16 / 9;
    border-radius: 10px;
    background: #000;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
  .quelle {
    margin-top: 2rem;
    color: var(--text-leise);
    font-size: 0.9rem;
    word-break: break-word;
  }
</style>
