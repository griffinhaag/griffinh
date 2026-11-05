// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://griffinh.me',
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
