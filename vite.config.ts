import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  base: process.env.NEXT_PUBLIC_BASE_PATH ? `${process.env.NEXT_PUBLIC_BASE_PATH}/` : '/',
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: {
    'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(process.env.NEXT_PUBLIC_BASE_PATH || ''),
    'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify(process.env.NEXT_PUBLIC_APP_VERSION || 'development'),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: { outDir: 'dist', target: 'safari16' },
});
