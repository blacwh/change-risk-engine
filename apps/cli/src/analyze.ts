import type {
  AnalysisResult,
  BlastRadiusVisualization,
  ChangedFile,
} from '@change-risk/core';
import {
  ANALYSIS_RESULT_SCHEMA_VERSION,
  classifyFile,
  parseAnalysisResult,
} from '@change-risk/core';
import { readLcov } from '@change-risk/coverage';
import {
  buildBlastRadiusVisualization,
  dependencyGraphFromModules,
} from '@change-risk/dependency-graph';
import {
  collectChangedFiles,
  readFileAtRevision,
  worktreeMatchesRevision,
} from '@change-risk/git-adapter';
import {
  comparePublicExportSurfaces,
  inferConventionalTestRelationships,
  typeScriptLanguageAdapter,
  type SourceSnapshot,
} from '@change-risk/language-typescript';
import { readCodeowners } from '@change-risk/ownership';
import type { LanguageAdapter } from '@change-risk/plugin-sdk';
import {
  DEFAULT_RULES,
  evaluateRules,
  globMatches,
  scoreRuleEvaluation,
  type RiskRule,
} from '@change-risk/rules';

import { loadRepositoryConfig } from './config.js';

export type AnalyzeRepositoryOptions = {
  repositoryRoot: string;
  base: string;
  head: string;
  configPath?: string;
  coveragePath?: string;
  languageAdapter?: LanguageAdapter;
  rules?: readonly RiskRule[];
};

export type RepositoryAnalysis = {
  result: AnalysisResult;
  blastRadius?: BlastRadiusVisualization;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPublicEntryPoint(path: string): boolean {
  return /(?:^|\/)index\.(?:(?:d\.)?[cm]?[jt]sx?)$/iu.test(path);
}

function issueLimitation(issue: { kind: string; path?: string }): string {
  return `Language analysis issue: ${issue.kind}${issue.path === undefined ? '' : ` (${issue.path})`}.`;
}

function publicIssueLimitation(issue: { kind: string; path: string }): string {
  return `Public-surface comparison issue: ${issue.kind} (${issue.path}).`;
}

function ownershipIssueLimitation(issue: {
  kind: string;
  line?: number;
}): string {
  return `Ownership evidence unavailable: ${issue.kind}${issue.line === undefined ? '' : ` (line ${issue.line})`}.`;
}

function coverageIssueLimitation(issue: {
  kind: string;
  line?: number;
}): string {
  return `Coverage evidence unavailable: ${issue.kind}${issue.line === undefined ? '' : ` (line ${issue.line})`}.`;
}

function ignored(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => globMatches(pattern, path));
}

async function publicSurfaceEvidence(
  repositoryRoot: string,
  baseRevision: string,
  headRevision: string,
  files: readonly ChangedFile[],
  maxFileBytes: number,
  limitations: string[],
): Promise<ReturnType<typeof comparePublicExportSurfaces>['changes']> {
  const base: SourceSnapshot[] = [];
  const head: SourceSnapshot[] = [];
  const readLimit = Math.min(maxFileBytes, 4_000_000);
  if (maxFileBytes > readLimit) {
    limitations.push(
      'Revision source reads are capped at 4000000 bytes by the Git adapter.',
    );
  }
  for (const file of files.filter(
    ({ binary, path }) => !binary && isPublicEntryPoint(path),
  )) {
    try {
      let baseSource: string | undefined;
      let headSource: string | undefined;
      if (file.status !== 'added') {
        baseSource = await readFileAtRevision(
          repositoryRoot,
          baseRevision,
          file.previousPath ?? file.path,
          { maxBytes: readLimit },
        );
      }
      if (file.status !== 'deleted') {
        headSource = await readFileAtRevision(
          repositoryRoot,
          headRevision,
          file.path,
          { maxBytes: readLimit },
        );
      }
      if (baseSource !== undefined)
        base.push({ path: file.path, source: baseSource });
      if (headSource !== undefined)
        head.push({ path: file.path, source: headSource });
    } catch {
      limitations.push(
        `Public-surface source could not be read at an analyzed revision (${file.path}).`,
      );
    }
  }
  const comparison = comparePublicExportSurfaces(base, head, readLimit);
  limitations.push(...comparison.issues.map(publicIssueLimitation));
  limitations.push(
    'Public-surface comparison is limited to changed conventional index modules.',
  );
  return comparison.changes;
}

