import { GitCommandError, runGit } from './command.js';
import { resolveRevision } from './revision.js';

export type GitChangedFile = {
  path: string;
  previousPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  binary: boolean;
};

export type GitDiff = {
  baseRevision: string;
  headRevision: string;
  files: readonly GitChangedFile[];
};

export type CollectChangedFilesOptions = {
  timeoutMs?: number;
  renameThreshold?: number;
};

type NameStatus = Pick<GitChangedFile, 'path' | 'previousPath' | 'status'>;
type LineStats = Pick<GitChangedFile, 'additions' | 'deletions' | 'binary'>;

function nulTokens(output: string): string[] {
  const tokens = output.split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  return tokens;
}

function requireToken(tokens: readonly string[], index: number): string {
  const token = tokens[index];
  if (token === undefined || token.length === 0) {
    throw new GitCommandError('Git returned malformed changed-file evidence');
  }
  return token;
}

function parseNameStatus(output: string): NameStatus[] {
  const tokens = nulTokens(output);
  const changes: NameStatus[] = [];
  for (let index = 0; index < tokens.length;) {
    const statusToken = requireToken(tokens, index++);
    const code = statusToken[0];
    if (code === 'R') {
      changes.push({
        status: 'renamed',
        previousPath: requireToken(tokens, index++),
        path: requireToken(tokens, index++),
      });
      continue;
    }
    const statuses = {
      A: 'added',
      D: 'deleted',
      M: 'modified',
      T: 'modified',
    } as const;
    const status =
      code === undefined ? undefined : statuses[code as keyof typeof statuses];
    if (status === undefined) {
      throw new GitCommandError(
        `Unsupported Git change status: ${statusToken}`,
      );
    }
    changes.push({ status, path: requireToken(tokens, index++) });
  }
  return changes;
}

function parseCount(value: string): number {
  if (!/^\d+$/u.test(value))
    throw new GitCommandError('Git returned an invalid line count');
  const count = Number(value);
  if (!Number.isSafeInteger(count))
    throw new GitCommandError('Git line count exceeds safe limits');
  return count;
}

function parseNumstat(output: string): Map<string, LineStats> {
  const tokens = nulTokens(output);
  const stats = new Map<string, LineStats>();
  for (let index = 0; index < tokens.length;) {
    const record = requireToken(tokens, index++);
    const match = /^([^\t]+)\t([^\t]+)\t(.*)$/su.exec(record);
    if (match === null)
      throw new GitCommandError('Git returned malformed line statistics');
    const [, additionsText, deletionsText, inlinePath] = match;
    if (
      additionsText === undefined ||
      deletionsText === undefined ||
      inlinePath === undefined
    ) {
      throw new GitCommandError('Git returned incomplete line statistics');
    }
    let path = inlinePath;
    if (path.length === 0) {
      requireToken(tokens, index++); // previous rename path
      path = requireToken(tokens, index++);
    }
    const binary = additionsText === '-' && deletionsText === '-';
    if (!binary && (additionsText === '-' || deletionsText === '-')) {
      throw new GitCommandError('Git returned inconsistent binary statistics');
    }
    stats.set(path, {
      additions: binary ? 0 : parseCount(additionsText),
      deletions: binary ? 0 : parseCount(deletionsText),
      binary,
    });
  }
  return stats;
}

export async function collectChangedFiles(
  repositoryRoot: string,
  base: string,
  head: string,
  options: CollectChangedFilesOptions = {},
): Promise<GitDiff> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const renameThreshold = options.renameThreshold ?? 50;
  if (
    !Number.isInteger(renameThreshold) ||
    renameThreshold < 0 ||
    renameThreshold > 100
  ) {
    throw new GitCommandError(
      'Rename threshold must be an integer from 0 to 100',
    );
  }
  const [baseRevision, headRevision] = await Promise.all([
    resolveRevision(repositoryRoot, base, { timeoutMs }),
    resolveRevision(repositoryRoot, head, { timeoutMs }),
  ]);
  const renameOption = `--find-renames=${renameThreshold}%`;
  const [nameStatusOutput, numstatOutput] = await Promise.all([
    runGit(
      repositoryRoot,
      [
        'diff',
        '--name-status',
        '-z',
        renameOption,
        baseRevision,
        headRevision,
        '--',
      ],
      timeoutMs,
    ),
    runGit(
      repositoryRoot,
      [
        'diff',
        '--numstat',
        '-z',
        renameOption,
        baseRevision,
        headRevision,
        '--',
      ],
      timeoutMs,
    ),
  ]);
  const changes = parseNameStatus(nameStatusOutput);
  const stats = parseNumstat(numstatOutput);
  const files = changes.map((change) => {
    const lineStats = stats.get(change.path);
    if (lineStats === undefined) {
      throw new GitCommandError(
        `Missing line statistics for changed path: ${change.path}`,
      );
    }
    stats.delete(change.path);
    return { ...change, ...lineStats };
  });
  if (stats.size > 0)
    throw new GitCommandError('Line statistics include unknown changed paths');
  return { baseRevision, headRevision, files };
}
