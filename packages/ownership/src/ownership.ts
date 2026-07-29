import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { join } from 'node:path';

export const CODEOWNERS_PATH = '.github/CODEOWNERS';

export type CodeownersLimits = {
  maxFileBytes?: number;
  maxLines?: number;
  maxLineLength?: number;
  maxMatches?: number;
  maxRules?: number;
  maxPatternLength?: number;
  maxOwnersPerRule?: number;
  maxOwnerLength?: number;
};

export type OwnershipIssue = {
  kind:
    | 'file-missing'
    | 'file-size-limit'
    | 'invalid-owner'
    | 'invalid-utf8'
    | 'issue-limit'
    | 'line-count-limit'
    | 'line-length-limit'
    | 'match-limit'
    | 'not-regular-file'
    | 'owner-count-limit'
    | 'pattern-length-limit'
    | 'read-failure'
    | 'rule-limit'
    | 'symlink'
    | 'unsupported-pattern';
  line?: number;
};

export type OwnershipRelationship = {
  path: string;
  owners: readonly string[];
};

export type OwnershipResult = {
  relationships?: readonly OwnershipRelationship[];
  issues: readonly OwnershipIssue[];
};

type RequiredLimits = Required<CodeownersLimits>;

type CodeownerRule = {
  owners: readonly string[];
  matches(path: string): boolean;
};

const DEFAULT_LIMITS: RequiredLimits = {
  maxFileBytes: 1_000_000,
  maxLines: 100_000,
  maxLineLength: 50_000,
  maxMatches: 1_000_000,
  maxRules: 10_000,
  maxPatternLength: 1_000,
  maxOwnersPerRule: 100,
  maxOwnerLength: 200,
};
const MAX_ISSUES = 100;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function boundedPositiveInteger(
  value: number,
  name: string,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return value;
}

function resolveLimits(options: CodeownersLimits): RequiredLimits {
  return {
    maxFileBytes: boundedPositiveInteger(
      options.maxFileBytes ?? DEFAULT_LIMITS.maxFileBytes,
      'maxFileBytes',
      DEFAULT_LIMITS.maxFileBytes,
    ),
    maxLines: boundedPositiveInteger(
      options.maxLines ?? DEFAULT_LIMITS.maxLines,
      'maxLines',
      DEFAULT_LIMITS.maxLines,
    ),
    maxLineLength: boundedPositiveInteger(
      options.maxLineLength ?? DEFAULT_LIMITS.maxLineLength,
      'maxLineLength',
      DEFAULT_LIMITS.maxLineLength,
    ),
    maxMatches: boundedPositiveInteger(
      options.maxMatches ?? DEFAULT_LIMITS.maxMatches,
      'maxMatches',
      DEFAULT_LIMITS.maxMatches,
    ),
    maxRules: boundedPositiveInteger(
      options.maxRules ?? DEFAULT_LIMITS.maxRules,
      'maxRules',
      DEFAULT_LIMITS.maxRules,
    ),
    maxPatternLength: boundedPositiveInteger(
      options.maxPatternLength ?? DEFAULT_LIMITS.maxPatternLength,
      'maxPatternLength',
      DEFAULT_LIMITS.maxPatternLength,
    ),
    maxOwnersPerRule: boundedPositiveInteger(
      options.maxOwnersPerRule ?? DEFAULT_LIMITS.maxOwnersPerRule,
      'maxOwnersPerRule',
      DEFAULT_LIMITS.maxOwnersPerRule,
    ),
    maxOwnerLength: boundedPositiveInteger(
      options.maxOwnerLength ?? DEFAULT_LIMITS.maxOwnerLength,
      'maxOwnerLength',
      DEFAULT_LIMITS.maxOwnerLength,
    ),
  };
}

function validRepositoryPath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 1_000 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    path.split('/').every((segment) => segment !== '' && segment !== '..')
  );
}

function validOwner(owner: string, maxLength: number): boolean {
  if (owner.length === 0 || owner.length > maxLength) return false;
  if (
    /^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[A-Za-z0-9](?:[A-Za-z0-9_-]{0,99}))?$/u.test(
      owner,
    )
  ) {
    return true;
  }
  return /^[^\s@]+@[^\s@]+$/u.test(owner);
}

