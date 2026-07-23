import { GitCommandError, runGit } from './command.js';
import { resolveRevision } from './revision.js';

export async function worktreeMatchesRevision(
  repositoryRoot: string,
  revision: string,
  timeoutMs = 10_000,
): Promise<boolean> {
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(revision)) {
    throw new GitCommandError('Revision must be a resolved Git object id');
  }
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 120_000
  ) {
    throw new GitCommandError('timeoutMs must be an integer from 1 to 120000');
  }
  const head = await resolveRevision(repositoryRoot, 'HEAD', { timeoutMs });
  if (head !== revision) return false;
  const status = await runGit(
    repositoryRoot,
    ['status', '--porcelain=v1', '-z', '--untracked-files=normal'],
    timeoutMs,
  );
  return status.length === 0;
}
