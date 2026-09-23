import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Frontend estático: todo acesso a dados é feito via fetch client-side para
// a API própria do backend (nunca diretamente para a Sankhya — Seção 65).
// Em desenvolvimento, o dev server do Astro faz proxy de /api para o backend.
export default defineConfig({
  integrations: [tailwind()],
  server: {
    host: '0.0.0.0',
    port: 3027,
  },
  preview: {
    host: '0.0.0.0',
    port: 3027,
    strictPort: true,
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
    preview: {
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL ?? 'http://localhost:3026',
          changeOrigin: true,
        },
      },
    },
  },
});
