import { describe, expect, it } from 'vitest';

import { inferConventionalTestRelationships } from './test-relationships.js';

describe('conventional test relationships', () => {
  it('maps common colocated and source/test directory conventions', () => {
    expect(
      inferConventionalTestRelationships([
        'packages/api/test/auth.spec.ts',
        'packages/api/src/auth.ts',
        'src/billing.ts',
        'src/billing.test.ts',
        'src/no-test.ts',
      ]),
    ).toEqual([
      {
        sourcePath: 'packages/api/src/auth.ts',
        testPaths: ['packages/api/test/auth.spec.ts'],
      },
      { sourcePath: 'src/billing.ts', testPaths: ['src/billing.test.ts'] },
      { sourcePath: 'src/no-test.ts', testPaths: [] },
    ]);
  });

  it('rejects duplicate and invalid module path evidence', () => {
    expect(() =>
      inferConventionalTestRelationships(['src/a.ts', 'src/a.ts']),
    ).toThrow(/unique/);
    expect(() => inferConventionalTestRelationships(['../outside.ts'])).toThrow(
      /repository paths/,
    );
  });
});