async function analyzeRepositoryInternal(
  options: AnalyzeRepositoryOptions,
  includeVisualization: boolean,
): Promise<RepositoryAnalysis> {
  const config = await loadRepositoryConfig(
    options.repositoryRoot,
    options.configPath,
  );
  const diff = await collectChangedFiles(
    options.repositoryRoot,
    options.base,
    options.head,
  );
  const changedFiles: ChangedFile[] = diff.files
    .filter(({ path }) => !ignored(path, config.ignorePatterns))
    .map((file) => ({ ...file, categories: [...classifyFile(file.path)] }));
  const limitations: string[] = [];
  let coverageRelationships: Awaited<
    ReturnType<typeof readLcov>
  >['relationships'];
  if (options.coveragePath !== undefined) {
    const coverage = await readLcov(
      options.repositoryRoot,
      options.coveragePath,
      changedFiles
        .filter(
          ({ categories, status }) =>
            status !== 'deleted' &&
            categories.includes('source') &&
            !categories.includes('test') &&
            !categories.includes('generated'),
        )
        .map(({ path }) => path),
    );
    coverageRelationships = coverage.relationships;
    limitations.push(
      'Coverage evidence is caller supplied; freshness and revision alignment are not verified.',
      ...coverage.issues.map(coverageIssueLimitation),
    );
  }
  const publicExportChanges = await publicSurfaceEvidence(
    options.repositoryRoot,
    diff.baseRevision,
    diff.headRevision,
    changedFiles,
    config.analysis.maxFileBytes,
    limitations,
  );

  let dependencyGraph:
    ReturnType<typeof dependencyGraphFromModules> | undefined;
  let testRelationships:
    ReturnType<typeof inferConventionalTestRelationships> | undefined;
  let ownershipRelationships: Awaited<
    ReturnType<typeof readCodeowners>
  >['relationships'];
  let blastRadius: BlastRadiusVisualization | undefined;
  if (
    await worktreeMatchesRevision(options.repositoryRoot, diff.headRevision)
  ) {
    const ownership = await readCodeowners(
      options.repositoryRoot,
      changedFiles.map(({ path }) => path),
    );
    limitations.push(...ownership.issues.map(ownershipIssueLimitation));
    const index = await (
      options.languageAdapter ?? typeScriptLanguageAdapter
    ).indexRepository(options.repositoryRoot, {
      maxEntries: config.analysis.maxEntries,
      maxFiles: config.analysis.maxFiles,
      maxFileBytes: config.analysis.maxFileBytes,
    });
    limitations.push(
      ...index.issues
        .filter(
          (issue) =>
            !('path' in issue) ||
            issue.path === undefined ||
            !ignored(issue.path, config.ignorePatterns),
        )
        .map(issueLimitation),
    );
    const modules = index.modules.filter(
      ({ path }) => !ignored(path, config.ignorePatterns),
    );
    const includedPaths = new Set(modules.map(({ path }) => path));
    const boundedModules = modules.map((module) => ({
      ...module,
      imports: module.imports.filter(
        ({ resolution, targetPath }) =>
          resolution !== 'internal' ||
          (targetPath !== undefined && includedPaths.has(targetPath)),
      ),
    }));
    const candidateGraph = dependencyGraphFromModules(boundedModules, [], {
      maxEdges: config.analysis.maxGraphEdges,
      maxNodes: config.analysis.maxFiles,
    });
    const candidateRelationships = inferConventionalTestRelationships(
      boundedModules.map(({ path }) => path),
    );
    if (
      await worktreeMatchesRevision(options.repositoryRoot, diff.headRevision)
    ) {
      dependencyGraph = candidateGraph;
      testRelationships = candidateRelationships;
      ownershipRelationships = ownership.relationships;
      if (includeVisualization) {
        blastRadius = buildBlastRadiusVisualization(
          candidateGraph,
          changedFiles
            .filter(
              ({ categories }) =>
                categories.includes('source') && !categories.includes('test'),
            )
            .map(({ path }) => path),
          { maxDepth: config.analysis.maxTraversalDepth },
        );
      }
      limitations.push(
        'Dependency graph and test relationships represent the head tree; deleted modules may be absent.',
        'Test relationships are inferred from path conventions; tests and coverage are not executed.',
      );
    } else {
      limitations.push(
        'Dependency graph and test relationships were discarded because the worktree changed during analysis.',
        'Ownership evidence was discarded because the worktree changed during analysis.',
      );
    }
  } else {
    limitations.push(
      'Dependency graph and test relationships were omitted because the clean worktree did not match the analyzed head revision.',
      'Ownership evidence was omitted because the clean worktree did not match the analyzed head revision.',
    );
  }

  const highFanInSetting = config.rules['high-fan-in'];
  const configuredRules = {
    ...config.rules,
    'high-fan-in': {
      enabled: highFanInSetting?.enabled ?? true,
      options: {
        maxTraversalDepth: config.analysis.maxTraversalDepth,
        ...(highFanInSetting?.options ?? {}),
      },
      ...(highFanInSetting?.weight === undefined
        ? {}
        : { weight: highFanInSetting.weight }),
    },
  };
  const evaluation = evaluateRules(
    {
      changedFiles,
      ...(coverageRelationships === undefined ? {} : { coverageRelationships }),
      ...(ownershipRelationships === undefined
        ? {}
        : { ownershipRelationships }),
      sensitiveAreas: config.sensitiveAreas,
      publicExportChanges,
      ...(dependencyGraph === undefined ? {} : { dependencyGraph }),
      ...(testRelationships === undefined ? {} : { testRelationships }),
    },
    options.rules ?? DEFAULT_RULES,
    Object.fromEntries(
      Object.entries(configuredRules).map(([id, setting]) => [
        id,
        {
          enabled: setting.enabled,
          options: setting.options,
          ...(setting.weight === undefined ? {} : { weight: setting.weight }),
        },
      ]),
    ),
  );
  const scored = scoreRuleEvaluation(evaluation, config.thresholds);
  const result = parseAnalysisResult({
    schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION,
    revisions: { base: diff.baseRevision, head: diff.headRevision },
    changedFiles,
    evidence: scored.evidence,
    findings: scored.findings,
    score: scored.score,
    classification: scored.classification,
    scoreContributions: scored.scoreContributions,
    limitations: [...new Set(limitations)].sort(compareText),
  });
  return {
    result,
    ...(blastRadius === undefined ? {} : { blastRadius }),
  };
}

export async function analyzeRepository(
  options: AnalyzeRepositoryOptions,
): Promise<AnalysisResult> {
  return (await analyzeRepositoryInternal(options, false)).result;
}

export async function analyzeRepositoryWithArtifacts(
  options: AnalyzeRepositoryOptions,
): Promise<RepositoryAnalysis> {
  return analyzeRepositoryInternal(options, true);
}
