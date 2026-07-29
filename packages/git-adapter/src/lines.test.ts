import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createFixtureRepository } from '../../fixtures/src/index.js';
import { collectChangedLines, parseChangedLineDiff } from './lines.js';

const ZERO = '0000000';
const HASH = 'abcdef0';
const execFileAsync = promisify(execFile);

function raw(status: string, paths: readonly string[]): string {
  return `:100644 100644 ${ZERO} ${HASH} ${status}\0${paths.join('\0')}`;
}

function section(body: string): string {
  return `diff --git a/file b/file\n${body}`;
}

describe('changed-line diff parsing', () => {
  it('maps ordered new-side hunk ranges to NUL-delimited raw paths', () => {
    const source =
      [
        raw('M', ['src/a.ts']),
        raw('R100', ['old/name.ts', 'new/name.ts']),
      ].join('\0') +
      '\0\0' +
      section('@@ -1,0 +2,2 @@\n+one\n+two\n@@ -8 +10 @@\n-old\n+new\n') +
      section('similarity index 100%\n');
    expect(parseChangedLineDiff(source)).toEqual([
      {
        path: 'src/a.ts',
        ranges: [
          { start: 2, count: 2 },
          { start: 10, count: 1 },
        ],
      },
      { path: 'new/name.ts', ranges: [] },
    ]);
  });

  it('ignores deleted-side-only hunks and preserves unusual paths', () => {
    const path = 'odd\tline\nname.ts';
    const source =
      `${raw('M', [path])}\0\0` + section('@@ -4,2 +3,0 @@\n-old\n-lines\n');
    expect(parseChangedLineDiff(source)).toEqual([{ path, ranges: [] }]);
  });

  it('rejects malformed structure and bounded dimensions', () => {
    expect(() => parseChangedLineDiff('malformed')).toThrow(/malformed/);
    expect(() => parseChangedLineDiff(`${raw('M', ['a.ts'])}\0\0`)).toThrow(
      /malformed/,
    );
    expect(() =>
      parseChangedLineDiff(
        `${raw('M', ['a.ts'])}\0\0${section('@@ invalid @@\n')}`,
      ),
    ).toThrow(/malformed/);

    const twoFiles =
      `${raw('M', ['a.ts'])}\0${raw('M', ['b.ts'])}\0\0` +
      section('@@ -0,0 +1 @@\n+a\n') +
      section('@@ -0,0 +1 @@\n+b\n');
    expect(() => parseChangedLineDiff(twoFiles, { maxFiles: 1 })).toThrow(
      /file limit/,
    );
    expect(() => parseChangedLineDiff(twoFiles, { maxRanges: 1 })).toThrow(
      /range limit/,
    );
    expect(() =>
      parseChangedLineDiff(twoFiles, { maxChangedLines: 1 }),
    ).toThrow(/count limit/);
    expect(() => parseChangedLineDiff('', { maxFiles: 0 })).toThrow(/maxFiles/);
  });

  it('produces byte-stable repeat results', () => {
    const source =
      `${raw('A', ['src/a.ts'])}\0\0` +
      section('@@ -0,0 +1,2 @@\n+one\n+two\n');
    expect(JSON.stringify(parseChangedLineDiff(source))).toBe(
      JSON.stringify(parseChangedLineDiff(source)),
    );
  });
});

describe('changed-line Git collection', () => {
  it('collects additions and replacements from exact commits', async () => {
    const stable = 'export const stable = true;\n'.repeat(8);
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          '.gitattributes': '*.ts diff=hostile\n',
          'delete-only.ts': 'one\ntwo\nthree\n',
          'old/name.ts': stable,
          'src/[literal].ts': 'before\n',
          'src/binary.ts': new Uint8Array([0, 1, 2]),
          'src/service.ts': 'one\ntwo\nthree\nfour\n',
        },
      },
      {
        message: 'head',
        files: {
          'delete-only.ts': 'one\nthree\n',
          'old/name.ts': null,
          'new/name.ts': stable,
          'src/[literal].ts': 'after\n',
          'src/added.ts': 'first\nsecond\n',
          'src/binary.ts': new Uint8Array([0, 1, 3]),
          'src/service.ts': 'one\nchanged\nthree\nfour\nadded\n',
        },
      },
    ]);
    try {
      await execFileAsync('git', ['config', 'diff.hostile.command', 'false'], {
        cwd: fixture.path,
      });
      await execFileAsync('git', ['config', 'diff.hostile.textconv', 'false'], {
        cwd: fixture.path,
      });
      const result = await collectChangedLines(
        fixture.path,
        fixture.revisions[0]!,
        fixture.revisions[1]!,
      );
      expect(result).toMatchObject({
        baseRevision: fixture.revisions[0],
        headRevision: fixture.revisions[1],
      });
      expect(result.relationships).toContainEqual({
        path: 'src/added.ts',
        ranges: [{ start: 1, count: 2 }],
      });
      expect(result.relationships).toContainEqual({
        path: 'src/service.ts',
        ranges: [
          { start: 2, count: 1 },
          { start: 5, count: 1 },
        ],
      });
      expect(result.relationships).toContainEqual({
        path: 'delete-only.ts',
        ranges: [],
      });
      expect(result.relationships).toContainEqual({
        path: 'new/name.ts',
        ranges: [],
      });
      expect(result.relationships).toContainEqual({
        path: 'src/binary.ts',
        ranges: [],
      });
      await expect(
        collectChangedLines(
          fixture.path,
          fixture.revisions[0]!,
          fixture.revisions[1]!,
          { paths: ['src/[literal].ts'] },
        ),
      ).resolves.toMatchObject({
        relationships: [
          { path: 'src/[literal].ts', ranges: [{ start: 1, count: 1 }] },
        ],
      });
      await expect(
        collectChangedLines(
          fixture.path,
          fixture.revisions[0]!,
          fixture.revisions[1]!,
          { paths: ['old/name.ts', 'new/name.ts'] },
        ),
      ).resolves.toMatchObject({
        relationships: [{ path: 'new/name.ts', ranges: [] }],
      });
      await expect(
        collectChangedLines(
          fixture.path,
          fixture.revisions[0]!,
          fixture.revisions[1]!,
          { paths: ['../outside.ts'] },
        ),
      ).rejects.toThrow(/normalized repository paths/);
    } finally {
      await fixture.cleanup();
    }
  });
});
