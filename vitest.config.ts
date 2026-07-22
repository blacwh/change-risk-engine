import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@change-risk/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@change-risk/dependency-graph': fileURLToPath(
        new URL('./packages/dependency-graph/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    exclude: ['**/dist/**', '**/node_modules/**'],
  },
});
