<script lang="ts">
  import { markdownZuHtml } from '../markdown.ts';
  let { text, klasse = '' }: { text: string; klasse?: string } = $props();
</script>

<div class="md {klasse}">{@html markdownZuHtml(text)}</div>

<style>
  .md :global(h2) {
    font-family: var(--serif);
    font-size: 1.2em;
    margin: 1.2em 0 0.4em;
  }
  .md :global(h2:first-child) {
    margin-top: 0;
  }
  .md :global(li) {
    margin: 0.25em 0;
  }
  .md :global(a) {
    color: var(--akzent);
  }
</style>
