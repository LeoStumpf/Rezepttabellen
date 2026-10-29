<script lang="ts">
  import { flushSync, type Snippet } from 'svelte';

  // Querscroll-Bereich für die Rezepttabelle mit Zoom: zwei Finger (wie bei PDF/Karte),
  // Strg + Mausrad am Rechner, ⤢ passt die ganze Tabelle in die Breite.
  // Gezoomt wird per CSS `zoom` (nicht transform), damit Scrollbreite, Sticky-Text und Klicks stimmen.
  let { children }: { children: Snippet<[number]> } = $props();

  const MAX = 1.6;
  let zoom = $state(1);
  let fit = $state(1);
  let scroller: HTMLDivElement;

  const tabelle = () => scroller?.querySelector('table');

  function fitBerechnen() {
    const t = tabelle();
    if (!t) return;
    const natuerlich = t.getBoundingClientRect().width / zoom;
    fit = Math.min(1, (scroller.clientWidth - 1) / natuerlich); // −1 px gegen Rundung
    if (zoom < fit) zoom = fit;
  }

  /** Zoom ändern und dabei den Punkt (clientX/clientY) an Ort und Stelle halten */
  function zoomen(neu: number, x: number, y: number) {
    neu = Math.min(MAX, Math.max(fit, neu));
    if (Math.abs(neu - zoom) < 0.001) return;
    const alt = zoom;
    const r = scroller.getBoundingClientRect();
    const inhaltX = (scroller.scrollLeft + x - r.left) / alt;
    const inhaltY = (y - r.top) / alt;
    flushSync(() => (zoom = neu));
    scroller.scrollLeft = inhaltX * neu - (x - r.left);
    window.scrollBy(0, inhaltY * (neu - alt));
  }

  $effect(() => {
    let start: { abstand: number; zoom: number } | null = null;
    const abstand = (e: TouchEvent) =>
      Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const mitte = (e: TouchEvent) => [
      (e.touches[0].clientX + e.touches[1].clientX) / 2,
      (e.touches[0].clientY + e.touches[1].clientY) / 2,
    ] as const;

    const onstart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { abstand: abstand(e), zoom };
    };
    const onmove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault(); // sonst zoomt die ganze Seite
      const [x, y] = mitte(e);
      zoomen((start.zoom * abstand(e)) / start.abstand, x, y);
    };
    const onend = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };
    const onwheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomen(zoom * Math.exp(-e.deltaY / 300), e.clientX, e.clientY);
    };

    scroller.addEventListener('touchstart', onstart, { passive: true });
    scroller.addEventListener('touchmove', onmove, { passive: false });
    scroller.addEventListener('touchend', onend);
    scroller.addEventListener('touchcancel', onend);
    scroller.addEventListener('wheel', onwheel, { passive: false });
    const ro = new ResizeObserver(fitBerechnen);
    ro.observe(scroller);
    const t = tabelle();
    if (t) ro.observe(t);
    return () => {
      scroller.removeEventListener('touchstart', onstart);
      scroller.removeEventListener('touchmove', onmove);
      scroller.removeEventListener('touchend', onend);
      scroller.removeEventListener('touchcancel', onend);
      scroller.removeEventListener('wheel', onwheel);
      ro.disconnect();
    };
  });

  const eingepasst = $derived(zoom <= fit * 1.01);
</script>

<div class="zoom-rahmen">
  <div class="tabelle-scroll" bind:this={scroller}>{@render children(zoom)}</div>
  {#if fit < 0.99 || zoom !== 1}
    <button
      class="zoom-knopf"
      onclick={() => (zoom = eingepasst ? 1 : fit)}
      title={eingepasst ? 'Normale Größe' : 'Ganze Tabelle zeigen'}
    >{eingepasst ? '1:1' : '⤢ Ganz'}</button>
  {/if}
</div>

<style>
  .zoom-rahmen {
    position: relative;
  }
  .tabelle-scroll {
    container-type: inline-size;
    overflow-x: auto;
    border-radius: 10px;
    box-shadow: var(--schatten);
  }
  .zoom-knopf {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--linie);
    border-radius: 999px;
    background: color-mix(in srgb, var(--flaeche) 85%, transparent);
    color: var(--text);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    box-shadow: var(--schatten);
  }
</style>
