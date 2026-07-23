import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from '../../fixtures/src/index.js';
import { typeScriptLanguageAdapter } from './adapter.js';

describe('TypeScript language adapter contract', () => {
  it('selects supported paths and returns the normalized shared index shape', async () => {
    expect(typeScriptLanguageAdapter.canHandle('src/index.ts')).toBe(true);
    expect(typeScriptLanguageAdapter.canHandle('src/index.py')).toBe(false);
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'src/index.ts': "import { value } from './value.js';\n",
          'src/value.ts': 'export const value = 1;\n',
        },
      },
    ]);
    try {
      const index = await typeScriptLanguageAdapter.indexRepository(
        fixture.path,
        { maxEntries: 100, maxFiles: 100, maxFileBytes: 100_000 },
      );
      expect(index.modules.map(({ path }) => path)).toEqual([
        'src/index.ts',
        'src/value.ts',
      ]);
      expect(index.modules[0]?.imports[0]).toMatchObject({
        resolution: 'internal',
        targetPath: 'src/value.ts',
      });
    } finally {
      await fixture.cleanup();
    }
  });
});
