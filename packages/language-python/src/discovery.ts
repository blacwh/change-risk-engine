import { opendir, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const sourceExtension = /\.pyi?$/u;
const defaultIgnoredDirectories = new Set([
  '.git',
  '.nox',
  '.tox',
  '.venv',
  '__pycache__',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'vendor',
  'venv',
]);

export type PythonDiscoveryOptions = {
  ignoredDirectoryNames?: readonly string[];
  maxEntries?: number;
  maxFiles?: number;
};

export type PythonDiscoveryIssue = {
  kind:
    'entry-limit' | 'file-limit' | 'symlink-skipped' | 'unreadable-directory';
  path?: string;
};

export type PythonDiscoveryResult = {
  repositoryRoot: string;
  files: readonly string[];
  issues: readonly PythonDiscoveryIssue[];
};

function positiveLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function repositoryPath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function discoverPythonFiles(
  repositoryRoot: string,
  options: PythonDiscoveryOptions = {},
): Promise<PythonDiscoveryResult> {
  const root = await realpath(repositoryRoot);
  const maxEntries = positiveLimit(options.maxEntries ?? 100_000, 'maxEntries');
  const maxFiles = positiveLimit(options.maxFiles ?? 10_000, 'maxFiles');
  const ignored = new Set(
    options.ignoredDirectoryNames ?? defaultIgnoredDirectories,
  );
  const files: string[] = [];
  const issues: PythonDiscoveryIssue[] = [];
  const pending = [''];
  let entryCount = 0;
  let entryLimitReached = false;
  let fileLimitReached = false;

  discovery: while (
    pending.length > 0 &&
    files.length < maxFiles &&
    entryCount < maxEntries
  ) {
    const directory = pending.shift();
    if (directory === undefined) break;
    const absoluteDirectory = join(root, directory);
    let entries;
    try {
      entries = await opendir(absoluteDirectory);
    } catch {
      issues.push({
        kind: 'unreadable-directory',
        ...(directory ? { path: directory } : {}),
      });
      continue;
    }

    const remainingEntries = maxEntries - entryCount;
    const children = [];
    for await (const entry of entries) {
      children.push(entry);
      if (children.length > remainingEntries) {
        entryLimitReached = true;
        break discovery;
      }
    }
    entryCount += children.length;
    children.sort((left, right) => compareText(left.name, right.name));

    for (const [childIndex, entry] of children.entries()) {
      const child = join(absoluteDirectory, entry.name);
      const path = repositoryPath(root, child);
      if (entry.isSymbolicLink()) {
        issues.push({ kind: 'symlink-skipped', path });
      } else if (entry.isDirectory() && !ignored.has(entry.name)) {
        pending.push(path);
      } else if (entry.isFile() && sourceExtension.test(entry.name)) {
        files.push(path);
      }
      if (files.length >= maxFiles) {
        fileLimitReached =
          childIndex < children.length - 1 || pending.length > 0;
        break;
      }
    }
  }

  if (entryCount >= maxEntries && pending.length > 0) entryLimitReached = true;
  if (entryLimitReached) issues.push({ kind: 'entry-limit' });
  if (fileLimitReached) issues.push({ kind: 'file-limit' });
  files.sort(compareText);
  return { repositoryRoot: root, files, issues };
}
