import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig(({ command, isPreview }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH
    ?? (command === 'build' || isPreview ? '/vitani_prvaku' : '');
  return {
    base: `${basePath}/`,
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    define: {
      'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(basePath),
      'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify(process.env.NEXT_PUBLIC_APP_VERSION || 'development'),
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [react()],
    build: { outDir: 'dist', target: 'safari16', rolldownOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), gallery: fileURLToPath(new URL('./galerie/index.html', import.meta.url)), login: fileURLToPath(new URL('./pripojeni/index.html', import.meta.url)) } } },
  };
});
