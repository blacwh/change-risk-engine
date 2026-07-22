import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from './repository.js';

describe('fixture repository', () => {
  it('creates deterministic commit history and cleans it up', async () => {
    const commits = [
      {
        message: 'base',
        files: { 'src/index.ts': 'export const value = 1;\n' },
      },
      {
        message: 'head',
        files: { 'src/index.ts': 'export const value = 2;\n' },
      },
    ] as const;
    const fixture = await createFixtureRepository(commits);
    const duplicate = await createFixtureRepository(commits);
    expect(fixture.revisions).toHaveLength(2);
    expect(fixture.revisions[0]).toMatch(/^[0-9a-f]{40}$/u);
    expect(duplicate.revisions).toEqual(fixture.revisions);
    await fixture.cleanup();
    await duplicate.cleanup();
    await expect(access(fixture.path)).rejects.toThrow();
  });

  it('rejects paths outside the fixture root and removes partial state', async () => {
    await expect(
      createFixtureRepository([
        { message: 'bad', files: { '../escape': 'no' } },
      ]),
    ).rejects.toThrow(/escapes repository root/);
  });
});
