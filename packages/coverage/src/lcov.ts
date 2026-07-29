import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type LcovLimits = {
  maxFileBytes?: number;
  maxLines?: number;
  maxLineLength?: number;
  maxRecords?: number;
  maxSourcePathLength?: number;
  maxDataLines?: number;
};

export type CoverageIssue = {
  kind:
    | 'artifact-missing'
    | 'data-line-limit'
    | 'duplicate-data-line'
    | 'duplicate-source'
    | 'file-size-limit'
    | 'invalid-data-line'
    | 'invalid-record'
    | 'invalid-source-path'
    | 'invalid-utf8'
    | 'issue-limit'
    | 'line-count-limit'
    | 'line-length-limit'
    | 'not-regular-file'
    | 'read-failure'
    | 'record-limit'
    | 'summary-mismatch'
    | 'symlink'
    | 'unsupported-record'
    | 'unterminated-record';
  line?: number;
};

export type CoverageRelationship = {
  path: string;
  linesFound: number | null;
  linesHit: number | null;
};

export type CoverageResult = {
  relationships?: readonly CoverageRelationship[];
  issues: readonly CoverageIssue[];
};

type RequiredLimits = Required<LcovLimits>;

type PendingRecord = {
  sourcePath: string;
  sourceLine: number;
  data: Map<number, number>;
  linesFound?: number;
  linesHit?: number;
};

type CoverageRecord = {
  linesFound: number;
  linesHit: number;
};

const DEFAULT_LIMITS: RequiredLimits = {
  maxFileBytes: 10_000_000,
  maxLines: 1_000_000,
  maxLineLength: 10_000,
  maxRecords: 100_000,
  maxSourcePathLength: 1_000,
  maxDataLines: 2_000_000,
};
const MAX_ISSUES = 100;
const MAX_LINE_NUMBER = 100_000_000;
const MAX_EXECUTION_COUNT = Number.MAX_SAFE_INTEGER;
const RECORD_PREFIXES = [
  'BRDA:',
  'BRF:',
  'BRH:',
  'FN:',
  'FNDA:',
  'FNF:',
  'FNH:',
  'VER:',
] as const;

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

function resolveLimits(options: LcovLimits): RequiredLimits {
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
    maxRecords: boundedPositiveInteger(
      options.maxRecords ?? DEFAULT_LIMITS.maxRecords,
      'maxRecords',
      DEFAULT_LIMITS.maxRecords,
    ),
    maxSourcePathLength: boundedPositiveInteger(
      options.maxSourcePathLength ?? DEFAULT_LIMITS.maxSourcePathLength,
      'maxSourcePathLength',
      DEFAULT_LIMITS.maxSourcePathLength,
    ),
    maxDataLines: boundedPositiveInteger(
      options.maxDataLines ?? DEFAULT_LIMITS.maxDataLines,
      'maxDataLines',
      DEFAULT_LIMITS.maxDataLines,
    ),
  };
}

function inside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return (
    fromRoot !== '..' &&
    !fromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(fromRoot)
  );
}

function repositoryPath(
  root: string,
  sourcePath: string,
  maxLength: number,
): string | undefined {
  if (
    sourcePath.length === 0 ||
    sourcePath.length > maxLength ||
    sourcePath.includes('\0') ||
    sourcePath.includes('\\')
  ) {
    return undefined;
  }
  const target = resolve(root, sourcePath);
  if (!inside(root, target)) return undefined;
  const normalized = relative(root, target).split(sep).join('/');
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    normalized.split('/').some((segment) => segment.length === 0)
  ) {
    return undefined;
  }
  return normalized;
}

function validChangedPath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 1_000 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    path
      .split('/')
      .every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      )
  );
}