function segmentMatches(pattern: string, value: string): boolean {
  let patternIndex = 0;
  let valueIndex = 0;
  let starIndex = -1;
  let starValueIndex = -1;
  while (valueIndex < value.length) {
    const character = pattern[patternIndex];
    if (character === '?' || character === value[valueIndex]) {
      patternIndex += 1;
      valueIndex += 1;
    } else if (character === '*') {
      starIndex = patternIndex;
      starValueIndex = valueIndex;
      patternIndex += 1;
    } else if (starIndex !== -1) {
      patternIndex = starIndex + 1;
      starValueIndex += 1;
      valueIndex = starValueIndex;
    } else {
      return false;
    }
  }
  while (pattern[patternIndex] === '*') patternIndex += 1;
  return patternIndex === pattern.length;
}

function pathSegmentsMatch(
  patterns: readonly string[],
  segments: readonly string[],
  matchesDescendants: boolean,
): boolean {
  let patternIndex = 0;
  let segmentIndex = 0;
  let globstarIndex = -1;
  let globstarSegmentIndex = -1;
  while (segmentIndex < segments.length) {
    const pattern = patterns[patternIndex];
    if (pattern === undefined) {
      if (matchesDescendants) return true;
      if (globstarIndex === -1) return matchesDescendants;
      patternIndex = globstarIndex + 1;
      globstarSegmentIndex += 1;
      segmentIndex = globstarSegmentIndex;
      continue;
    }
    if (pattern === '**') {
      globstarIndex = patternIndex;
      globstarSegmentIndex = segmentIndex;
      patternIndex += 1;
    } else if (segmentMatches(pattern, segments[segmentIndex]!)) {
      patternIndex += 1;
      segmentIndex += 1;
    } else if (globstarIndex !== -1) {
      patternIndex = globstarIndex + 1;
      globstarSegmentIndex += 1;
      segmentIndex = globstarSegmentIndex;
    } else {
      return false;
    }
  }
  while (patterns[patternIndex] === '**') patternIndex += 1;
  return patternIndex === patterns.length;
}

function compilePattern(pattern: string): ((path: string) => boolean) | null {
  if (
    pattern.startsWith('!') ||
    pattern.includes('[') ||
    pattern.includes(']') ||
    pattern.includes('\\') ||
    pattern.includes('//') ||
    pattern.includes('\0')
  ) {
    return null;
  }
  const anchored = pattern.startsWith('/');
  let body = anchored ? pattern.slice(1) : pattern;
  const directoryPattern = body.endsWith('/');
  while (body.endsWith('/')) body = body.slice(0, -1);
  if (body.length === 0) return null;
  if (body.split('/').some((segment) => segment === '.' || segment === '..')) {
    return null;
  }
  const hasSlash = body.includes('/');
  const finalSegment = body.slice(body.lastIndexOf('/') + 1);
  const matchesDescendants = directoryPattern || !/[*?]/u.test(finalSegment);
  const patterns = body.split('/');
  if (!anchored && !hasSlash) {
    return (path: string) => {
      const segments = path.split('/');
      if (matchesDescendants) {
        return segments.some((segment) => segmentMatches(body, segment));
      }
      return segmentMatches(body, segments.at(-1)!);
    };
  }
  return (path: string) =>
    pathSegmentsMatch(patterns, path.split('/'), matchesDescendants);
}

