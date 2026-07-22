import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from '../packages/fixtures/src/index.js';
import {
  collectChangedFiles,
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

describe('Git changed-file evidence', () => {
  it('combines statuses, line counts, renames, binary files, and unusual paths', async () => {
    const renamedContents = 'export const stable = true;\n'.repeat(8);
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'delete.ts': 'remove me\n',
          'old/name.ts': renamedContents,
          'odd\tline\nname.ts': 'before\n',
          'asset.bin': new Uint8Array([0, 1, 2, 3]),
        },
      },
      {
        message: 'head',
        files: {
          'delete.ts': null,
          'old/name.ts': null,
          'new/name.ts': renamedContents,
          'odd\tline\nname.ts': 'after\nextra\n',
          'asset.bin': new Uint8Array([0, 1, 2, 4]),
          'added.ts': 'one\ntwo\n',
        },
      },
    ]);
    try {
      const diff = await collectChangedFiles(fixture.path, 'HEAD~1', 'HEAD');
      expect(diff.baseRevision).toBe(fixture.revisions[0]);
      expect(diff.headRevision).toBe(fixture.revisions[1]);
      expect(diff.files).toContainEqual({
        path: 'new/name.ts',
        previousPath: 'old/name.ts',
        status: 'renamed',
        additions: 0,
        deletions: 0,
        binary: false,
      });
      expect(diff.files).toContainEqual({
        path: 'asset.bin',
        status: 'modified',
        additions: 0,
        deletions: 0,
        binary: true,
      });
      expect(diff.files).toContainEqual({
        path: 'added.ts',
        status: 'added',
        additions: 2,
        deletions: 0,
        binary: false,
      });
      expect(diff.files).toContainEqual({
        path: 'delete.ts',
        status: 'deleted',
        additions: 0,
        deletions: 1,
        binary: false,
      });
      expect(
        diff.files.find(({ path }) => path === 'odd\tline\nname.ts'),
      ).toMatchObject({
        status: 'modified',
        additions: 2,
        deletions: 1,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it('returns no changes for identical commits and validates rename thresholds', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'README.md': 'same\n' } },
    ]);
    try {
      await expect(
        collectChangedFiles(fixture.path, 'HEAD', 'HEAD'),
      ).resolves.toMatchObject({
        files: [],
      });
      await expect(
        collectChangedFiles(fixture.path, 'HEAD', 'HEAD', {
          renameThreshold: 101,
        }),
      ).rejects.toThrow(/Rename threshold/);
    } finally {
      await fixture.cleanup();
    }
  });
});
