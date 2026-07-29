import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  inspectReleaseReadiness,
  parseReleaseTag,
} from './release-readiness.mjs';

const execFileAsync = promisify(execFile);
const temporaryRoots = [];

async function git(root, args) {
  return execFileAsync('git', args, { cwd: root, encoding: 'utf8' });
}

async function candidate() {
  const root = await mkdtemp(join(tmpdir(), 'change-risk-release-'));
  temporaryRoots.push(root);
  await Promise.all([
    mkdir(join(root, 'docs'), { recursive: true }),
    mkdir(join(root, '.github/workflows'), { recursive: true }),
    mkdir(join(root, 'action-dist'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(root, 'README.md'), 'readme\n'),
    writeFile(join(root, 'PRODUCT.md'), 'product\n'),
    writeFile(join(root, 'ROADMAP.md'), 'roadmap\n'),
    writeFile(join(root, 'BACKLOG.md'), 'backlog\n'),
    writeFile(join(root, 'SECURITY.md'), 'security\n'),
    writeFile(join(root, 'CONTRIBUTING.md'), 'contributing\n'),
    writeFile(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.1.0] - Unreleased\n',
    ),
    writeFile(
      join(root, 'LICENSE'),
      'Apache License\nVersion 2.0, January 2004\n',
    ),
    writeFile(join(root, 'docs/release-readiness.md'), 'standard\n'),
    writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        license: 'Apache-2.0',
        repository: {
          type: 'git',
          url: 'git+https://github.com/blacwh/change-risk-engine.git',
        },
        scripts: {
          'verify:release': 'node scripts/release-readiness.mjs',
        },
      }),
    ),
    writeFile(
      join(root, '.github/workflows/release.yml'),
      'run: npm run verify:release -- "$RELEASE_VERSION"\n',
    ),
    writeFile(join(root, 'action.yml'), 'runs:\n  using: node24\n'),
    writeFile(join(root, 'action-dist/index.js'), 'export {};\n'),
  ]);
  await git(root, ['init', '--initial-branch=main']);
  await git(root, ['config', 'user.name', 'Release Fixture']);
  await git(root, ['config', 'user.email', 'release@example.invalid']);
  await git(root, ['add', '--all']);
  await git(root, ['commit', '--message', 'candidate', '--quiet']);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('release readiness', () => {
  it('validates v-prefixed semantic versions', () => {
    expect(parseReleaseTag('v0.1.0')).toEqual({
      tag: 'v0.1.0',
      version: '0.1.0',
    });
    expect(parseReleaseTag('v1.2.3-rc.1')).toEqual({
      tag: 'v1.2.3-rc.1',
      version: '1.2.3-rc.1',
    });
    expect(() => parseReleaseTag('0.1.0')).toThrow(/v-prefixed/);
    expect(() => parseReleaseTag('v01.0.0')).toThrow(/v-prefixed/);
    expect(() => parseReleaseTag('v1.2.3-rc.01')).toThrow(/v-prefixed/);
  });

  it('passes a clean pre-tag candidate and requires the exact tag in tagged mode', async () => {
    const root = await candidate();
    const preTag = await inspectReleaseReadiness({
      repositoryRoot: root,
      tag: 'v0.1.0',
      allowUntagged: true,
    });
    expect(preTag.checks.filter(({ status }) => status === 'fail')).toEqual([]);
    expect(preTag.ready).toBe(true);
    expect(preTag.checks).toContainEqual(
      expect.objectContaining({ id: 'git:tag', status: 'pass' }),
    );

    const untagged = await inspectReleaseReadiness({
      repositoryRoot: root,
      tag: 'v0.1.0',
    });
    expect(untagged.ready).toBe(false);
    expect(untagged.checks).toContainEqual(
      expect.objectContaining({ id: 'git:tag', status: 'fail' }),
    );

    await writeFile(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.1.0] - 2026-07-29\n',
    );
    await git(root, ['add', 'CHANGELOG.md']);
    await git(root, ['commit', '--message', 'date release', '--quiet']);
    await git(root, ['tag', 'v0.1.0']);
    const tagged = await inspectReleaseReadiness({
      repositoryRoot: root,
      tag: 'v0.1.0',
    });
    expect(tagged.ready).toBe(true);
  });

  it('reports missing legal metadata, stale tags, and dirty candidates', async () => {
    const root = await candidate();
    await git(root, ['tag', 'v0.1.0']);
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          'verify:release': 'node scripts/release-readiness.mjs',
        },
      }),
    );
    const result = await inspectReleaseReadiness({
      repositoryRoot: root,
      tag: 'v0.1.0',
      allowUntagged: true,
    });
    expect(result.ready).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'package:license', status: 'fail' }),
        expect.objectContaining({ id: 'package:repository', status: 'fail' }),
        expect.objectContaining({ id: 'git:clean', status: 'fail' }),
      ]),
    );

    await git(root, ['add', 'package.json']);
    await git(root, ['commit', '--message', 'move head', '--quiet']);
    const staleTag = await inspectReleaseReadiness({
      repositoryRoot: root,
      tag: 'v0.1.0',
      allowUntagged: true,
    });
    expect(staleTag.checks).toContainEqual(
      expect.objectContaining({ id: 'git:tag', status: 'fail' }),
    );
  });
});