function lineContent(source: string): string {
  const inlineComment = source.search(/\s#/u);
  return (
    inlineComment === -1 ? source : source.slice(0, inlineComment)
  ).trim();
}

function recordIssue(issues: OwnershipIssue[], issue: OwnershipIssue): boolean {
  if (issues.length >= MAX_ISSUES - 1) {
    issues.push({ kind: 'issue-limit' });
    return true;
  }
  issues.push(issue);
  return false;
}

function relationshipResult(
  rules: readonly CodeownerRule[],
  paths: readonly string[],
): OwnershipResult {
  const uniquePaths = new Set(paths);
  if (
    uniquePaths.size !== paths.length ||
    paths.some((path) => !validRepositoryPath(path))
  ) {
    throw new Error(
      'Ownership paths must be unique normalized repository paths',
    );
  }
  const relationships = [...paths].sort(compareText).map((path) => {
    let owners: readonly string[] = [];
    for (const rule of rules) {
      if (rule.matches(path)) owners = rule.owners;
    }
    return { path, owners };
  });
  return { relationships, issues: [] };
}

export function parseCodeowners(
  source: string,
  paths: readonly string[],
  options: CodeownersLimits = {},
): OwnershipResult {
  const limits = resolveLimits(options);
  const uniquePaths = new Set(paths);
  if (
    uniquePaths.size !== paths.length ||
    paths.some((path) => !validRepositoryPath(path))
  ) {
    throw new Error(
      'Ownership paths must be unique normalized repository paths',
    );
  }
  if (Buffer.byteLength(source, 'utf8') > limits.maxFileBytes) {
    return { issues: [{ kind: 'file-size-limit' }] };
  }
  const lines = source.split(/\r?\n/u);
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  if (lines.length > limits.maxLines) {
    return { issues: [{ kind: 'line-count-limit' }] };
  }

  const issues: OwnershipIssue[] = [];
  const rules: CodeownerRule[] = [];
  for (const [index, rawLine] of lines.entries()) {
    const line = index + 1;
    if (rawLine.length > limits.maxLineLength) {
      if (recordIssue(issues, { kind: 'line-length-limit', line })) break;
      continue;
    }
    const content = lineContent(rawLine);
    if (content.length === 0 || content.startsWith('#')) continue;
    const [pattern, ...owners] = content.split(/\s+/u);
    if (pattern === undefined) continue;
    if (pattern.length > limits.maxPatternLength) {
      if (recordIssue(issues, { kind: 'pattern-length-limit', line })) break;
      continue;
    }
    const matches = compilePattern(pattern);
    if (matches === null) {
      if (recordIssue(issues, { kind: 'unsupported-pattern', line })) break;
      continue;
    }
    if (owners.length > limits.maxOwnersPerRule) {
      if (recordIssue(issues, { kind: 'owner-count-limit', line })) break;
      continue;
    }
    if (owners.some((owner) => !validOwner(owner, limits.maxOwnerLength))) {
      if (recordIssue(issues, { kind: 'invalid-owner', line })) break;
      continue;
    }
    if (rules.length >= limits.maxRules) {
      if (recordIssue(issues, { kind: 'rule-limit', line })) break;
      continue;
    }
    rules.push({
      matches,
      owners: [...new Set(owners)],
    });
  }
  if (issues.length > 0) return { issues };
  if (rules.length * paths.length > limits.maxMatches) {
    return { issues: [{ kind: 'match-limit' }] };
  }
  return relationshipResult(rules, paths);
}

export async function readCodeowners(
  repositoryRoot: string,
  paths: readonly string[],
  options: CodeownersLimits = {},
): Promise<OwnershipResult> {
  const limits = resolveLimits(options);
  const root = await realpath(repositoryRoot).catch(() => {
    throw new Error('Repository root does not exist or cannot be read');
  });
  const expectedDirectory = join(root, '.github');
  const directory = await realpath(expectedDirectory).catch(
    (error: NodeJS.ErrnoException) =>
      error.code === 'ENOENT' ? undefined : null,
  );
  if (directory === undefined) return { issues: [{ kind: 'file-missing' }] };
  if (directory === null) return { issues: [{ kind: 'read-failure' }] };
  if (directory !== expectedDirectory) return { issues: [{ kind: 'symlink' }] };
  const target = join(root, CODEOWNERS_PATH);
  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { issues: [{ kind: 'file-missing' }] };
    if (code === 'ELOOP') return { issues: [{ kind: 'symlink' }] };
    return { issues: [{ kind: 'read-failure' }] };
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) return { issues: [{ kind: 'not-regular-file' }] };
    if (stats.size > limits.maxFileBytes) {
      return { issues: [{ kind: 'file-size-limit' }] };
    }
    const bytes = await handle.readFile().catch(() => undefined);
    if (bytes === undefined) return { issues: [{ kind: 'read-failure' }] };
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { issues: [{ kind: 'invalid-utf8' }] };
    }
    return parseCodeowners(source, paths, limits);
  } finally {
    await handle.close().catch(() => undefined);
  }
}
