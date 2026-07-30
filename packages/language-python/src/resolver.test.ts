import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolvePythonProject } from './resolver.js';

const roots: string[] = [];

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-python-resolution-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('Python repository module resolution', () => {
  it('resolves absolute, from, relative, fallback, external, and unresolved imports', async () => {
    const root = await temporaryRepository();
    await mkdir(join(root, 'package', 'nested'), { recursive: true });
    await writeFile(
      join(root, 'package', '__init__.py'),
      'exported_name = 1\n',
    );
    await writeFile(join(root, 'package', 'module.py'), 'value = 1\n');
    await writeFile(join(root, 'package', 'submodule.py'), 'value = 1\n');
    await writeFile(join(root, 'package', 'nested', '__init__.py'), '');
    await writeFile(join(root, 'package', 'nested', 'sibling.py'), '');
    await writeFile(
      join(root, 'package', 'nested', 'current.py'),
      [
        'from . import sibling',
        'from .. import module',
        'from ...outside import bad',
      ].join('\n'),
    );
    await writeFile(
      join(root, 'main.py'),
      [
        'import os, package.module',
        'from package import submodule, exported_name',
        'from package import *',
        'from package.missing import value',
      ].join('\n'),
    );

    const result = await resolvePythonProject(root);
    const mainImports = result.modules.find(
      ({ path }) => path === 'main.py',
    )?.imports;
    expect(mainImports).toEqual([
      expect.objectContaining({ specifier: 'os', resolution: 'external' }),
      expect.objectContaining({
        specifier: 'package.module',
        resolution: 'internal',
        targetPath: 'package/module.py',
      }),
      expect.objectContaining({
        specifier: 'package.submodule',
        resolution: 'internal',
        targetPath: 'package/submodule.py',
      }),
      expect.objectContaining({
        specifier: 'package.exported_name',
        resolution: 'internal',
        targetPath: 'package/__init__.py',
      }),
      expect.objectContaining({
        specifier: 'package',
        resolution: 'internal',
        targetPath: 'package/__init__.py',
      }),
      expect.objectContaining({
        specifier: 'package.missing.value',
        resolution: 'unresolved',
      }),
    ]);

    const relativeImports = result.modules.find(
      ({ path }) => path === 'package/nested/current.py',
    )?.imports;
    expect(relativeImports).toEqual([
      expect.objectContaining({
        specifier: '.sibling',
        resolution: 'internal',
        targetPath: 'package/nested/sibling.py',
      }),
      expect.objectContaining({
        specifier: '..module',
        resolution: 'internal',
        targetPath: 'package/module.py',
      }),
      expect.objectContaining({
        specifier: '...outside.bad',
        resolution: 'unresolved',
      }),
    ]);
    expect(result.issues).toContainEqual({
      kind: 'unresolved-import',
      path: 'main.py',
      specifier: 'package.missing.value',
    });
  });

  it('uses src roots, prefers implementations over stubs, and exposes ambiguity', async () => {
    const root = await temporaryRepository();
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(
      join(root, 'consumer.py'),
      'import selected\nimport clash\n',
    );
    await writeFile(join(root, 'selected.py'), 'value = 1\n');
    await writeFile(join(root, 'selected.pyi'), 'value: int\n');
    await writeFile(join(root, 'clash.py'), 'value = 1\n');
    await writeFile(join(root, 'src', 'clash.py'), 'value = 2\n');

    const result = await resolvePythonProject(root);
    const imports = result.modules.find(
      ({ path }) => path === 'consumer.py',
    )?.imports;

    expect(imports).toEqual([
      expect.objectContaining({
        specifier: 'selected',
        resolution: 'internal',
        targetPath: 'selected.py',
      }),
      expect.objectContaining({
        specifier: 'clash',
        resolution: 'unresolved',
      }),
    ]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          kind: 'ambiguous-module',
          path: 'clash.py',
          specifier: 'clash',
        },
        {
          kind: 'ambiguous-module',
          path: 'src/clash.py',
          specifier: 'clash',
        },
      ]),
    );
  });

  it('reports unavailable namespace identities and is byte-stable across runs', async () => {
    const root = await temporaryRepository();
    await mkdir(join(root, 'scripts'), { recursive: true });
    await writeFile(join(root, 'scripts', 'tool.py'), 'import external\n');
    await writeFile(join(root, 'invalid-name.py'), 'value = 1\n');

    const first = await resolvePythonProject(root);
    const second = await resolvePythonProject(root);

    expect(first).toEqual(second);
    expect(first.issues).toContainEqual({
      kind: 'module-identity-unavailable',
      path: 'scripts/tool.py',
    });
    expect(first.issues).toContainEqual({
      kind: 'module-identity-unavailable',
      path: 'invalid-name.py',
    });
  });
});
