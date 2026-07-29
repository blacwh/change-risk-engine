import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const VERSION =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

function check(id, passed, detail) {
  return { id, status: passed ? 'pass' : 'fail', detail };
}

async function text(root, path) {
  return readFile(join(root, path), 'utf8').catch(() => undefined);
}

async function git(root, args) {
  return execFileAsync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
    windowsHide: true,
  });
}

export function parseReleaseTag(tag) {
  const match = VERSION.exec(tag);
  if (
    match === null ||
    (match[4] ?? '')
      .split('.')
      .some(
        (identifier) =>
          /^\d+$/u.test(identifier) &&
          identifier.length > 1 &&
          identifier.startsWith('0'),
      )
  ) {
    throw new Error('Release version must be a v-prefixed semantic version');
  }
  return { tag, version: tag.slice(1) };
}

export async function inspectReleaseReadiness({
  repositoryRoot,
  tag,
  allowUntagged = false,
}) {
  const root = resolve(repositoryRoot);
  const { version } = parseReleaseTag(tag);
  const checks = [];
  const requiredFiles = [
    'README.md',
    'PRODUCT.md',
    'ROADMAP.md',
    'BACKLOG.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'LICENSE',
    'docs/release-readiness.md',
  ];
  for (const path of requiredFiles) {
    const contents = await text(root, path);
    checks.push(
      check(
        `file:${path}`,
        contents !== undefined && contents.trim().length > 0,
        contents === undefined || contents.trim().length === 0
          ? `${path} is missing or empty`
          : `${path} is present`,
      ),
    );
  }

  const manifestSource = await text(root, 'package.json');
  let manifest;
  try {
    manifest =
      manifestSource === undefined ? undefined : JSON.parse(manifestSource);
  } catch {
    manifest = undefined;
  }
  checks.push(
    check(
      'package:manifest',
      manifest !== undefined,
      manifest === undefined
        ? 'package.json is missing or invalid'
        : 'package.json is valid JSON',
    ),
  );
  const license = await text(root, 'LICENSE');
  checks.push(
    check(
      'package:license',
      manifest?.license === 'Apache-2.0' &&
        license?.includes('Apache License') === true &&
        license.includes('Version 2.0, January 2004'),
      manifest?.license === 'Apache-2.0' &&
        license?.includes('Apache License') === true &&
        license.includes('Version 2.0, January 2004')
        ? `package license is ${manifest.license}`
        : 'package.json and LICENSE must declare Apache-2.0',
    ),
  );
  checks.push(
    check(
      'package:repository',
      manifest?.repository?.type === 'git' &&
        manifest.repository.url ===
          'git+https://github.com/blacwh/change-risk-engine.git',
      'package repository metadata must identify blacwh/change-risk-engine',
    ),
  );
  checks.push(
    check(
      'package:script',
      manifest?.scripts?.['verify:release'] ===
        'node scripts/release-readiness.mjs',
      'verify:release script must invoke the committed preflight',
    ),
  );

  const changelog = await text(root, 'CHANGELOG.md');
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const releaseHeading = new RegExp(
    `^## \\[${escapedVersion}\\] - (.+)$`,
    'mu',
  ).exec(changelog ?? '');
  checks.push(
    check(
      'changelog:entry',
      releaseHeading !== null,
      releaseHeading === null
        ? `CHANGELOG.md has no ${version} release heading`
        : `CHANGELOG.md contains ${version}`,
    ),
  );
  checks.push(
    check(
      'changelog:date',
      allowUntagged || /^\d{4}-\d{2}-\d{2}$/u.test(releaseHeading?.[1] ?? ''),
      allowUntagged || /^\d{4}-\d{2}-\d{2}$/u.test(releaseHeading?.[1] ?? '')
        ? 'changelog date is acceptable for this mode'
        : 'tagged releases require a YYYY-MM-DD changelog date',
    ),
  );

  const workflow = await text(root, '.github/workflows/release.yml');
  checks.push(
    check(
      'workflow:preflight',
      workflow?.includes('npm run verify:release -- "$RELEASE_VERSION"') ===
        true,
      'release workflow must run tagged release preflight',
    ),
  );
  const action = await text(root, 'action.yml');
  const actionBundle = await text(root, 'action-dist/index.js');
  checks.push(
    check(
      'action:bundle',
      action?.includes('using: node24') === true &&
        actionBundle !== undefined &&
        actionBundle.length > 0,
      'Node 24 Action metadata and committed bundle must be present',
    ),
  );

  try {
    const status = (await git(root, ['status', '--porcelain'])).stdout.trim();
    checks.push(
      check(
        'git:clean',
        status.length === 0,
        status.length === 0
          ? 'candidate tree is clean'
          : 'candidate tree is dirty',
      ),
    );
    const head = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
    const tagCommit = await git(root, [
      'rev-parse',
      '--verify',
      `refs/tags/${tag}^{commit}`,
    ])
      .then(({ stdout }) => stdout.trim())
      .catch(() => undefined);
    const tagPassed = allowUntagged
      ? tagCommit === undefined || tagCommit === head
      : tagCommit === head;
    checks.push(
      check(
        'git:tag',
        tagPassed,
        tagPassed
          ? tagCommit === undefined
            ? `${tag} is available for the candidate`
            : `${tag} points at HEAD`
          : allowUntagged
            ? `${tag} already points at another commit`
            : `${tag} does not point at HEAD`,
      ),
    );
  } catch {
    checks.push(
      check(
        'git:repository',
        false,
        'candidate root is not a readable Git repository',
      ),
    );
  }

  return {
    tag,
    version,
    mode: allowUntagged ? 'pre-tag' : 'tagged',
    ready: checks.every(({ status }) => status === 'pass'),
    checks,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const versions = args.filter((argument) => argument !== '--allow-untagged');
  const tag = versions[0];
  if (
    tag === undefined ||
    versions.length !== 1 ||
    args.some(
      (argument) => argument !== '--allow-untagged' && argument !== tag,
    ) ||
    args.filter((argument) => argument === '--allow-untagged').length > 1
  ) {
    throw new Error(
      'Usage: npm run verify:release -- <vX.Y.Z> [--allow-untagged]',
    );
  }
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = await inspectReleaseReadiness({
    repositoryRoot,
    tag,
    allowUntagged: args.includes('--allow-untagged'),
  });
  for (const item of result.checks) {
    process.stdout.write(
      `${item.status === 'pass' ? 'PASS' : 'FAIL'} ${item.id}: ${item.detail}\n`,
    );
  }
  process.stdout.write(
    `${result.ready ? 'READY' : 'NOT READY'} ${result.tag} (${result.mode})\n`,
  );
  if (!result.ready) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    process.stderr.write(`release-readiness: ${message}\n`);
    process.exitCode = 1;
  });
}
