import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { pythonLanguageAdapter } from './adapter.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('Python language adapter', () => {
  it('selects Python source and stub paths only', () => {
    expect(pythonLanguageAdapter.id).toBe('python');
    expect(pythonLanguageAdapter.canHandle('src/module.py')).toBe(true);
    expect(pythonLanguageAdapter.canHandle('src/module.pyi')).toBe(true);
    expect(pythonLanguageAdapter.canHandle('src/module.PY')).toBe(false);
    expect(pythonLanguageAdapter.canHandle('src/module.ts')).toBe(false);
  });

  it('exposes the bounded repository index contract', async () => {
    const root = await mkdtemp(join(tmpdir(), 'change-risk-python-adapter-'));
    roots.push(root);
    await writeFile(join(root, 'one.py'), 'import external\n');
    await writeFile(join(root, 'two.py'), 'import one\n');

    const index = await pythonLanguageAdapter.indexRepository(root, {
      maxEntries: 100,
      maxFiles: 1,
      maxFileBytes: 1_000,
    });

    expect(index.modules).toHaveLength(1);
    expect(index.issues).toContainEqual({ kind: 'file-limit' });
  });
});
