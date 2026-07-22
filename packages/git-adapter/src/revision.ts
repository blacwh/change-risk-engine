import { GitCommandError, runGit } from './command.js';

const FULL_OBJECT_ID = /^[0-9a-f]{40,64}$/u;

export type ResolveRevisionOptions = {
  timeoutMs?: number;
};

export async function resolveRevision(
  repositoryRoot: string,
  revision: string,
  options: ResolveRevisionOptions = {},
): Promise<string> {
  if (revision.length === 0 || revision.includes('\0')) {
    throw new GitCommandError(
      'Revision must be a non-empty string without null bytes',
    );
  }

  const timeoutMs = options.timeoutMs ?? 10_000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 60_000
  ) {
    throw new GitCommandError(
      'Git timeout must be an integer from 1 to 60000 milliseconds',
    );
  }

  const output = await runGit(
    repositoryRoot,
    ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`],
    timeoutMs,
  );
  const objectId = output.trim();

  if (!FULL_OBJECT_ID.test(objectId)) {
    throw new GitCommandError('Git returned an invalid commit object id');
  }
  return objectId;
}
