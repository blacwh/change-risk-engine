import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { indexTypeScriptProject } from './indexer.js';
import {
  loadTypeScriptResolutionConfig,
  resolveModuleIndex,
  resolveTypeScriptProject,
} from './resolver.js';

const roots: string[] = [];

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-resolution-'));
  roots.push(root);
  await mkdir(join(root, 'src', 'folder'), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('TypeScript resolution configuration', () => {
  it('parses bounded JSONC baseUrl and paths while reporting ignored extends', async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, 'tsconfig.json'),
      `{
        // inherited configuration is deliberately not followed
        "extends": "../shared.json",
        "compilerOptions": {
          "baseUrl": ".",
          "paths": { "@/*": ["src/*"] }
        }
      }`,
    );
    await expect(loadTypeScriptResolutionConfig(root)).resolves.toEqual({
      baseUrl: '.',
      paths: { '@/*': ['src/*'] },
      issues: [{ kind: 'config-extends-ignored' }],
    });
  });

  it('rejects aliases that escape the repository and bounds config bytes', async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { paths: { '@/*': ['../outside/*'] } },
      }),
    );
    expect((await loadTypeScriptResolutionConfig(root)).issues).toContainEqual({
      kind: 'config-invalid',
    });
    expect(
      (await loadTypeScriptResolutionConfig(root, 5)).issues,
    ).toContainEqual({
      kind: 'config-unreadable',
    });
  });

  it('does not follow a symlinked root configuration', async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, 'actual.json'), '{}');
    await symlink(join(root, 'actual.json'), join(root, 'tsconfig.json'));
    expect((await loadTypeScriptResolutionConfig(root)).issues).toContainEqual({
      kind: 'config-unreadable',
    });
  });
});

describe('repository module resolution', () => {
  it('resolves relative, index, extension-substituted, alias, and baseUrl imports', async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, 'src', 'index.ts'),
      [
        "import './util.js';",
        "import './folder';",
        "import '@/shared';",
        "import '@missing/item';",
        "import 'src/shared';",
        "import 'react';",
      ].join('\n'),
    );
    await writeFile(join(root, 'src', 'util.ts'), 'export {};\n');
    await writeFile(join(root, 'src', 'folder', 'index.ts'), 'export {};\n');
    await writeFile(join(root, 'src', 'shared.ts'), 'export {};\n');
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@/*': ['src/*'], '@missing/*': ['missing/*'] },
        },
      }),
    );

    const result = await resolveTypeScriptProject(root);
    const imports = result.modules.find(
      ({ path }) => path === 'src/index.ts',
    )?.imports;
    expect(imports).toEqual([
      expect.objectContaining({
        resolution: 'internal',
        targetPath: 'src/util.ts',
      }),
      expect.objectContaining({
        resolution: 'internal',
        targetPath: 'src/folder/index.ts',
      }),
      expect.objectContaining({
        resolution: 'internal',
        targetPath: 'src/shared.ts',
      }),
      expect.objectContaining({
        resolution: 'unresolved',
        specifier: '@missing/item',
      }),
      expect.objectContaining({
        resolution: 'internal',
        targetPath: 'src/shared.ts',
      }),
      expect.objectContaining({ resolution: 'external', specifier: 'react' }),
    ]);
    expect(result.issues).toContainEqual({
      kind: 'unresolved-import',
      path: 'src/index.ts',
      specifier: '@missing/item',
    });
  });

  it('treats unmatched bare imports as external without baseUrl', async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, 'src', 'index.ts'),
      "import 'src/shared';\nimport '../missing';\n",
    );
    await writeFile(join(root, 'src', 'shared.ts'), 'export {};\n');
    const index = await indexTypeScriptProject(root);
    const resolved = resolveModuleIndex(index, {
      baseUrl: null,
      paths: {},
      issues: [],
    });
    expect(
      resolved.modules[0]?.imports.map(({ resolution }) => resolution),
    ).toEqual(['external', 'unresolved']);
    expect(resolved.issues).toContainEqual({
      kind: 'unresolved-import',
      path: 'src/index.ts',
      specifier: '../missing',
    });
  });
});
