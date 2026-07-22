import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from '../packages/fixtures/src/index.js';
import {
  GitCommandError,
  resolveRevision,
} from '../packages/git-adapter/src/index.js';

describe('Git revision resolution', () => {
  it('resolves names to full commit object ids', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'README.md': '# fixture\n' } },
      { message: 'head', files: { 'src/index.ts': 'export {};\n' } },
    ]);
    try {
      expect(await resolveRevision(fixture.path, 'HEAD')).toBe(
        fixture.revisions[1],
      );
      expect(await resolveRevision(fixture.path, 'HEAD~1')).toBe(
        fixture.revisions[0],
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('does not interpret option-like revisions as command options', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'README.md': '# fixture\n' } },
    ]);
    try {
      await expect(
        resolveRevision(fixture.path, '--help'),
      ).rejects.toBeInstanceOf(GitCommandError);
    } finally {
      await fixture.cleanup();
    }
  });

  it('rejects invalid roots, revisions, and timeouts with stable errors', async () => {
    await expect(
      resolveRevision('/definitely/missing', 'HEAD'),
    ).rejects.toBeInstanceOf(GitCommandError);
    await expect(resolveRevision('.', '')).rejects.toThrow(/non-empty/);
    await expect(
      resolveRevision('.', 'HEAD', { timeoutMs: 0 }),
    ).rejects.toThrow(/timeout/);
  });
});
