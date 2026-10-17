import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      '@fivem-nui/svelte': resolve(__dirname, 'src/index.ts'),
      '@fivem-nui/core': resolve(__dirname, '../../fivem-nui/core/dist/index.js'),
      '@fivem-nui/error': resolve(__dirname, '../../fivem-nui/error/dist/index.js')
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.svelte.ts'],
      exclude: ['src/**/*.d.ts']
    }
  }
});
