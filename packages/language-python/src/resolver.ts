import {
  indexPythonProject,
  type PythonImportReference,
  type PythonIndexIssue,
  type PythonIndexOptions,
  type PythonModuleIndex,
} from './indexer.js';

type ModuleIdentity = {
  identity: string;
  path: string;
  package: boolean;
  sourceRoot: '' | 'src';
  stem: string;
};

type ResolvedIdentity =
  | { kind: 'ambiguous'; paths: readonly string[] }
  | { kind: 'resolved'; path: string };

export type PythonResolutionIssue =
  | {
      kind: 'ambiguous-module';
      path: string;
      specifier: string;
    }
  | {
      kind: 'module-identity-unavailable';
      path: string;
    }
  | {
      kind: 'unresolved-import';
      path: string;
      specifier: string;
    };

export type ResolvedPythonImportReference = PythonImportReference & {
  resolution: 'external' | 'internal' | 'unresolved';
  targetPath?: string;
};

export type ResolvedPythonModuleRecord = {
  path: string;
  imports: readonly ResolvedPythonImportReference[];
};

export type ResolvedPythonModuleIndex = {
  repositoryRoot: string;
  modules: readonly ResolvedPythonModuleRecord[];
  issues: readonly (PythonIndexIssue | PythonResolutionIssue)[];
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceStem(path: string): string {
  return path.endsWith('.pyi') ? path.slice(0, -4) : path.slice(0, -3);
}

function validIdentitySegment(segment: string): boolean {
  return /^(?:_|\p{XID_Start})(?:_|\p{XID_Continue})*$/u.test(segment);
}

function candidateIdentity(
  path: string,
  sourceRoot: '' | 'src',
  modulePaths: ReadonlySet<string>,
): ModuleIdentity | undefined {
  const prefix = sourceRoot === '' ? '' : `${sourceRoot}/`;
  if (!path.startsWith(prefix)) return undefined;
  const fromRoot = path.slice(prefix.length);
  const stem = sourceStem(fromRoot);
  const segments = stem.split('/');
  const packageModule = segments.at(-1) === '__init__';
  const identitySegments = packageModule ? segments.slice(0, -1) : segments;
  if (
    identitySegments.length === 0 ||
    !identitySegments.every(validIdentitySegment)
  ) {
    return undefined;
  }

  const parentSegments = identitySegments.slice(0, -1);
  for (let length = 1; length <= parentSegments.length; length += 1) {
    const packagePath = `${prefix}${parentSegments
      .slice(0, length)
      .join('/')}/__init__`;
    if (
      !modulePaths.has(`${packagePath}.py`) &&
      !modulePaths.has(`${packagePath}.pyi`)
    ) {
      return undefined;
    }
  }

  return {
    identity: identitySegments.join('.'),
    path,
    package: packageModule,
    sourceRoot,
    stem: sourceStem(path),
  };
}

function moduleIdentities(index: PythonModuleIndex): {
  identities: ReadonlyMap<string, ResolvedIdentity>;
  primaryByPath: ReadonlyMap<string, ModuleIdentity>;
  issues: readonly PythonResolutionIssue[];
} {
  const modulePaths = new Set(index.modules.map(({ path }) => path));
  const candidates: ModuleIdentity[] = [];
  const candidatesByPath = new Map<string, ModuleIdentity[]>();

  for (const { path } of index.modules) {
    for (const sourceRoot of ['src', ''] as const) {
      const candidate = candidateIdentity(path, sourceRoot, modulePaths);
      if (candidate === undefined) continue;
      candidates.push(candidate);
      const pathCandidates = candidatesByPath.get(path) ?? [];
      pathCandidates.push(candidate);
      candidatesByPath.set(path, pathCandidates);
    }
  }

  const issues: PythonResolutionIssue[] = [];
  const primaryByPath = new Map<string, ModuleIdentity>();
  for (const { path } of index.modules) {
    const pathCandidates = candidatesByPath.get(path) ?? [];
    pathCandidates.sort((left, right) => {
      const rootOrder = right.sourceRoot.length - left.sourceRoot.length;
      return rootOrder !== 0
        ? rootOrder
        : compareText(left.identity, right.identity);
    });
    const primary = pathCandidates[0];
    if (primary === undefined) {
      issues.push({ kind: 'module-identity-unavailable', path });
    } else {
      primaryByPath.set(path, primary);
    }
  }

  const byIdentity = new Map<string, ModuleIdentity[]>();
  for (const candidate of candidates) {
    const values = byIdentity.get(candidate.identity) ?? [];
    values.push(candidate);
    byIdentity.set(candidate.identity, values);
  }

  const identities = new Map<string, ResolvedIdentity>();
  for (const identity of [...byIdentity.keys()].sort(compareText)) {
    const candidatesForIdentity = byIdentity.get(identity) ?? [];
    const byStem = new Map<string, ModuleIdentity[]>();
    for (const candidate of candidatesForIdentity) {
      const values = byStem.get(candidate.stem) ?? [];
      values.push(candidate);
      byStem.set(candidate.stem, values);
    }
    if (byStem.size > 1) {
      const paths = [
        ...new Set(candidatesForIdentity.map(({ path }) => path)),
      ].sort(compareText);
      identities.set(identity, { kind: 'ambiguous', paths });
      for (const path of paths) {
        issues.push({
          kind: 'ambiguous-module',
          path,
          specifier: identity,
        });
      }
      continue;
    }
    const sameStem = [...byStem.values()][0] ?? [];
    sameStem.sort((left, right) => {
      const extensionOrder =
        Number(left.path.endsWith('.pyi')) -
        Number(right.path.endsWith('.pyi'));
      return extensionOrder !== 0
        ? extensionOrder
        : compareText(left.path, right.path);
    });
    const selected = sameStem[0];
    if (selected !== undefined) {
      identities.set(identity, { kind: 'resolved', path: selected.path });
    }
  }

  issues.sort((left, right) => {
    const pathOrder = compareText(left.path, right.path);
    if (pathOrder !== 0) return pathOrder;
    const kindOrder = compareText(left.kind, right.kind);
    if (kindOrder !== 0) return kindOrder;
    return compareText(
      'specifier' in left ? left.specifier : '',
      'specifier' in right ? right.specifier : '',
    );
  });
  return { identities, primaryByPath, issues };
}

function absoluteStatus(
  identity: string,
  identities: ReadonlyMap<string, ResolvedIdentity>,
): 'external' | 'unresolved' {
  const topLevel = identity.split('.')[0] ?? '';
  for (const known of identities.keys()) {
    if (known === topLevel || known.startsWith(`${topLevel}.`)) {
      return 'unresolved';
    }
  }
  return 'external';
}

function target(
  identity: string,
  identities: ReadonlyMap<string, ResolvedIdentity>,
): string | undefined {
  const parts = identity.split('.');
  for (let length = 1; length <= parts.length; length += 1) {
    if (
      identities.get(parts.slice(0, length).join('.'))?.kind === 'ambiguous'
    ) {
      return undefined;
    }
  }
  const resolution = identities.get(identity);
  return resolution?.kind === 'resolved' ? resolution.path : undefined;
}

function resolveReference(
  importerPath: string,
  reference: PythonImportReference,
  identities: ReadonlyMap<string, ResolvedIdentity>,
  primaryByPath: ReadonlyMap<string, ModuleIdentity>,
): ResolvedPythonImportReference {
  if (reference.kind === 'import') {
    const targetPath = target(reference.module, identities);
    if (targetPath !== undefined) {
      return { ...reference, resolution: 'internal', targetPath };
    }
    return {
      ...reference,
      resolution: absoluteStatus(reference.module, identities),
    };
  }

  let baseIdentity = reference.module;
  if (reference.relativeLevel > 0) {
    const importer = primaryByPath.get(importerPath);
    if (importer === undefined) {
      return { ...reference, resolution: 'unresolved' };
    }
    const packageParts = importer.package
      ? importer.identity.split('.')
      : importer.identity.split('.').slice(0, -1);
    if (
      packageParts.length === 0 ||
      reference.relativeLevel > packageParts.length
    ) {
      return { ...reference, resolution: 'unresolved' };
    }
    const retainedLength = packageParts.length - reference.relativeLevel + 1;
    const baseParts = packageParts.slice(0, retainedLength);
    if (reference.module) baseParts.push(...reference.module.split('.'));
    baseIdentity = baseParts.join('.');
  }

  const importedIdentity =
    reference.importedName === undefined
      ? baseIdentity
      : [baseIdentity, reference.importedName].filter(Boolean).join('.');
  const importedTarget = target(importedIdentity, identities);
  if (importedTarget !== undefined) {
    return { ...reference, resolution: 'internal', targetPath: importedTarget };
  }
  const baseTarget = target(baseIdentity, identities);
  if (baseTarget !== undefined) {
    return { ...reference, resolution: 'internal', targetPath: baseTarget };
  }
  return {
    ...reference,
    resolution:
      reference.relativeLevel > 0
        ? 'unresolved'
        : absoluteStatus(baseIdentity || importedIdentity, identities),
  };
}

export function resolvePythonModuleIndex(
  index: PythonModuleIndex,
): ResolvedPythonModuleIndex {
  const {
    identities,
    primaryByPath,
    issues: identityIssues,
  } = moduleIdentities(index);
  const issues: (PythonIndexIssue | PythonResolutionIssue)[] = [
    ...index.issues,
    ...identityIssues,
  ];
  const unresolvedKeys = new Set<string>();
  const modules = index.modules.map((module) => ({
    path: module.path,
    imports: module.imports.map((reference) => {
      const resolved = resolveReference(
        module.path,
        reference,
        identities,
        primaryByPath,
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

export async function resolvePythonProject(
  repositoryRoot: string,
  options: PythonIndexOptions = {},
): Promise<ResolvedPythonModuleIndex> {
  return resolvePythonModuleIndex(
    await indexPythonProject(repositoryRoot, options),
  );
}
