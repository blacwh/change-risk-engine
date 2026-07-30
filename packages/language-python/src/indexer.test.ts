import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { discoverPythonFiles } from './discovery.js';
import { indexPythonProject } from './indexer.js';

const roots: string[] = [];

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-python-index-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('Python discovery', () => {
  it('discovers source and stub files deterministically and skips ignored trees and symlinks', async () => {
    const root = await temporaryRepository();
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, '.venv'), { recursive: true });
    await writeFile(join(root, 'src', 'z.py'), 'value = 1\n');
    await writeFile(join(root, 'src', 'a.pyi'), 'value: int\n');
    await writeFile(join(root, 'src', 'upper.PY'), 'value = 2\n');
    await writeFile(join(root, 'src', 'ignore.md'), '# no\n');
    await writeFile(join(root, '.venv', 'ignored.py'), 'value = 3\n');
    await symlink(join(root, 'src', 'z.py'), join(root, 'linked.py'));

    const result = await discoverPythonFiles(root);

    expect(result.files).toEqual(['src/a.pyi', 'src/z.py']);
    expect(result.issues).toContainEqual({
      kind: 'symlink-skipped',
      path: 'linked.py',
    });
  });

  it('reports traversal truncation and validates limits', async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, 'a.py'), 'value = 1\n');
    await writeFile(join(root, 'b.py'), 'value = 2\n');

    const fileLimited = await discoverPythonFiles(root, { maxFiles: 1 });
    expect(fileLimited.files).toHaveLength(1);
    expect(fileLimited.issues).toContainEqual({ kind: 'file-limit' });
    const entryLimited = await discoverPythonFiles(root, { maxEntries: 1 });
    expect(entryLimited.files).toEqual([]);
    expect(entryLimited.issues).toContainEqual({ kind: 'entry-limit' });
    await expect(discoverPythonFiles(root, { maxEntries: 0 })).rejects.toThrow(
      /maxEntries/u,
    );
  });
});

describe('static Python import indexing', () => {
  it('extracts imports, aliases, relative levels, parenthesized names, and stars', async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, 'module.py'),
      [
        'import os, package.module as alias',
        'from . import local',
        'from ..core import thing as value',
        'from package import (submodule, name)',
        'from package import *',
        'value = __import__("dynamic")',
      ].join('\n'),
    );

    const result = await indexPythonProject(root);

    expect(result.issues).toEqual([]);
    expect(result.modules[0]?.imports).toEqual([
      {
        specifier: 'os',
        kind: 'import',
        module: 'os',
        relativeLevel: 0,
      },
      {
        specifier: 'package.module',
        kind: 'import',
        module: 'package.module',
        relativeLevel: 0,
      },
      {
        specifier: '.local',
        kind: 'from',
        module: '',
        relativeLevel: 1,
        importedName: 'local',
      },
      {
        specifier: '..core.thing',
        kind: 'from',
        module: 'core',
        relativeLevel: 2,
        importedName: 'thing',
      },
      {
        specifier: 'package.submodule',
        kind: 'from',
        module: 'package',
        relativeLevel: 0,
        importedName: 'submodule',
      },
      {
        specifier: 'package.name',
        kind: 'from',
        module: 'package',
        relativeLevel: 0,
        importedName: 'name',
      },
      {
        specifier: 'package',
        kind: 'from',
        module: 'package',
        relativeLevel: 0,
      },
    ]);
  });

  it('reports bounded source-free parse, size, and encoding issues', async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, 'broken.py'), 'def broken(:\n secret_value\n');
    await writeFile(join(root, 'large.py'), 'x'.repeat(100));
    await writeFile(join(root, 'invalid.py'), Buffer.from([0xff, 0xfe, 0xfd]));
    await writeFile(join(root, 'many-errors.py'), '@ @\n'.repeat(250));

    const result = await indexPythonProject(root, { maxFileBytes: 2_000 });

    expect(result.issues).toContainEqual({
      kind: 'parse-error-limit',
      path: 'many-errors.py',
    });
    expect(result.issues).toContainEqual({
      kind: 'invalid-utf8',
      path: 'invalid.py',
    });
    const parseIssue = result.issues.find(({ kind }) => kind === 'parse-error');
    expect(parseIssue).toMatchObject({
      kind: 'parse-error',
      path: 'broken.py',
      line: expect.any(Number),
      column: expect.any(Number),
    });
    expect(JSON.stringify(result.issues)).not.toContain('secret_value');

    const sizeLimited = await indexPythonProject(root, { maxFileBytes: 50 });
    expect(sizeLimited.issues).toContainEqual({
      kind: 'file-too-large',
      path: 'large.py',
    });
  });
});
