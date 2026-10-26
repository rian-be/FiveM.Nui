import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const root = fileURLToPath(new URL('.', import.meta.url));
const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [
    svelte()
  ],
  build: {
    target: 'es2022',
    outDir: resolvePath('../html/dist'),
    emptyOutDir: true,
    lib: {
      entry: resolvePath('./src/main.ts'),
      name: 'FiveMNuiDevTools',
      formats: ['iife'],
      fileName: () => 'devtools.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'devtools.css';
          return 'assets/[name][extname]';
        }
      }
    }
  }
});
