import { GitCommandError, runGit } from './command.js';
import { resolveRevision } from './revision.js';

export type ChangedLineRange = {
  start: number;
  count: number;
};

export type GitChangedLineRelationship = {
  path: string;
  ranges: readonly ChangedLineRange[];
};

export type GitChangedLines = {
  baseRevision: string;
  headRevision: string;
  relationships: readonly GitChangedLineRelationship[];
};

export type CollectChangedLinesOptions = {
  timeoutMs?: number;
  renameThreshold?: number;
  maxFiles?: number;
  maxRanges?: number;
  maxChangedLines?: number;
  paths?: readonly string[];
};

type RequiredChangedLineLimits = {
  maxFiles: number;
  maxRanges: number;
  maxChangedLines: number;
};

const MAX_FILES = 100_000;
const MAX_RANGES = 100_000;
const MAX_CHANGED_LINES = 1_000_000;
const MAX_LINE_NUMBER = 100_000_000;

function boundedPositiveInteger(
  value: number,
  name: string,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new GitCommandError(
      `${name} must be an integer from 1 to ${maximum}`,
    );
  }
  return value;
}

function limits(
  options: CollectChangedLinesOptions,
): RequiredChangedLineLimits {
  return {
    maxFiles: boundedPositiveInteger(
      options.maxFiles ?? MAX_FILES,
      'maxFiles',
      MAX_FILES,
    ),
    maxRanges: boundedPositiveInteger(
      options.maxRanges ?? MAX_RANGES,
      'maxRanges',
      MAX_RANGES,
    ),
    maxChangedLines: boundedPositiveInteger(
      options.maxChangedLines ?? MAX_CHANGED_LINES,
      'maxChangedLines',
      MAX_CHANGED_LINES,
    ),
  };
}

function malformed(): never {
  throw new GitCommandError('Git returned malformed changed-line evidence');
}

function parseRawPaths(source: string, maxFiles: number): string[] {
  const tokens = source.split('\0');
  const paths: string[] = [];
  for (let index = 0; index < tokens.length;) {
    const metadata = tokens[index++];
    const match =
      metadata === undefined
        ? null
        : /^:[0-7]{6} [0-7]{6} [0-9a-f]{7,64} [0-9a-f]{7,64} ([ADMRT])(?:\d{1,3})?$/u.exec(
            metadata,
          );
    if (match === null) malformed();
    const status = match[1];
    if (status === 'R') {
      const previousPath = tokens[index++];
      if (previousPath === undefined || previousPath.length === 0) malformed();
    }
    const path = tokens[index++];
    if (path === undefined || path.length === 0) malformed();
    paths.push(path);
    if (paths.length > maxFiles) {
      throw new GitCommandError('Changed-line file limit exceeded');
    }
  }
  return paths;
}

function patchSections(source: string): string[] {
  const starts = [...source.matchAll(/^diff --git /gmu)].map(
    (match) => match.index,
  );
  return starts.map((start, index) =>
    source.slice(start, starts[index + 1] ?? source.length),
  );
}

function parseSectionRanges(
  source: string,
  state: { ranges: number; changedLines: number },
  limits: RequiredChangedLineLimits,
): ChangedLineRange[] {
  const headers = [...source.matchAll(/^@@ /gmu)];
  const ranges: ChangedLineRange[] = [];
  const expression = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/gmu;
  const matches = [...source.matchAll(expression)];
  if (matches.length !== headers.length) malformed();

  let previousEnd = 0;
  for (const match of matches) {
    const start = Number(match[3]);
    const count = match[4] === undefined ? 1 : Number(match[4]);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      start < (count === 0 ? 0 : 1) ||
      start > MAX_LINE_NUMBER ||
      count > MAX_CHANGED_LINES ||
      start + count - 1 > MAX_LINE_NUMBER
    ) {
      malformed();
    }
    if (count === 0) continue;
    if (start <= previousEnd) malformed();
    previousEnd = start + count - 1;
    state.ranges += 1;
    state.changedLines += count;
    if (state.ranges > limits.maxRanges) {
      throw new GitCommandError('Changed-line range limit exceeded');
    }
    if (state.changedLines > limits.maxChangedLines) {
      throw new GitCommandError('Changed-line count limit exceeded');
    }
    ranges.push({ start, count });
  }
  return ranges;
}

export function parseChangedLineDiff(
  source: string,
  options: CollectChangedLinesOptions = {},
): readonly GitChangedLineRelationship[] {
  const resolvedLimits = limits(options);
  if (source.length === 0) return [];
  const separator = source.indexOf('\0\0');
  if (separator < 0) malformed();
  const paths = parseRawPaths(
    source.slice(0, separator),
    resolvedLimits.maxFiles,
  );
  const sections = patchSections(source.slice(separator + 2));
  if (paths.length !== sections.length) malformed();

  const state = { ranges: 0, changedLines: 0 };
  return paths.map((path, index) => ({
    path,
    ranges: parseSectionRanges(
      sections[index] ?? malformed(),
      state,
      resolvedLimits,
    ),
  }));
}

export async function collectChangedLines(
  repositoryRoot: string,
  base: string,
  head: string,
  options: CollectChangedLinesOptions = {},
): Promise<GitChangedLines> {
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
  const resolvedLimits = limits(options);
  const selectedPaths = options.paths ?? [];
  if (
    selectedPaths.length > resolvedLimits.maxFiles ||
    new Set(selectedPaths).size !== selectedPaths.length ||
    selectedPaths.some(
      (path) =>
        path.length === 0 ||
        path.length > 1_000 ||
        path.startsWith('/') ||
        path.includes('\0') ||
        path.includes('\\') ||
        path
          .split('/')
          .some(
            (segment) =>
              segment.length === 0 || segment === '.' || segment === '..',
          ),
    )
  ) {
    throw new GitCommandError(
      'Changed-line paths must be unique normalized repository paths',
    );
  }
  const [baseRevision, headRevision] = await Promise.all([
    resolveRevision(repositoryRoot, base, { timeoutMs }),
    resolveRevision(repositoryRoot, head, { timeoutMs }),
  ]);
  if (options.paths !== undefined && selectedPaths.length === 0) {
    return { baseRevision, headRevision, relationships: [] };
  }
  const output = await runGit(
    repositoryRoot,
    [
      'diff',
      '--raw',
      '-z',
      '--patch',
      '--unified=0',
      '--abbrev=64',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--diff-algorithm=myers',
      '--no-indent-heuristic',
      '--submodule=short',
      `--find-renames=${renameThreshold}%`,
      baseRevision,
      headRevision,
      '--',
      ...selectedPaths.map((path) => `:(top,literal)${path}`),
    ],
    timeoutMs,
  );
  return {
    baseRevision,
    headRevision,
    relationships: parseChangedLineDiff(output, options),
  };
}
