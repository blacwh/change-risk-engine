import { describe, expect, it } from 'vitest';

import { classifyChangedFiles, classifyFile } from './classification.js';

describe('file classification', () => {
  it.each([
    ['src/index.ts', ['source']],
    ['src/index.test.ts', ['source', 'test']],
    ['docs/guide.md', ['documentation']],
    ['package-lock.json', ['dependency', 'lockfile']],
    ['dist/client.generated.js', ['source', 'generated']],
    ['terraform/main.tf', ['infrastructure']],
    ['.github/workflows/ci.yml', ['ci']],
    ['prisma/migrations/001/schema.sql', ['migration']],
    ['vitest.config.ts', ['source', 'configuration']],
    ['public/logo.svg', ['asset']],
    ['NOTICE', ['other']],
  ] as const)('classifies %s in stable category order', (path, categories) => {
    expect(classifyFile(path)).toEqual(categories);
  });

  it('does not mutate changed-file evidence', () => {
    const file = { path: 'src/index.ts', status: 'modified' as const };
    expect(classifyChangedFiles([file])).toEqual([
      { ...file, categories: ['source'] },
    ]);
    expect(file).toEqual({ path: 'src/index.ts', status: 'modified' });
  });

  it.each([
    ['src/service.py', ['source']],
    ['src/service.pyi', ['source']],
    ['test_service.py', ['source', 'test']],
    ['service_test.py', ['source', 'test']],
    ['tests/service.py', ['source', 'test']],
    ['tests/service.pyi', ['source']],
    ['src/service.ts', ['other']],
  ] as const)(
    'classifies Python selection path %s in stable category order',
    (path, categories) => {
      expect(classifyFile(path, { language: 'python' })).toEqual(categories);
    },
  );
});