function integer(
  source: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (!/^\d+$/u.test(source)) return undefined;
  const value = Number(source);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function dataLine(source: string): { line: number; count: number } | undefined {
  const [lineSource, countSource, checksum, extra] = source.split(',');
  if (
    lineSource === undefined ||
    countSource === undefined ||
    extra !== undefined ||
    (checksum !== undefined && checksum.length === 0)
  ) {
    return undefined;
  }
  const line = integer(lineSource, 1, MAX_LINE_NUMBER);
  const count = integer(countSource, 0, MAX_EXECUTION_COUNT);
  return line === undefined || count === undefined
    ? undefined
    : { line, count };
}

function recordIssue(issues: CoverageIssue[], issue: CoverageIssue): boolean {
  if (issues.length >= MAX_ISSUES - 1) {
    issues.push({ kind: 'issue-limit' });
    return true;
  }
  issues.push(issue);
  return false;
}

function relationshipResult(
  records: ReadonlyMap<string, CoverageRecord>,
  changedPaths: readonly string[],
): CoverageResult {
  const uniquePaths = new Set(changedPaths);
  if (
    uniquePaths.size !== changedPaths.length ||
    changedPaths.some((path) => !validChangedPath(path))
  ) {
    throw new Error(
      'Coverage paths must be unique normalized repository paths',
    );
  }
  return {
    relationships: [...changedPaths].sort(compareText).map((path) => {
      const record = records.get(path);
      return {
        path,
        linesFound: record?.linesFound ?? null,
        linesHit: record?.linesHit ?? null,
      };
    }),
    issues: [],
  };
}

function finishRecord(
  record: PendingRecord,
  records: Map<string, CoverageRecord>,
  issues: CoverageIssue[],
  line: number,
): boolean {
  if (record.linesFound === undefined || record.linesHit === undefined) {
    return recordIssue(issues, { kind: 'invalid-record', line });
  }
  const calculatedFound = record.data.size;
  const calculatedHit = [...record.data.values()].filter(
    (count) => count > 0,
  ).length;
  if (
    record.linesHit > record.linesFound ||
    calculatedFound !== record.linesFound ||
    calculatedHit !== record.linesHit
  ) {
    return recordIssue(issues, { kind: 'summary-mismatch', line });
  }
  if (records.has(record.sourcePath)) {
    return recordIssue(issues, {
      kind: 'duplicate-source',
      line: record.sourceLine,
    });
  }
  records.set(record.sourcePath, {
    linesFound: record.linesFound,
    linesHit: record.linesHit,
  });
  return false;
}

export function parseLcov(
  source: string,
  repositoryRoot: string,
  changedPaths: readonly string[],
  options: LcovLimits = {},
): CoverageResult {
  if (!isAbsolute(repositoryRoot)) {
    throw new Error('Repository root must be absolute');
  }
  const uniquePaths = new Set(changedPaths);
  if (
    uniquePaths.size !== changedPaths.length ||
    changedPaths.some((path) => !validChangedPath(path))
  ) {
    throw new Error(
      'Coverage paths must be unique normalized repository paths',
    );
  }
  const limits = resolveLimits(options);
  if (Buffer.byteLength(source, 'utf8') > limits.maxFileBytes) {
    return { issues: [{ kind: 'file-size-limit' }] };
  }
  const lines = source.split(/\r?\n/u);
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  if (lines.length > limits.maxLines) {
    return { issues: [{ kind: 'line-count-limit' }] };
  }

  const issues: CoverageIssue[] = [];
  const records = new Map<string, CoverageRecord>();
  let pending: PendingRecord | undefined;
  let totalDataLines = 0;

  for (const [index, rawLine] of lines.entries()) {
    const line = index + 1;
    if (rawLine.length > limits.maxLineLength) {
      if (recordIssue(issues, { kind: 'line-length-limit', line })) break;
      continue;
    }
    if (rawLine.length === 0) continue;
    if (rawLine.startsWith('SF:')) {
      if (pending !== undefined) {
        if (recordIssue(issues, { kind: 'unterminated-record', line })) break;
        continue;
      }
      if (records.size >= limits.maxRecords) {
        recordIssue(issues, { kind: 'record-limit', line });
        break;
      }
      const path = repositoryPath(
        repositoryRoot,
        rawLine.slice(3),
        limits.maxSourcePathLength,
      );
      if (path === undefined) {
        recordIssue(issues, { kind: 'invalid-source-path', line });
        break;
      }
      pending = { sourcePath: path, sourceLine: line, data: new Map() };
      continue;
    }
    if (rawLine === 'end_of_record') {
      if (pending === undefined) {
        if (recordIssue(issues, { kind: 'invalid-record', line })) break;
        continue;
      }
      const stopped = finishRecord(pending, records, issues, line);
      pending = undefined;
      if (stopped) break;
      continue;
    }
    if (rawLine.startsWith('DA:')) {
      if (pending === undefined) {
        if (recordIssue(issues, { kind: 'invalid-record', line })) break;
        continue;
      }
      totalDataLines += 1;
      if (totalDataLines > limits.maxDataLines) {
        recordIssue(issues, { kind: 'data-line-limit', line });
        pending = undefined;
        break;
      }
      const parsed = dataLine(rawLine.slice(3));
      if (parsed === undefined) {
        if (recordIssue(issues, { kind: 'invalid-data-line', line })) break;
        continue;
      }
      if (pending.data.has(parsed.line)) {
        if (recordIssue(issues, { kind: 'duplicate-data-line', line })) break;
        continue;
      }
      pending.data.set(parsed.line, parsed.count);
      continue;
    }
    if (rawLine.startsWith('LF:') || rawLine.startsWith('LH:')) {
      if (pending === undefined) {
        if (recordIssue(issues, { kind: 'invalid-record', line })) break;
        continue;
      }
      const value = integer(rawLine.slice(3), 0, MAX_LINE_NUMBER);
      if (value === undefined) {
        if (recordIssue(issues, { kind: 'invalid-record', line })) break;
        continue;
      }
      if (rawLine.startsWith('LF:')) {
        if (pending.linesFound !== undefined) {
          if (recordIssue(issues, { kind: 'invalid-record', line })) break;
          continue;
        }
        pending.linesFound = value;
      } else {
        if (pending.linesHit !== undefined) {
          if (recordIssue(issues, { kind: 'invalid-record', line })) break;
          continue;
        }
        pending.linesHit = value;
      }
      continue;
    }
    if (rawLine.startsWith('TN:')) {
      continue;
    }
    if (RECORD_PREFIXES.some((prefix) => rawLine.startsWith(prefix))) {
      if (pending === undefined) {
        if (recordIssue(issues, { kind: 'invalid-record', line })) break;
      }
      continue;
    }
    if (recordIssue(issues, { kind: 'unsupported-record', line })) break;
  }
  if (pending !== undefined && issues.length < MAX_ISSUES) {
    recordIssue(issues, { kind: 'unterminated-record', line: lines.length });
  }
  if (issues.length > 0) return { issues };
  return relationshipResult(records, changedPaths);
}

export async function readLcov(
  repositoryRoot: string,
  artifactPath: string,
  changedPaths: readonly string[],
  options: LcovLimits = {},
): Promise<CoverageResult> {
  const limits = resolveLimits(options);
  const root = await realpath(repositoryRoot).catch(() => {
    throw new Error('Repository root does not exist or cannot be read');
  });
  if (
    artifactPath.length === 0 ||
    artifactPath.includes('\0') ||
    artifactPath.includes('\\') ||
    isAbsolute(artifactPath)
  ) {
    throw new Error('Coverage path must be repository-relative');
  }
  const target = resolve(root, artifactPath);
  if (!inside(root, target)) {
    throw new Error('Coverage path must remain inside the repository');
  }
  const expectedParent = dirname(target);
  const parent = await realpath(expectedParent).catch(
    (error: NodeJS.ErrnoException) =>
      error.code === 'ENOENT' ? undefined : null,
  );
  if (parent === undefined) return { issues: [{ kind: 'artifact-missing' }] };
  if (parent === null) return { issues: [{ kind: 'read-failure' }] };
  if (parent !== expectedParent) return { issues: [{ kind: 'symlink' }] };

  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { issues: [{ kind: 'artifact-missing' }] };
    if (code === 'ELOOP') return { issues: [{ kind: 'symlink' }] };
    return { issues: [{ kind: 'read-failure' }] };
  }
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) return { issues: [{ kind: 'not-regular-file' }] };
    if (metadata.size > limits.maxFileBytes) {
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
    return parseLcov(source, root, changedPaths, limits);
  } finally {
    await handle.close().catch(() => undefined);
  }
}
