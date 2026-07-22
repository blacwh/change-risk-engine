import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { discoverTypeScriptFiles } from './discovery.js';
import { indexTypeScriptProject } from './indexer.js';

const roots: string[] = [];

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-language-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('TypeScript and JavaScript discovery', () => {
  it('discovers supported files deterministically and skips ignored trees and symlinks', async () => {
    const root = await temporaryRepository();
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(root, 'src', 'z.jsx'), 'export {};\n');
    await writeFile(join(root, 'src', 'a.d.ts'), 'export {};\n');
    await writeFile(join(root, 'src', 'ignore.md'), '# no\n');
    await writeFile(
      join(root, 'node_modules', 'pkg', 'ignored.ts'),
      'export {};\n',
    );
    await symlink(join(root, 'src', 'a.d.ts'), join(root, 'linked.ts'));

    const result = await discoverTypeScriptFiles(root);
    expect(result.files).toEqual(['src/a.d.ts', 'src/z.jsx']);
    expect(result.issues).toContainEqual({
      kind: 'symlink-skipped',
      path: 'linked.ts',
    });
  });

  it('reports traversal truncation and validates limits', async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, 'a.ts'), 'export {};\n');
    await writeFile(join(root, 'b.ts'), 'export {};\n');
    const result = await discoverTypeScriptFiles(root, { maxFiles: 1 });
    expect(result.files).toHaveLength(1);
    expect(result.issues).toContainEqual({ kind: 'file-limit' });
    const entryLimited = await discoverTypeScriptFiles(root, { maxEntries: 1 });
    expect(entryLimited.files).toEqual([]);
    expect(entryLimited.issues).toContainEqual({ kind: 'entry-limit' });
    await expect(
      discoverTypeScriptFiles(root, { maxEntries: 0 }),
    ).rejects.toThrow(/maxEntries/);
  });
});

describe('static import indexing', () => {
  it('extracts ESM, CommonJS, dynamic, export, and import-equals references', async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, 'index.ts'),
      [
        "import type { A } from './types.js';",
        "import { type C } from './named-type.js';",
        "import './side-effect.js';",
        "export type { B } from './other.js';",
        "export { type D } from './named-export.js';",
        "import legacy = require('./legacy.cjs');",
        "const common = require('./common.cjs');",
        "void import('./lazy.js');",
        'void import(variable);',
      ].join('\n'),
    );

    const result = await indexTypeScriptProject(root);
    expect(result.issues).toEqual([]);
    expect(result.modules[0]?.imports).toEqual([
      { specifier: './types.js', kind: 'import', typeOnly: true },
      { specifier: './named-type.js', kind: 'import', typeOnly: true },
      { specifier: './side-effect.js', kind: 'import', typeOnly: false },
      { specifier: './other.js', kind: 'export', typeOnly: true },
      { specifier: './named-export.js', kind: 'export', typeOnly: true },
      { specifier: './legacy.cjs', kind: 'import-equals', typeOnly: false },
      { specifier: './common.cjs', kind: 'require', typeOnly: false },
      { specifier: './lazy.js', kind: 'dynamic-import', typeOnly: false },
    ]);
  });

  it('reports syntax errors and oversized files without exposing source text', async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, 'broken.ts'), 'const = ; secret-value\n');
    await writeFile(join(root, 'large.ts'), 'x'.repeat(100));
    const result = await indexTypeScriptProject(root, { maxFileBytes: 50 });
    expect(result.issues).toContainEqual({
      kind: 'file-too-large',
      path: 'large.ts',
    });
    const parseIssue = result.issues.find(({ kind }) => kind === 'parse-error');
    expect(parseIssue).toMatchObject({
      kind: 'parse-error',
      path: 'broken.ts',
    });
    expect(JSON.stringify(parseIssue)).not.toContain('secret-value');
  });
});
