import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const workspacePackages = [
  ['apps/cli', '@change-risk/cli'],
  ['apps/github-action', '@change-risk/github-action'],
  ['packages/config', '@change-risk/config'],
  ['packages/core', '@change-risk/core'],
  ['packages/dependency-graph', '@change-risk/dependency-graph'],
  ['packages/fixtures', '@change-risk/fixtures'],
  ['packages/git-adapter', '@change-risk/git-adapter'],
  ['packages/language-typescript', '@change-risk/language-typescript'],
  ['packages/plugin-sdk', '@change-risk/plugin-sdk'],
  ['packages/reporters', '@change-risk/reporters'],
  ['packages/rules', '@change-risk/rules'],
] as const;

describe('workspace layout', () => {
  it.each(workspacePackages)(
    '%s declares the expected package name',
    async (path, name) => {
      const manifestUrl = new URL(`../${path}/package.json`, import.meta.url);
      const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as {
        name?: unknown;
        private?: unknown;
      };

      expect(manifest.name).toBe(name);
      expect(manifest.private).toBe(true);
    },
  );
});
