<script lang="ts">
  import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
  import type { FotoAuftrag } from '@mrt/shared';
  import { istApp } from '../lib/app.ts';
  import { bildVerkleinern } from '../lib/bild-verkleinern.ts';
  import { warteschlange, auftragAnlegen, hochladen, aktualisieren, serverAuftraege, serverBildUrl, alsErledigt } from '../lib/foto-warteschlange.svelte.ts';

  /** Lang genug, dass auch kleine Schrift auf dem Foto lesbar bleibt */
  const MAX_PX = 2600;

  let bilder = $state<{ blob: Blob; url: string }[]>([]);
  let notiz = $state('');
  let sendet = $state(false);
  let meldung = $state<{ art: 'ok' | 'warn' | 'fehler'; text: string } | null>(null);
  let offen = $state<FotoAuftrag[] | null>(null);
  let offenFehler = $state('');
  let gross = $state<string | null>(null);

  void aktualisieren();
  void offeneLaden();

  async function offeneLaden() {
    try {
      offen = await serverAuftraege();
      offenFehler = '';
    } catch {
      offen = null;
      offenFehler = 'Server gerade nicht erreichbar.';
    }
  }

  function hinzu(blob: Blob) {
    bilder.push({ blob, url: URL.createObjectURL(blob) });
  }

  function abgebrochen(e: unknown) {
    return /cancel/i.test((e as Error)?.message ?? '');
  }

  async function kamera() {
    meldung = null;
    try {
      const foto = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 85, width: MAX_PX });
      if (foto.webPath) hinzu(await (await fetch(foto.webPath)).blob());
    } catch (e) {
      if (!abgebrochen(e)) meldung = { art: 'fehler', text: `Kamera: ${(e as Error).message}` };
    }
  }

  async function galerie() {
    meldung = null;
    try {
      const { photos } = await Camera.pickImages({ quality: 85, width: MAX_PX, limit: 0 });
      for (const p of photos) hinzu(await (await fetch(p.webPath)).blob());
    } catch (e) {
      if (!abgebrochen(e)) meldung = { art: 'fehler', text: `Galerie: ${(e as Error).message}` };
    }
  }

  async function dateienGewaehlt(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    for (const f of input.files ?? []) hinzu(await bildVerkleinern(f, MAX_PX));
    input.value = '';
  }

  function entfernen(i: number) {
    URL.revokeObjectURL(bilder[i].url);
    bilder.splice(i, 1);
  }

  async function senden() {
    if (!bilder.length) return;
    sendet = true;
    meldung = null;
    try {
      const erg = await auftragAnlegen(
        bilder.map((b) => b.blob),
        notiz.trim(),
      );
      for (const b of bilder) URL.revokeObjectURL(b.url);
      bilder = [];
      notiz = '';
      meldung =
        erg === 'gesendet'
          ? { art: 'ok', text: '✓ Auf dem Server abgelegt.' }
          : { art: 'warn', text: 'Server nicht erreichbar: Die Fotos bleiben auf dem Handy und werden hochgeladen, sobald du wieder im Heimnetz bist.' };
      void offeneLaden();
    } catch (e) {
      meldung = { art: 'fehler', text: `Nicht gespeichert: ${(e as Error).message}` };
    } finally {
      sendet = false;
    }
  }

  async function jetztHochladen() {
    const n = await hochladen();
    meldung = n ? { art: 'ok', text: `✓ ${n} Auftrag/Aufträge hochgeladen.` } : { art: 'warn', text: warteschlange.letzterFehler || 'Nichts hochgeladen.' };
    void offeneLaden();
  }

  async function erledigt(a: FotoAuftrag) {
    try {
      await alsErledigt(a);
      offen = offen?.filter((x) => x.ordner !== a.ordner) ?? null;
    } catch (e) {
      meldung = { art: 'fehler', text: `Konnte nicht als erledigt markieren: ${(e as Error).message}` };
    }
  }

  function datum(iso: string) {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

<div class="seite-rand inhalt">
  <h1>Rezept abfotografieren</h1>
  <p class="leise">Fotografiere ein Rezept aus Buch, Zeitschrift oder Zettel. Wenn es über mehrere Seiten geht, mach mehrere Fotos. Die Bilder landen im Foto-Eingang auf dem Server und werden später zu Rezepten verarbeitet.</p>

  <section class="karte">
    <div class="zeile">
      {#if istApp}
        <button class="knopf primaer" onclick={kamera}>📷 Foto aufnehmen</button>
        <button class="knopf" onclick={galerie}>🖼 Aus Galerie</button>
      {:else}
        <label class="knopf primaer">📷 Foto aufnehmen<input type="file" accept="image/*" capture="environment" onchange={dateienGewaehlt} hidden /></label>
        <label class="knopf">🖼 Bilder wählen<input type="file" accept="image/*" multiple onchange={dateienGewaehlt} hidden /></label>
      {/if}
    </div>

    {#if bilder.length}
      <div class="kacheln">
        {#each bilder as b, i (b.url)}
          <figure>
            <button class="bild" onclick={() => (gross = b.url)} aria-label="Foto {i + 1} groß anzeigen"><img src={b.url} alt="Foto {i + 1}" /></button>
            <button class="weg" onclick={() => entfernen(i)} aria-label="Foto {i + 1} entfernen">✕</button>
            <figcaption>{i + 1}</figcaption>
          </figure>
        {/each}
      </div>
      <label>Notiz (optional) <textarea bind:value={notiz} rows="2" placeholder="z. B. „von Oma“, „halbe Menge Zucker“, Buchtitel …"></textarea></label>
      <div class="zeile">
        <button class="knopf primaer" onclick={senden} disabled={sendet}>{sendet ? 'Speichere …' : `⇪ ${bilder.length} Foto${bilder.length > 1 ? 's' : ''} senden`}</button>
      </div>
    {:else}
      <p class="leise">Noch keine Fotos.</p>
    {/if}

    {#if meldung}<p class={meldung.art === 'fehler' ? 'fehlerbox' : meldung.art}>{meldung.text}</p>{/if}
  </section>

  {#if istApp && warteschlange.wartend}
    <section class="karte">
      <p><strong>{warteschlange.wartend}</strong> Auftrag/Aufträge warten auf dem Handy auf den Server.</p>
      <div class="zeile"><button class="knopf" onclick={jetztHochladen} disabled={warteschlange.laeuft}>{warteschlange.laeuft ? 'Lade hoch …' : '⇪ Jetzt hochladen'}</button></div>
    </section>
  {/if}

  <section class="karte">
    <h2>Im Foto-Eingang auf dem Server</h2>
    {#if offen === null}
      <p class="leise">{offenFehler || 'Lade …'}</p>
    {:else if !offen.length}
      <p class="leise">Alles ausgewertet.</p>
    {:else}
      {#each offen as a (a.ordner)}
        <div class="auftrag">
          <div class="kopf">
            <span>{datum(a.erstellt)} · {a.bilder.length} Foto{a.bilder.length > 1 ? 's' : ''}{a.geraet ? ` · ${a.geraet}` : ''}</span>
            <button class="knopf" onclick={() => erledigt(a)}>✓ erledigt</button>
          </div>
          {#if a.notiz}<p class="notiz">{a.notiz}</p>{/if}
          <div class="kacheln">
            {#each a.bilder as n (n)}
              <button class="bild" onclick={() => (gross = serverBildUrl(a, n))}><img src={serverBildUrl(a, n, 300)} alt={n} loading="lazy" /></button>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </section>
</div>

{#if gross}
  <button class="gross" onclick={() => (gross = null)} aria-label="Schließen"><img src={gross} alt="" /></button>
{/if}

<style>
  .inhalt {
    padding-bottom: 3rem;
    max-width: 700px;
  }
  h1 {
    font-family: var(--serif);
    margin: 1.2rem 0 0.4rem;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.15rem;
    margin: 0;
  }
  .karte {
    background: var(--flaeche);
    border-radius: 12px;
    box-shadow: var(--schatten);
    padding: 1rem;
    margin: 1rem 0;
    display: grid;
    gap: 0.8rem;
  }
  .leise {
    color: var(--text-leise);
    font-size: 0.9rem;
  }
  .zeile {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }
  label.knopf {
    cursor: pointer;
  }
  textarea {
    width: 100%;
    display: block;
    margin-top: 0.3rem;
    font: inherit;
  }
  .kacheln {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.5rem;
  }
  figure {
    position: relative;
    margin: 0;
  }
  figcaption {
    position: absolute;
    left: 4px;
    bottom: 4px;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    font-size: 0.75rem;
    border-radius: 4px;
    padding: 0 0.35rem;
  }
  .bild {
    padding: 0;
    border: 1px solid var(--linie);
    border-radius: 8px;
    overflow: hidden;
    background: var(--zutat-bg);
    aspect-ratio: 3 / 4;
    width: 100%;
    cursor: zoom-in;
  }
  .bild img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .weg {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
    cursor: pointer;
  }
  .auftrag {
    border-top: 1px solid var(--linie);
    padding-top: 0.7rem;
    display: grid;
    gap: 0.5rem;
  }
  .auftrag .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .notiz {
    margin: 0;
    font-style: italic;
  }
  .ok {
    color: var(--ok);
  }
  .warn {
    color: var(--warn);
  }
  .gross {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(0 0 0 / 0.9);
    border: none;
    padding: env(safe-area-inset-top) 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }
  .gross img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
</style>
