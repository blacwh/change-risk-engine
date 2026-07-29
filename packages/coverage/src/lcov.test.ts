import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseLcov, readLcov } from './lcov.js';

const temporaryRoots: string[] = [];

async function repositoryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-coverage-'));
  temporaryRoots.push(root);
  await mkdir(join(root, 'coverage'), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

function record(
  path: string,
  data: readonly [number, number][],
  extras: readonly string[] = [],
): string {
  const linesFound = data.length;
  const linesHit = data.filter(([, count]) => count > 0).length;
  return [
    `SF:${path}`,
    ...extras,
    ...data.map(([line, count]) => `DA:${line},${count}`),
    `LF:${linesFound}`,
    `LH:${linesHit}`,
    'end_of_record',
  ].join('\n');
}

describe('LCOV parsing', () => {
  it('normalizes records and maps every requested changed source', async () => {
    const root = await repositoryRoot();
    const source = [
      'TN:unit',
      record(
        'src/a.ts',
        [
          [1, 3],
          [2, 0],
        ],
        ['FN:1,run', 'FNDA:3,run', 'FNF:1', 'FNH:1'],
      ),
      record(
        join(root, 'src/absolute.ts'),
        [[4, 1]],
        ['BRDA:4,0,0,1', 'BRF:1', 'BRH:1'],
      ),
      record('src/zero.ts', []),
    ].join('\n');
    expect(
      parseLcov(source, root, [
        'src/zero.ts',
        'src/missing.ts',
        'src/a.ts',
        'src/absolute.ts',
      ]),
    ).toEqual({
      issues: [],
      relationships: [
        { path: 'src/a.ts', linesFound: 2, linesHit: 1 },
        { path: 'src/absolute.ts', linesFound: 1, linesHit: 1 },
        { path: 'src/missing.ts', linesFound: null, linesHit: null },
        { path: 'src/zero.ts', linesFound: 0, linesHit: 0 },
      ],
    });
  });

  it('intersects changed-line ranges with instrumented LCOV lines', async () => {
    const root = await repositoryRoot();
    const source = [
      record('src/a.ts', [
        [1, 2],
        [2, 0],
        [4, 1],
      ]),
      record('src/pure-delete.ts', [[1, 1]]),
    ].join('\n');
    expect(
      parseLcov(
        source,
        root,
        ['src/missing.ts', 'src/pure-delete.ts', 'src/a.ts'],
        {
          changedLineRelationships: [
            {
              path: 'src/a.ts',
              ranges: [
                { start: 1, count: 2 },
                { start: 4, count: 2 },
              ],
            },
            { path: 'src/missing.ts', ranges: [{ start: 3, count: 1 }] },
            { path: 'src/pure-delete.ts', ranges: [] },
          ],
        },
      ),
    ).toEqual({
      issues: [],
      relationships: [
        {
          path: 'src/a.ts',
          linesFound: 3,
          linesHit: 2,
          changedLineCount: 4,
          changedLinesFound: 3,
          changedLinesHit: 2,
        },
        {
          path: 'src/missing.ts',
          linesFound: null,
          linesHit: null,
          changedLineCount: 1,
          changedLinesFound: null,
          changedLinesHit: null,
        },
        {
          path: 'src/pure-delete.ts',
          linesFound: 1,
          linesHit: 1,
          changedLineCount: 0,
          changedLinesFound: 0,
          changedLinesHit: 0,
        },
      ],
    });
  });

  it('rejects partial, duplicate, inconsistent, and unsupported records', async () => {
    const root = await repositoryRoot();
    const duplicateSource = [
      record('src/a.ts', [[1, 1]]),
      record('src/a.ts', [[1, 1]]),
    ].join('\n');
    expect(parseLcov(duplicateSource, root, [])).toMatchObject({
      issues: [{ kind: 'duplicate-source' }],
    });
    expect(
      parseLcov(
        'SF:src/a.ts\nDA:1,1\nDA:1,0\nLF:2\nLH:1\nend_of_record',
        root,
        [],
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        { kind: 'duplicate-data-line', line: 3 },
      ]),
    });
    expect(
      parseLcov('SF:src/a.ts\nDA:1,1\nLF:2\nLH:1\nend_of_record', root, []),
    ).toEqual({
      issues: [{ kind: 'summary-mismatch', line: 5 }],
    });
    expect(
      parseLcov('SF:src/a.ts\nXX:unknown\nLF:0\nLH:0\nend_of_record', root, []),
    ).toMatchObject({
      issues: expect.arrayContaining([{ kind: 'unsupported-record', line: 2 }]),
    });
    expect(parseLcov('FN:1,run', root, [])).toEqual({
      issues: [{ kind: 'invalid-record', line: 1 }],
    });
    expect(parseLcov('SF:src/a.ts\nLF:0\nLH:0', root, [])).toEqual({
      issues: [{ kind: 'unterminated-record', line: 3 }],
    });
  });

  it('rejects invalid source paths and invalid caller paths', async () => {
    const root = await repositoryRoot();
    expect(
      parseLcov(record('../outside.ts', [[1, 1]]), root, []),
    ).toMatchObject({
      issues: [{ kind: 'invalid-source-path', line: 1 }],
    });
    expect(() => parseLcov('', root, ['../outside.ts'])).toThrow(
      /normalized repository paths/,
    );
    expect(() => parseLcov('', 'relative/root', [])).toThrow(
      /root must be absolute/,
    );
    expect(() =>
      parseLcov('', root, ['src/a.ts'], {
        changedLineRelationships: [],
      }),
    ).toThrow(/each coverage path exactly once/);
    expect(() =>
      parseLcov('', root, ['src/a.ts'], {
        changedLineRelationships: [
          {
            path: 'src/a.ts',
            ranges: [
              { start: 2, count: 2 },
              { start: 3, count: 1 },
            ],
          },
        ],
      }),
    ).toThrow(/overlapping ranges/);
    expect(() =>
      parseLcov('', root, ['src/a.ts'], {
        changedLineRelationships: [
          { path: 'src/a.ts', ranges: [{ start: 1, count: 2 }] },
        ],
        maxChangedLines: 1,
      }),
    ).toThrow(/relationship limit|invalid or overlapping/);
  });

  it('enforces byte, line, record, source, data, and issue limits', async () => {
    const root = await repositoryRoot();
    expect(
      parseLcov(record('src/a.ts', []), root, [], {
        maxFileBytes: 3,
      }),
    ).toEqual({ issues: [{ kind: 'file-size-limit' }] });
    expect(parseLcov('TN:a\nTN:b', root, [], { maxLines: 1 })).toEqual({
      issues: [{ kind: 'line-count-limit' }],
    });
    expect(parseLcov('TN:long', root, [], { maxLineLength: 3 })).toEqual({
      issues: [{ kind: 'line-length-limit', line: 1 }],
    });
    expect(
      parseLcov(record('source-name.ts', []), root, [], {
        maxSourcePathLength: 4,
      }),
    ).toMatchObject({
      issues: [{ kind: 'invalid-source-path', line: 1 }],
    });
    expect(
      parseLcov(
        [record('src/a.ts', []), record('src/b.ts', [])].join('\n'),
        root,
        [],
        { maxRecords: 1 },
      ),
    ).toEqual({
      issues: [expect.objectContaining({ kind: 'record-limit' })],
    });
    expect(
      parseLcov(
        record('src/a.ts', [
          [1, 1],
          [2, 1],
        ]),
        root,
        [],
        {
          maxDataLines: 1,
        },
      ),
    ).toEqual({
      issues: [expect.objectContaining({ kind: 'data-line-limit' })],
    });
    const manyIssues = parseLcov(
      Array.from({ length: 200 }, () => 'unsupported').join('\n'),
      root,
      [],
    );
    expect(manyIssues.issues).toHaveLength(100);
    expect(manyIssues.issues.at(-1)).toEqual({ kind: 'issue-limit' });
  });

  it('produces byte-stable repeat results', async () => {
    const root = await repositoryRoot();
    const source = record('src/a.ts', [
      [1, 1],
      [2, 0],
    ]);
    const paths = ['src/missing.ts', 'src/a.ts'];
    expect(JSON.stringify(parseLcov(source, root, paths))).toBe(
      JSON.stringify(parseLcov(source, root, paths)),
    );
  });
});

