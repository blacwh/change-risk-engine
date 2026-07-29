import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseCodeowners, readCodeowners } from './ownership.js';

const temporaryRoots: string[] = [];

async function repositoryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-ownership-'));
  temporaryRoots.push(root);
  await mkdir(join(root, '.github'), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('CODEOWNERS parsing', () => {
  it('applies root, basename, directory, globstar, and last-match rules', () => {
    const result = parseCodeowners(
      [
        '* @global',
        '*.ts @typescript',
        '/docs/ @docs',
        'docs/* @docs-direct',
        'src/**/generated/* @generated',
        'src/auth/*.ts @auth @org/security',
        'src/auth/login.ts owner@example.com # narrower owner',
        'apps/ @apps',
        '/apps/github',
        '**/logs @logs',
        '/root-only/ @root',
      ].join('\n'),
      [
        'README.md',
        'apps/github/action.ts',
        'apps/web/index.ts',
        'build/logs/archive.txt',
        'docs/direct.md',
        'docs/guide/setup.md',
        'nested/apps/tool.ts',
        'nested/root-only/file.ts',
        'root-only/file.ts',
        'src/auth/login.ts',
        'src/auth/token.ts',
        'src/deep/generated/client.ts',
      ],
    );
    expect(result).toEqual({
      issues: [],
      relationships: [
        { path: 'README.md', owners: ['@global'] },
        { path: 'apps/github/action.ts', owners: [] },
        { path: 'apps/web/index.ts', owners: ['@apps'] },
        { path: 'build/logs/archive.txt', owners: ['@logs'] },
        { path: 'docs/direct.md', owners: ['@docs-direct'] },
        { path: 'docs/guide/setup.md', owners: ['@docs'] },
        { path: 'nested/apps/tool.ts', owners: ['@apps'] },
        { path: 'nested/root-only/file.ts', owners: ['@typescript'] },
        { path: 'root-only/file.ts', owners: ['@root'] },
        { path: 'src/auth/login.ts', owners: ['owner@example.com'] },
        { path: 'src/auth/token.ts', owners: ['@auth', '@org/security'] },
        { path: 'src/deep/generated/client.ts', owners: ['@generated'] },
      ],
    });
  });

  it('returns explicit unowned relationships for unmatched paths', () => {
    expect(parseCodeowners('docs/** @docs\n', ['src/index.ts'])).toEqual({
      issues: [],
      relationships: [{ path: 'src/index.ts', owners: [] }],
    });
    expect(
      parseCodeowners('** @all\nfile?.ts @numbered\n', [
        'deep/path/value.md',
        'src/file1.ts',
      ]),
    ).toEqual({
      issues: [],
      relationships: [
        { path: 'deep/path/value.md', owners: ['@all'] },
        { path: 'src/file1.ts', owners: ['@numbered'] },
      ],
    });
  });

  it('suppresses relationships when any line is malformed or unsupported', () => {
    expect(
      parseCodeowners(
        [
          '*.ts @valid',
          '!secret.ts @invalid',
          '[ab].ts @invalid',
          '\\#escaped @invalid',
          '*.go not-an-owner',
          'bad//path @invalid',
        ].join('\n'),
        ['src/index.ts'],
      ),
    ).toEqual({
      issues: [
        { kind: 'unsupported-pattern', line: 2 },
        { kind: 'unsupported-pattern', line: 3 },
        { kind: 'unsupported-pattern', line: 4 },
        { kind: 'invalid-owner', line: 5 },
        { kind: 'unsupported-pattern', line: 6 },
      ],
    });
    const manyIssues = parseCodeowners(
      Array.from({ length: 200 }, () => '!invalid @owner').join('\n'),
      [],
    );
    expect(manyIssues.issues).toHaveLength(100);
    expect(manyIssues.issues.at(-1)).toEqual({ kind: 'issue-limit' });
  });

  it('enforces file, line, pattern, owner, and rule limits', () => {
    expect(parseCodeowners('* @owner\n', [], { maxFileBytes: 3 })).toEqual({
      issues: [{ kind: 'file-size-limit' }],
    });
    expect(
      parseCodeowners('* @owner\n*.ts @typescript', [], { maxLines: 1 }),
    ).toEqual({
      issues: [{ kind: 'line-count-limit' }],
    });
    expect(
      parseCodeowners('long-pattern @owner', [], { maxPatternLength: 4 }),
    ).toEqual({
      issues: [{ kind: 'pattern-length-limit', line: 1 }],
    });
    expect(parseCodeowners('*.ts @owner', [], { maxLineLength: 4 })).toEqual({
      issues: [{ kind: 'line-length-limit', line: 1 }],
    });
    expect(parseCodeowners('* @one @two', [], { maxOwnersPerRule: 1 })).toEqual(
      { issues: [{ kind: 'owner-count-limit', line: 1 }] },
    );
    expect(parseCodeowners('* @one\n*.ts @two', [], { maxRules: 1 })).toEqual({
      issues: [{ kind: 'rule-limit', line: 2 }],
    });
    expect(
      parseCodeowners('* @one\n*.ts @two', ['src/a.ts'], {
        maxMatches: 1,
      }),
    ).toEqual({ issues: [{ kind: 'match-limit' }] });
  });

  it('rejects invalid caller paths and produces byte-stable repeat results', () => {
    expect(() => parseCodeowners('* @owner', ['../outside'])).toThrow(
      /normalized repository paths/,
    );
    const source = '*.ts @typescript\n* @fallback\n';
    const paths = ['src/z.ts', 'src/a.ts'];
    expect(JSON.stringify(parseCodeowners(source, paths))).toBe(
      JSON.stringify(parseCodeowners(source, paths)),
    );
  });
});

describe('CODEOWNERS file reads', () => {
  it('reads the fixed root .github/CODEOWNERS file without following links', async () => {
    const root = await repositoryRoot();
    await writeFile(join(root, '.github/CODEOWNERS'), '* @owner\n', 'utf8');
    await expect(readCodeowners(root, ['src/index.ts'])).resolves.toEqual({
      issues: [],
      relationships: [{ path: 'src/index.ts', owners: ['@owner'] }],
    });

    const linkedRoot = await repositoryRoot();
    const outside = join(linkedRoot, 'outside');
    await writeFile(outside, '* @outside\n', 'utf8');
    await symlink(outside, join(linkedRoot, '.github/CODEOWNERS'));
    await expect(readCodeowners(linkedRoot, ['src/index.ts'])).resolves.toEqual(
      { issues: [{ kind: 'symlink' }] },
    );

    const parentLinkedRoot = await mkdtemp(
      join(tmpdir(), 'change-risk-ownership-'),
    );
    temporaryRoots.push(parentLinkedRoot);
    const actualDirectory = join(parentLinkedRoot, 'actual-github');
    await mkdir(actualDirectory);
    await writeFile(
      join(actualDirectory, 'CODEOWNERS'),
      '* @outside\n',
      'utf8',
    );
    await symlink(actualDirectory, join(parentLinkedRoot, '.github'));
    await expect(
      readCodeowners(parentLinkedRoot, ['src/index.ts']),
    ).resolves.toEqual({ issues: [{ kind: 'symlink' }] });
  });

  it('distinguishes a missing file from an oversized regular file', async () => {
    const root = await repositoryRoot();
    await expect(readCodeowners(root, [])).resolves.toEqual({
      issues: [{ kind: 'file-missing' }],
    });
    await mkdir(join(root, '.github/CODEOWNERS'));
    await expect(readCodeowners(root, [])).resolves.toEqual({
      issues: [{ kind: 'not-regular-file' }],
    });
    await rm(join(root, '.github/CODEOWNERS'), { recursive: true });
    await writeFile(join(root, '.github/CODEOWNERS'), '* @owner\n', 'utf8');
    await expect(
      readCodeowners(root, [], { maxFileBytes: 3 }),
    ).resolves.toEqual({ issues: [{ kind: 'file-size-limit' }] });

    await writeFile(
      join(root, '.github/CODEOWNERS'),
      new Uint8Array([0xc3, 0x28]),
    );
    await expect(readCodeowners(root, [])).resolves.toEqual({
      issues: [{ kind: 'invalid-utf8' }],
    });
  });
});
