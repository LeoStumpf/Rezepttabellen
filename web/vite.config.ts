import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/medien': 'http://localhost:8080',
      '/fotos': 'http://localhost:8080',
    },
  },
});
