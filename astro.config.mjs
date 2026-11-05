// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://griffinh.me',
  devToolbar: { enabled: false },
  // Emit pages as /projects/dayone.html so links resolve without a trailing-slash redirect.
  build: { format: 'file' },
  vite: {
    plugins: [tailwindcss()],
  },
});
