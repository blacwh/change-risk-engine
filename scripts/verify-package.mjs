import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function execFileAsync(file, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error !== null) rejectPromise(error);
      else resolvePromise({ stdout, stderr });
    });
  });
}
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = (await readdir(join(repositoryRoot, 'dist'))).filter((name) =>
  name.endsWith('.tgz'),
);
if (artifacts.length !== 1) {
  throw new Error('Exactly one packaged CLI artifact is required');
}
const archive = join(repositoryRoot, 'dist', artifacts[0]);
const installRoot = await mkdtemp(join(tmpdir(), 'change-risk-package-'));
try {
  await execFileAsync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefix',
      installRoot,
      archive,
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  const executable = join(installRoot, 'node_modules/.bin/change-risk');
  const { stdout: versionOutput } = await execFileAsync(
    executable,
    ['--version'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );
  const installedVersion = String(versionOutput).trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(installedVersion)) {
    throw new Error(
      `Installed CLI did not report the packaged version: ${JSON.stringify(installedVersion)}`,
    );
  }
  const { stdout } = await execFileAsync(
    executable,
    [
      'analyze',
      '--repo',
      repositoryRoot,
      '--base',
      'HEAD~1',
      '--head',
      'HEAD',
      '--format',
      'json',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  const report = JSON.parse(stdout);
  if (
    report.schemaVersion !== 1 ||
    typeof report.score !== 'number' ||
    !Array.isArray(report.limitations)
  ) {
    throw new Error('Installed CLI returned an invalid analysis result');
  }
  const { stdout: html } = await execFileAsync(
    executable,
    [
      'analyze',
      '--repo',
      repositoryRoot,
      '--base',
      'HEAD~1',
      '--head',
      'HEAD',
      '--format',
      'html',
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (
    !html.startsWith('<!doctype html>') ||
    !html.includes('Content-Security-Policy') ||
    !html.includes('Repository change report')
  ) {
    throw new Error('Installed CLI returned an invalid HTML report');
  }
  process.stdout.write(`verified ${artifacts[0]} (${installedVersion})\n`);
} finally {
  await rm(installRoot, { force: true, recursive: true });
}
