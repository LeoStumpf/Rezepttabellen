<script lang="ts">
  import { store } from '../app.ts';

  let {
    rezept,
    name,
    breite,
    alt = '',
    klasse = '',
    ganz = false,
    onload,
  }: {
    rezept: { id: string; slug: string };
    name?: string;
    breite?: number;
    alt?: string;
    klasse?: string;
    /** ganzes Bild zeigen (kein Beschnitt), Ränder mit unscharfer Kopie füllen */
    ganz?: boolean;
    onload?: () => void;
  } = $props();

  let kaputt = $state(false);
  const src = $derived(name ? store.medienUrl(rezept, name, breite) : '');
  $effect(() => {
    src;
    kaputt = false;
  });
  $effect(() => {
    if ((!name || kaputt) && onload) onload();
  });
</script>

{#if name && !kaputt && ganz}
  <div class="ganz {klasse}">
    <img class="hintergrund" src={store.medienUrl(rezept, name, 200)} alt="" aria-hidden="true" />
    <img class="vorne" {src} {alt} onerror={() => (kaputt = true)} onload={() => onload?.()} />
  </div>
{:else if name && !kaputt}
  <img class={klasse} {src} {alt} loading="lazy" onerror={() => (kaputt = true)} onload={() => onload?.()} />
{:else}
  <div class="platzhalter {klasse}" role="img" aria-label="Bild fehlt">
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"
      ><path fill="currentColor" d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v8.6l3.3-3.3a1 1 0 0 1 1.4 0l2.3 2.3 4.3-4.3a1 1 0 0 1 1.4 0L19 11.6V7H5Zm4 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" /></svg
    >
    <span>Bild fehlt</span>
  </div>
{/if}

<style>
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ganz {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }
  .ganz .hintergrund {
    position: absolute;
    inset: -10%;
    width: 120%;
    height: 120%;
    filter: blur(28px) brightness(0.75) saturate(1.2);
  }
  .ganz .vorne {
    position: relative;
    object-fit: contain;
  }
  .platzhalter {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 8rem;
    background: repeating-linear-gradient(135deg, var(--zutat-bg) 0 12px, var(--flaeche) 12px 24px);
    color: var(--warn);
    font-weight: 600;
    font-size: 0.9rem;
  }
</style>
