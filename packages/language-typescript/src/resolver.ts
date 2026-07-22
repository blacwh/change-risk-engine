import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join, posix } from 'node:path';

import ts from 'typescript';

import {
  indexTypeScriptProject,
  type ImportReference,
  type IndexIssue,
  type IndexOptions,
  type ModuleIndex,
} from './indexer.js';

const sourceExtensions = [
  '.ts',
  '.tsx',
  '.d.ts',
  '.mts',
  '.d.mts',
  '.cts',
  '.d.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
] as const;

export type ResolutionIssue =
  | { kind: 'config-extends-ignored' }
  | {
      kind: 'config-invalid' | 'config-parse-error' | 'config-unreadable';
      code?: number;
    }
  | { kind: 'unresolved-import'; path: string; specifier: string };

export type ResolutionConfig = {
  baseUrl: string | null;
  paths: Readonly<Record<string, readonly string[]>>;
  issues: readonly ResolutionIssue[];
};

export type ResolvedImportReference = ImportReference & {
  resolution: 'external' | 'internal' | 'unresolved';
  targetPath?: string;
};

export type ResolvedModuleRecord = {
  path: string;
  imports: readonly ResolvedImportReference[];
};

export type ResolvedModuleIndex = {
  repositoryRoot: string;
  modules: readonly ResolvedModuleRecord[];
  issues: readonly (IndexIssue | ResolutionIssue)[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withinRepository(path: string): boolean {
  return path !== '..' && !path.startsWith('../') && !posix.isAbsolute(path);
}

function normalizedRepositoryPath(...parts: string[]): string | undefined {
  const path = posix.normalize(posix.join(...parts));
  return withinRepository(path) ? path.replace(/^\.\//u, '') : undefined;
}

function parsePaths(
  value: unknown,
  baseUrl: string,
): Record<string, readonly string[]> | undefined {
  if (value === undefined) return {};
  if (!isRecord(value)) return undefined;
  const paths: Record<string, readonly string[]> = {};
  for (const [pattern, targetsValue] of Object.entries(value)) {
    if (
      (pattern.match(/\*/gu)?.length ?? 0) > 1 ||
      !Array.isArray(targetsValue)
    )
      return undefined;
    const targets: string[] = [];
    for (const target of targetsValue) {
      if (
        typeof target !== 'string' ||
        posix.isAbsolute(target) ||
        (target.match(/\*/gu)?.length ?? 0) > 1
      )
        return undefined;
      const normalized = normalizedRepositoryPath(baseUrl, target);
      if (normalized === undefined) return undefined;
      targets.push(normalized);
    }
    if (targets.length === 0) return undefined;
    paths[pattern] = targets;
  }
  return paths;
}

export async function loadTypeScriptResolutionConfig(
  repositoryRoot: string,
  maxBytes = 1_000_000,
): Promise<ResolutionConfig> {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    maxBytes > 100_000_000
  ) {
    throw new Error('Config maxBytes must be an integer from 1 to 100000000');
  }
  let handle;
  try {
    handle = await open(
      join(repositoryRoot, 'tsconfig.json'),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { baseUrl: null, paths: {}, issues: [] };
    return {
      baseUrl: null,
      paths: {},
      issues: [{ kind: 'config-unreadable' }],
    };
  }

  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > maxBytes) {
      return {
        baseUrl: null,
        paths: {},
        issues: [{ kind: 'config-unreadable' }],
      };
    }
    const text = await handle.readFile('utf8');
    const parsed = ts.parseConfigFileTextToJson('tsconfig.json', text);
    if (parsed.error !== undefined) {
      return {
        baseUrl: null,
        paths: {},
        issues: [{ kind: 'config-parse-error', code: parsed.error.code }],
      };
    }
    if (!isRecord(parsed.config)) {
      return { baseUrl: null, paths: {}, issues: [{ kind: 'config-invalid' }] };
    }
    const issues: ResolutionIssue[] = [];
    if (parsed.config.extends !== undefined)
      issues.push({ kind: 'config-extends-ignored' });
    const compilerOptions = parsed.config.compilerOptions;
    if (compilerOptions !== undefined && !isRecord(compilerOptions)) {
      return {
        baseUrl: null,
        paths: {},
        issues: [...issues, { kind: 'config-invalid' }],
      };
    }
    const baseUrlValue = compilerOptions?.baseUrl;
    if (baseUrlValue !== undefined && typeof baseUrlValue !== 'string') {
      return {
        baseUrl: null,
        paths: {},
        issues: [...issues, { kind: 'config-invalid' }],
      };
    }
    if (baseUrlValue !== undefined && posix.isAbsolute(baseUrlValue)) {
      return {
        baseUrl: null,
        paths: {},
        issues: [...issues, { kind: 'config-invalid' }],
      };
    }
    const baseUrl =
      baseUrlValue === undefined
        ? null
        : normalizedRepositoryPath(baseUrlValue);
    if (baseUrl === undefined) {
      return {
        baseUrl: null,
        paths: {},
        issues: [...issues, { kind: 'config-invalid' }],
      };
    }
    const paths = parsePaths(compilerOptions?.paths, baseUrl ?? '.');
    if (paths === undefined) {
      return {
        baseUrl,
        paths: {},
        issues: [...issues, { kind: 'config-invalid' }],
      };
    }
    return { baseUrl, paths, issues };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function candidates(path: string): readonly string[] {
  const extension = posix.extname(path);
  if (extension.length === 0) {
    return [
      ...sourceExtensions.map(
        (candidateExtension) => `${path}${candidateExtension}`,
      ),
      ...sourceExtensions.map((candidateExtension) =>
        posix.join(path, `index${candidateExtension}`),
      ),
    ];
  }
  const stem = path.slice(0, -extension.length);
  if (extension === '.js' || extension === '.jsx') {
    return [`${stem}.ts`, `${stem}.tsx`, `${stem}.d.ts`, path];
  }
  if (extension === '.mjs') return [`${stem}.mts`, `${stem}.d.mts`, path];
  if (extension === '.cjs') return [`${stem}.cts`, `${stem}.d.cts`, path];
  return [path];
}

function matchPathPattern(
  pattern: string,
  specifier: string,
): string | undefined {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === specifier ? '' : undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return specifier.startsWith(prefix) && specifier.endsWith(suffix)
    ? specifier.slice(prefix.length, specifier.length - suffix.length)
    : undefined;
}

function resolveCandidate(
  path: string,
  modulePaths: ReadonlySet<string>,
): string | undefined {
  return candidates(path).find((candidate) => modulePaths.has(candidate));
}

function resolveReference(
  importerPath: string,
  reference: ImportReference,
  modulePaths: ReadonlySet<string>,
  config: ResolutionConfig,
): ResolvedImportReference {
  const specifier = reference.specifier;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const path = normalizedRepositoryPath(
      posix.dirname(importerPath),
      specifier,
    );
    const targetPath =
      path === undefined ? undefined : resolveCandidate(path, modulePaths);
    return targetPath === undefined
      ? { ...reference, resolution: 'unresolved' }
      : { ...reference, resolution: 'internal', targetPath };
  }

  const patterns = Object.keys(config.paths).sort((left, right) => {
    const specificity =
      right.replace('*', '').length - left.replace('*', '').length;
    return specificity !== 0
      ? specificity
      : left < right
        ? -1
        : left > right
          ? 1
          : 0;
  });
  for (const pattern of patterns) {
    const wildcard = matchPathPattern(pattern, specifier);
    if (wildcard === undefined) continue;
    for (const target of config.paths[pattern] ?? []) {
      const substituted = target.replace('*', wildcard);
      const targetPath = resolveCandidate(substituted, modulePaths);
      if (targetPath !== undefined)
        return { ...reference, resolution: 'internal', targetPath };
    }
    return { ...reference, resolution: 'unresolved' };
  }

  const baseUrlPath =
    config.baseUrl === null
      ? undefined
      : resolveCandidate(posix.join(config.baseUrl, specifier), modulePaths);
  return baseUrlPath === undefined
    ? { ...reference, resolution: 'external' }
    : { ...reference, resolution: 'internal', targetPath: baseUrlPath };
}

export function resolveModuleIndex(
  index: ModuleIndex,
  config: ResolutionConfig,
): ResolvedModuleIndex {
  const modulePaths = new Set(index.modules.map(({ path }) => path));
  const issues: (IndexIssue | ResolutionIssue)[] = [
    ...index.issues,
    ...config.issues,
  ];
  const unresolvedKeys = new Set<string>();
  const modules = index.modules.map((module) => ({
    path: module.path,
    imports: module.imports.map((reference) => {
      const resolved = resolveReference(
        module.path,
        reference,
        modulePaths,
        config,
      );
      if (resolved.resolution === 'unresolved') {
        const key = `${module.path}\0${reference.specifier}`;
        if (!unresolvedKeys.has(key)) {
          unresolvedKeys.add(key);
          issues.push({
            kind: 'unresolved-import',
            path: module.path,
            specifier: reference.specifier,
          });
        }
      }
      return resolved;
    }),
  }));
  return { repositoryRoot: index.repositoryRoot, modules, issues };
}

export async function resolveTypeScriptProject(
  repositoryRoot: string,
  options: IndexOptions = {},
): Promise<ResolvedModuleIndex> {
  const [index, config] = await Promise.all([
    indexTypeScriptProject(repositoryRoot, options),
    loadTypeScriptResolutionConfig(repositoryRoot, options.maxFileBytes),
  ]);
  return resolveModuleIndex(index, config);
}
