import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from '../../../packages/fixtures/src/index.js';
import { loadRepositoryConfig } from './config.js';

describe('repository configuration loading', () => {
  it('loads a bounded root config and defaults when the optional file is absent', async () => {
    const configured = await createFixtureRepository([
      {
        message: 'config',
        files: {
          '.change-risk.json': JSON.stringify({
            schemaVersion: 1,
            thresholds: { moderate: 10, high: 30, critical: 60 },
          }),
        },
      },
    ]);
    const unconfigured = await createFixtureRepository([
      { message: 'empty', files: { 'README.md': '# fixture\n' } },
    ]);
    try {
      await expect(
        loadRepositoryConfig(configured.path, undefined),
      ).resolves.toMatchObject({
        thresholds: { moderate: 10, high: 30, critical: 60 },
      });
      await expect(
        loadRepositoryConfig(unconfigured.path, undefined),
      ).resolves.toMatchObject({ schemaVersion: 1, rules: {} });
      await expect(
        loadRepositoryConfig(configured.path, '../outside.json'),
      ).rejects.toThrow(/inside the repository/);
    } finally {
      await Promise.all([configured.cleanup(), unconfigured.cleanup()]);
    }
  });
});
