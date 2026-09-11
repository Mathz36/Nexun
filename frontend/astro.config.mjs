import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Frontend estático: todo acesso a dados é feito via fetch client-side para
// a API própria do backend (nunca diretamente para a Sankhya — Seção 65).
// Em desenvolvimento, o dev server do Astro faz proxy de /api para o backend.
export default defineConfig({
  integrations: [tailwind()],
  server: {
    port: 3027,
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL ?? 'http://localhost:3026',
          changeOrigin: true,
        },
      },
    },
  },
});
