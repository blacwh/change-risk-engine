import { describe, expect, it } from 'vitest';

import { inferPythonTestRelationships } from './test-relationships.js';

describe('Python conventional test relationships', () => {
  it('maps pytest filename and tests-directory conventions deterministically', () => {
    const paths = [
      'tests/package/service.py',
      'src/package/service.py',
      'tests/package/test_worker.py',
      'src/package/worker.py',
      'tests/package/helper_test.py',
      'src/package/helper.py',
      'src/package/uncovered.py',
      'src/package/types.pyi',
    ];

    expect(inferPythonTestRelationships(paths)).toEqual([
      {
        sourcePath: 'src/package/helper.py',
        testPaths: ['tests/package/helper_test.py'],
      },
      {
        sourcePath: 'src/package/service.py',
        testPaths: ['tests/package/service.py'],
      },
      {
        sourcePath: 'src/package/types.pyi',
        testPaths: [],
      },
      {
        sourcePath: 'src/package/uncovered.py',
        testPaths: [],
      },
      {
        sourcePath: 'src/package/worker.py',
        testPaths: ['tests/package/test_worker.py'],
      },
    ]);
  });

  it('rejects duplicate, escaping, non-Python, and over-limit paths', () => {
    expect(() =>
      inferPythonTestRelationships(['src/service.py', 'src/service.py']),
    ).toThrow(/unique/u);
    expect(() => inferPythonTestRelationships(['../service.py'])).toThrow(
      /bounded/u,
    );
    expect(() => inferPythonTestRelationships(['src/service.ts'])).toThrow(
      /bounded/u,
    );
    expect(() =>
      inferPythonTestRelationships(
        Array.from({ length: 100_001 }, () => 'service.py'),
      ),
    ).toThrow(/limit/u);
  });
});
