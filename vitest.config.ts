import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@change-risk/cli': fileURLToPath(
        new URL('./apps/cli/src/index.ts', import.meta.url),
      ),
      '@change-risk/config': fileURLToPath(
        new URL('./packages/config/src/index.ts', import.meta.url),
      ),
      '@change-risk/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@change-risk/coverage': fileURLToPath(
        new URL('./packages/coverage/src/index.ts', import.meta.url),
      ),
      '@change-risk/dependency-graph': fileURLToPath(
        new URL('./packages/dependency-graph/src/index.ts', import.meta.url),
      ),
      '@change-risk/git-adapter': fileURLToPath(
        new URL('./packages/git-adapter/src/index.ts', import.meta.url),
      ),
      '@change-risk/language-typescript': fileURLToPath(
        new URL('./packages/language-typescript/src/index.ts', import.meta.url),
      ),
      '@change-risk/ownership': fileURLToPath(
        new URL('./packages/ownership/src/index.ts', import.meta.url),
      ),
      '@change-risk/plugin-sdk': fileURLToPath(
        new URL('./packages/plugin-sdk/src/index.ts', import.meta.url),
      ),
      '@change-risk/reporters': fileURLToPath(
        new URL('./packages/reporters/src/index.ts', import.meta.url),
      ),
      '@change-risk/rules': fileURLToPath(
        new URL('./packages/rules/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    exclude: ['**/dist/**', '**/node_modules/**'],
  },
});
