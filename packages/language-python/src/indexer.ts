import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { TextDecoder } from 'node:util';

import { parser as pythonParser } from '@lezer/python';

import {
  discoverPythonFiles,
  type PythonDiscoveryIssue,
  type PythonDiscoveryOptions,
} from './discovery.js';

const MAX_PARSE_ISSUES_PER_FILE = 100;

type PythonSyntaxNode = ReturnType<typeof pythonParser.parse>['topNode'];

export type PythonImportReference = {
  specifier: string;
  kind: 'from' | 'import';
  module: string;
  relativeLevel: number;
  importedName?: string;
};

export type PythonModuleRecord = {
  path: string;
  imports: readonly PythonImportReference[];
};

export type PythonIndexIssue =
  | PythonDiscoveryIssue
  | {
      kind:
        | 'file-too-large'
        | 'invalid-utf8'
        | 'path-outside-root'
        | 'unreadable-file';
      path: string;
    }
  | {
      kind: 'parse-error';
      path: string;
      line: number;
      column: number;
    }
  | {
      kind: 'parse-error-limit';
      path: string;
    };

export type PythonModuleIndex = {
  repositoryRoot: string;
  modules: readonly PythonModuleRecord[];
  issues: readonly PythonIndexIssue[];
};

export type PythonIndexOptions = PythonDiscoveryOptions & {
  maxFileBytes?: number;
};

function childTokens(node: PythonSyntaxNode, source: string): string[] {
  const tokens: string[] = [];
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    tokens.push(source.slice(child.from, child.to));
  }
  return tokens;
}

function plainImports(tokens: readonly string[]): PythonImportReference[] {
  const imports: PythonImportReference[] = [];
  let parts: string[] = [];
  let readingAlias = false;
  const finish = (): void => {
    if (parts.length > 0) {
      const module = parts.join('.');
      imports.push({
        specifier: module,
        kind: 'import',
        module,
        relativeLevel: 0,
      });
    }
    parts = [];
    readingAlias = false;
  };

  for (const token of tokens.slice(1)) {
    if (token === ',') {
      finish();
    } else if (token === 'as') {
      readingAlias = true;
    } else if (token !== '.' && !readingAlias) {
      parts.push(token);
    }
  }
  finish();
  return imports;
}

function fromImports(tokens: readonly string[]): PythonImportReference[] {
  const importIndex = tokens.indexOf('import');
  if (importIndex < 0) return [];

  let relativeLevel = 0;
  const moduleParts: string[] = [];
  let sawModuleName = false;
  for (const token of tokens.slice(1, importIndex)) {
    if (/^\.+$/u.test(token)) {
      if (!sawModuleName) relativeLevel += token.length;
    } else {
      moduleParts.push(token);
      sawModuleName = true;
    }
  }
  const module = moduleParts.join('.');
  const relativePrefix = '.'.repeat(relativeLevel);
  const importedNames: string[] = [];
  let readingAlias = false;
  for (const token of tokens.slice(importIndex + 1)) {
    if (token === ',') {
      readingAlias = false;
    } else if (token === 'as') {
      readingAlias = true;
    } else if (
      token !== '(' &&
      token !== ')' &&
      token !== '*' &&
      !readingAlias
    ) {
      importedNames.push(token);
      readingAlias = true;
    }
  }

  if (importedNames.length === 0) {
    return [
      {
        specifier: `${relativePrefix}${module}`,
        kind: 'from',
        module,
        relativeLevel,
      },
    ];
  }
  return importedNames.map((importedName) => ({
    specifier: `${relativePrefix}${module}${module ? '.' : ''}${importedName}`,
    kind: 'from',
    module,
    relativeLevel,
    importedName,
  }));
}

function importsFromTree(
  topNode: PythonSyntaxNode,
  source: string,
): PythonImportReference[] {
  const imports: PythonImportReference[] = [];
  const pending = [topNode];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (node.name === 'ImportStatement') {
      const tokens = childTokens(node, source);
      const extracted =
        tokens[0] === 'from'
          ? fromImports(tokens)
          : tokens[0] === 'import'
            ? plainImports(tokens)
            : [];
      for (const reference of extracted) imports.push(reference);
      continue;
    }
    for (
      let child = node.lastChild;
      child !== null;
      child = child.prevSibling
    ) {
      pending.push(child);
    }
  }
  return imports;
}

function lineStarts(source: string): readonly number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function lineAndColumn(
  starts: readonly number[],
  offset: number,
): {
  line: number;
  column: number;
} {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((starts[middle] ?? 0) <= offset) low = middle + 1;
    else high = middle;
  }
  const lineIndex = Math.max(0, low - 1);
  return {
    line: lineIndex + 1,
    column: offset - (starts[lineIndex] ?? 0) + 1,
  };
}

function parseIssues(
  topNode: PythonSyntaxNode,
  source: string,
  path: string,
): PythonIndexIssue[] {
  const issues: PythonIndexIssue[] = [];
  const starts = lineStarts(source);
  let truncated = false;
  const pending = [topNode];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (node.type.isError) {
      if (issues.length < MAX_PARSE_ISSUES_PER_FILE) {
        issues.push({
          kind: 'parse-error',
          path,
          ...lineAndColumn(starts, node.from),
        });
      } else {
        truncated = true;
      }
    }
    for (
      let child = node.lastChild;
      child !== null;
      child = child.prevSibling
    ) {
      pending.push(child);
    }
  }
  if (truncated) issues.push({ kind: 'parse-error-limit', path });
  return issues;
}

export async function indexPythonProject(
  repositoryRoot: string,
  options: PythonIndexOptions = {},
): Promise<PythonModuleIndex> {
  const maxFileBytes = options.maxFileBytes ?? 1_000_000;
  if (
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes <= 0 ||
    maxFileBytes > 100_000_000
  ) {
    throw new Error('maxFileBytes must be an integer from 1 to 100000000');
  }

  const discovery = await discoverPythonFiles(repositoryRoot, options);
  const issues: PythonIndexIssue[] = [...discovery.issues];
  const modules: PythonModuleRecord[] = [];

  for (const path of discovery.files) {
    let handle;
    try {
      const canonicalPath = await realpath(
        join(discovery.repositoryRoot, path),
      );
      const fromRoot = relative(discovery.repositoryRoot, canonicalPath);
      if (
        fromRoot === '..' ||
        fromRoot.startsWith(`..${sep}`) ||
        isAbsolute(fromRoot)
      ) {
        issues.push({ kind: 'path-outside-root', path });
        continue;
      }
      handle = await open(
        canonicalPath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const stats = await handle.stat();
      if (!stats.isFile()) throw new Error('Not a regular file');
      if (stats.size > maxFileBytes) {
        issues.push({ kind: 'file-too-large', path });
        continue;
      }
      const bytes = await handle.readFile();
      if (bytes.length > maxFileBytes) {
        issues.push({ kind: 'file-too-large', path });
        continue;
      }
      let source;
      try {
        source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        issues.push({ kind: 'invalid-utf8', path });
        continue;
      }
      const tree = pythonParser.parse(source);
      issues.push(...parseIssues(tree.topNode, source, path));
      modules.push({
        path,
        imports: importsFromTree(tree.topNode, source),
      });
    } catch {
      issues.push({ kind: 'unreadable-file', path });
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close();
        } catch {
          issues.push({ kind: 'unreadable-file', path });
        }
      }
    }
  }
  return { repositoryRoot: discovery.repositoryRoot, modules, issues };
}
