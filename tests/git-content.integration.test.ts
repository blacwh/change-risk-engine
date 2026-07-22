import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from '../packages/fixtures/src/index.js';
import {
  GitCommandError,
  readFileAtRevision,
  resolveRevision,
} from '../packages/git-adapter/src/index.js';

describe('revision file evidence', () => {
  it('reads bounded content only from a resolved object id', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: { 'src/value.ts': 'export const value = 1;\n' },
      },
      {
        message: 'head',
        files: { 'src/value.ts': 'export const value = 2;\n' },
      },
    ]);
    try {
      const base = await resolveRevision(fixture.path, 'HEAD^');
      await expect(
        readFileAtRevision(fixture.path, base, 'src/value.ts'),
      ).resolves.toBe('export const value = 1;\n');
      await expect(
        readFileAtRevision(fixture.path, 'HEAD', 'src/value.ts'),
      ).rejects.toThrow(/resolved Git object id/);
      await expect(
        readFileAtRevision(fixture.path, base, '../secret'),
      ).rejects.toThrow(/normalized repository path/);
      await expect(
        readFileAtRevision(fixture.path, base, 'src/value.ts', { maxBytes: 4 }),
      ).rejects.toThrow(/size limit/);
    } finally {
      await fixture.cleanup();
    }
  });

  it('returns a stable error for a path absent at the revision', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'src/value.ts': 'export {};\n' } },
    ]);
    try {
      const head = await resolveRevision(fixture.path, 'HEAD');
      await expect(
        readFileAtRevision(fixture.path, head, 'missing.ts'),
      ).rejects.toBeInstanceOf(GitCommandError);
    } finally {
      await fixture.cleanup();
    }
  });
});
