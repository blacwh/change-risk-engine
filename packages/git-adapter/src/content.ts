import { posix } from 'node:path';

import { GitCommandError, runGit } from './command.js';

export type ReadRevisionFileOptions = {
  maxBytes?: number;
  timeoutMs?: number;
};

function validateObjectId(revision: string): void {
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(revision)) {
    throw new GitCommandError('Revision must be a resolved Git object id');
  }
}

function validatePath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 4_096 ||
    path.includes('\\') ||
    path.includes('\0') ||
    posix.isAbsolute(path) ||
    path === '..' ||
    path.startsWith('../') ||
    posix.normalize(path) !== path
  ) {
    throw new GitCommandError('File path must be a normalized repository path');
  }
}

export async function readFileAtRevision(
  repositoryRoot: string,
  revision: string,
  path: string,
  options: ReadRevisionFileOptions = {},
): Promise<string> {
  validateObjectId(revision);
  validatePath(path);
  const maxBytes = options.maxBytes ?? 1_000_000;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    maxBytes > 4_000_000
  ) {
    throw new GitCommandError('maxBytes must be an integer from 1 to 4000000');
  }
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 120_000
  ) {
    throw new GitCommandError('timeoutMs must be an integer from 1 to 120000');
  }

  const object = `${revision}:${path}`;
  const sizeText = await runGit(
    repositoryRoot,
    ['cat-file', '-s', object],
    timeoutMs,
  );
  const size = Number(sizeText.trim());
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new GitCommandError('Git returned an invalid file size');
  }
  if (size > maxBytes) {
    throw new GitCommandError(
      'Revision file exceeds the configured size limit',
    );
  }
  return runGit(repositoryRoot, ['cat-file', 'blob', object], timeoutMs);
}