describe('LCOV file reads', () => {
  it('reads a bounded repository-relative regular file', async () => {
    const root = await repositoryRoot();
    await writeFile(
      join(root, 'coverage/lcov.info'),
      record('src/a.ts', [[1, 1]]),
      'utf8',
    );
    await expect(
      readLcov(root, 'coverage/lcov.info', ['src/a.ts']),
    ).resolves.toEqual({
      issues: [],
      relationships: [{ path: 'src/a.ts', linesFound: 1, linesHit: 1 }],
    });
  });

  it('rejects escaping, linked, missing, non-file, oversized, and invalid UTF-8 input', async () => {
    const root = await repositoryRoot();
    await expect(readLcov(root, 'coverage/missing.info', [])).resolves.toEqual({
      issues: [{ kind: 'artifact-missing' }],
    });
    await expect(readLcov(root, '../outside.info', [])).rejects.toThrow(
      /remain inside/,
    );
    await expect(readLcov(root, 'coverage\\lcov.info', [])).rejects.toThrow(
      /repository-relative/,
    );
    await expect(
      readLcov(root, join(root, 'coverage/lcov.info'), []),
    ).rejects.toThrow(/repository-relative/);

    const outside = join(root, 'outside.info');
    await writeFile(outside, record('src/a.ts', [[1, 1]]), 'utf8');
    await symlink(outside, join(root, 'coverage/lcov.info'));
    await expect(readLcov(root, 'coverage/lcov.info', [])).resolves.toEqual({
      issues: [{ kind: 'symlink' }],
    });
    await rm(join(root, 'coverage/lcov.info'));

    const actualDirectory = join(root, 'actual-coverage');
    await mkdir(actualDirectory);
    await rm(join(root, 'coverage'), { recursive: true });
    await symlink(actualDirectory, join(root, 'coverage'));
    await expect(readLcov(root, 'coverage/lcov.info', [])).resolves.toEqual({
      issues: [{ kind: 'symlink' }],
    });
    await rm(join(root, 'coverage'));
    await mkdir(join(root, 'coverage'));

    await mkdir(join(root, 'coverage/lcov.info'));
    await expect(readLcov(root, 'coverage/lcov.info', [])).resolves.toEqual({
      issues: [{ kind: 'not-regular-file' }],
    });
    await rm(join(root, 'coverage/lcov.info'), { recursive: true });

    await writeFile(join(root, 'coverage/lcov.info'), 'bounded', 'utf8');
    await expect(
      readLcov(root, 'coverage/lcov.info', [], { maxFileBytes: 3 }),
    ).resolves.toEqual({ issues: [{ kind: 'file-size-limit' }] });

    await writeFile(
      join(root, 'coverage/lcov.info'),
      new Uint8Array([0xc3, 0x28]),
    );
    await expect(readLcov(root, 'coverage/lcov.info', [])).resolves.toEqual({
      issues: [{ kind: 'invalid-utf8' }],
    });
  });
});
