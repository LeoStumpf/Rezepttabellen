<script lang="ts">
  import { formatRestzeit } from '@mrt/shared';
  import { timer, timerStoppen, timerVerlaengern } from '../timer.svelte.ts';
</script>

{#if timer.liste.length}
  <div class="leiste nicht-drucken" role="region" aria-label="Timer">
    {#each timer.liste as t (t.id)}
      {@const rest = (t.ende - timer.jetzt) / 1000}
      <div class="timer" class:fertig={rest <= 0}>
        <span class="zeit">{rest <= 0 ? 'Fertig!' : formatRestzeit(rest)}</span>
        <span class="titel">{t.titel}</span>
        <button onclick={() => timerVerlaengern(t.id)} aria-label="Eine Minute mehr">+1</button>
        <button onclick={() => timerStoppen(t.id)} aria-label="Timer beenden">✕</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .leiste {
    position: fixed;
    z-index: 50;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    gap: 0.4rem;
    padding: 0.5rem 16px calc(0.5rem + env(safe-area-inset-bottom));
    pointer-events: none;
  }
  .timer {
    pointer-events: auto;
    box-sizing: border-box;
    justify-self: center;
    width: min(480px, 100%);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.5rem 0.45rem 0.9rem;
    border-radius: 999px;
    background: var(--text);
    color: var(--bg);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
  }
  .timer.fertig {
    background: var(--akzent);
    color: var(--akzent-text);
    animation: puls 1s ease-in-out infinite;
  }
  @keyframes puls {
    50% {
      transform: scale(1.03);
    }
  }
  .zeit {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 3.6em;
  }
  .titel {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9rem;
    opacity: 0.85;
  }
  button {
    flex: none;
    border: 0;
    border-radius: 999px;
    width: 2.2rem;
    height: 2.2rem;
    background: rgb(255 255 255 / 0.15);
    color: inherit;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
