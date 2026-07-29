import type { ChangedFile } from '@change-risk/core';

import type { RiskRule, RuleMatch } from './engine.js';
import { globMatches, integerOption, numberOption } from './options.js';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function paths(files: readonly ChangedFile[]): string[] {
  return files.map(({ path }) => path).sort(compareText);
}

type CoverageConcern = {
  path: string;
  linesFound: number | null;
  linesHit: number | null;
  linePercent: number | null;
  reason: 'below-threshold' | 'missing-record' | 'no-measurable-lines';
};

function categoryRule(definition: {
  id: string;
  title: string;
  categories: readonly ChangedFile['categories'][number][];
  defaultWeight: number;
  severity: RuleMatch['finding']['severity'];
  explanation: string;
  remediation: string;
}): RiskRule {
  return {
    id: definition.id,
    defaultWeight: definition.defaultWeight,
    evaluate(context) {
      const matched = context.changedFiles.filter((file) =>
        definition.categories.some((category) =>
          file.categories.includes(category),
        ),
      );
      if (matched.length === 0) return [];
      const affectedPaths = paths(matched);
      return [
        {
          evidence: {
            kind: 'file-category',
            summary: `${matched.length} changed file(s) matched ${definition.id}`,
            data: {
              categories: definition.categories,
              fileCount: matched.length,
            },
            sourcePaths: affectedPaths,
          },
          finding: {
            title: definition.title,
            severity: definition.severity,
            explanation: definition.explanation,
            affectedPaths,
            remediation: definition.remediation,
          },
        },
      ];
    },
  };
}

export const largeChangeRule: RiskRule = {
  id: 'large-change',
  defaultWeight: 20,
  evaluate(context, options) {
    const maxFiles = integerOption(options, 'maxFiles', 20, 1, 100_000);
    const maxLines = integerOption(options, 'maxLines', 500, 1, 10_000_000);
    const lineCount = context.changedFiles.reduce(
      (total, file) => total + file.additions + file.deletions,
      0,
    );
    const fileCount = context.changedFiles.length;
    if (fileCount <= maxFiles && lineCount <= maxLines) return [];
    const affectedPaths = paths(context.changedFiles);
    return [
      {
        evidence: {
          kind: 'change-shape',
          summary: `${fileCount} files and ${lineCount} changed lines exceed configured size limits`,
          data: { fileCount, lineCount, maxFiles, maxLines },
          sourcePaths: affectedPaths,
        },
        finding: {
          title: 'Large change',
          severity:
            fileCount > maxFiles * 2 || lineCount > maxLines * 2
              ? 'high'
              : 'medium',
          explanation:
            'The change exceeds the configured file-count or changed-line threshold.',
          affectedPaths,
          remediation:
            'Split unrelated work or document why the change must be reviewed as one unit.',
        },
      },
    ];
  },
};

export const multiAreaRule: RiskRule = {
  id: 'multi-area-change',
  defaultWeight: 15,
  evaluate(context, options) {
    const minAreas = integerOption(options, 'minAreas', 3, 2, 1_000);
    const areas = [
      ...new Set(
        context.changedFiles.map(({ path }) =>
          path.includes('/') ? (path.split('/')[0] ?? '(root)') : '(root)',
        ),
      ),
    ].sort(compareText);
    if (areas.length < minAreas) return [];
    const affectedPaths = paths(context.changedFiles);
    return [
      {
        evidence: {
          kind: 'change-shape',
          summary: `Changes span ${areas.length} top-level areas`,
          data: { areas, minAreas },
          sourcePaths: affectedPaths,
        },
        finding: {
          title: 'Multi-area change',
          severity: 'medium',
          explanation:
            'The change crosses the configured number of top-level repository areas.',
          affectedPaths,
          remediation:
            'Confirm the cross-area coupling is intentional and assign reviewers for each area.',
        },
      },
    ];
  },
};

export const sensitivePathRule: RiskRule = {
  id: 'sensitive-path',
  defaultWeight: 25,
  evaluate(context) {
    return [...context.sensitiveAreas]
      .sort((left, right) => compareText(left.id, right.id))
      .flatMap((area): readonly RuleMatch[] => {
        const patterns = [...area.patterns].sort(compareText);
        const matched = context.changedFiles.filter((file) =>
          patterns.some((pattern) => globMatches(pattern, file.path)),
        );
        if (matched.length === 0) return [];
        const affectedPaths = paths(matched);
        return [
          {
            evidence: {
              kind: 'path-policy',
              summary: `${matched.length} changed file(s) matched sensitive area ${area.id}`,
              data: { areaId: area.id, patterns },
              sourcePaths: affectedPaths,
            },
            finding: {
              title: `Sensitive area changed: ${area.id}`,
              severity: 'high',
              explanation:
                'One or more changed paths match a configured sensitive-area pattern.',
              affectedPaths,
              remediation:
                'Apply the review and test policy required for this sensitive area.',
            },
          },
        ];
      });
  },
};

export const highFanInRule: RiskRule = {
  id: 'high-fan-in',
  defaultWeight: 25,
  evaluate(context, options) {
    const minFanIn = integerOption(options, 'minFanIn', 5, 1, 100_000);
    const maxTraversalDepth = integerOption(
      options,
      'maxTraversalDepth',
      20,
      1,
      100,
    );
    const graph = context.dependencyGraph;
    if (graph === undefined) return [];
    const changedPaths = new Set(context.changedFiles.map(({ path }) => path));
    return graph.metrics().flatMap((metric): RuleMatch[] => {
      if (!changedPaths.has(metric.path) || metric.fanIn < minFanIn) return [];
      const directDependents = graph.directDependents(metric.path);
      const transitive = graph.transitiveDependents(
        metric.path,
        maxTraversalDepth,
      );
      const affectedPaths = [
        metric.path,
        ...transitive.dependents.map(({ path }) => path),
      ];
      return [
        {
          evidence: {
            kind: 'dependency-impact',
            summary: `${metric.path} has ${metric.fanIn} direct dependent(s)`,
            data: {
              path: metric.path,
              fanIn: metric.fanIn,
              fanOut: metric.fanOut,
              minFanIn,
              directDependents,
              transitiveDependents: transitive.dependents,
              maxTraversalDepth,
              truncated: transitive.truncated,
            },
            sourcePaths: [metric.path],
          },
          finding: {
            title: `High-fan-in module changed: ${metric.path}`,
            severity:
              transitive.dependents.length >= minFanIn * 2 ? 'high' : 'medium',
            explanation:
              'A changed module has at least the configured number of direct dependents.',
            affectedPaths,
            remediation:
              'Review compatibility for direct and transitive dependents and target tests at the reported blast radius.',
          },
        },
      ];
    });
  },
};

export const publicExportRule: RiskRule = {
  id: 'public-export',
  defaultWeight: 25,
  evaluate(context) {
    const changes = [...(context.publicExportChanges ?? [])].sort(
      (left, right) =>
        compareText(left.path, right.path) ||
        compareText(left.exportName, right.exportName) ||
        compareText(left.change, right.change),
    );
    if (changes.length === 0) return [];
    const affectedPaths = [...new Set(changes.map(({ path }) => path))].sort(
      compareText,
    );
    return [
      {
        evidence: {
          kind: 'public-api',
          summary: `${changes.length} public export change(s) detected`,
          data: { changes },
          sourcePaths: affectedPaths,
        },
        finding: {
          title: 'Public exports changed',
          severity: changes.some(({ change }) => change !== 'added')
            ? 'high'
            : 'medium',
          explanation:
            'The supplied TypeScript public-surface comparison reports added, modified, or removed exports.',
          affectedPaths,
          remediation:
            'Review consumer compatibility and update release notes, migration guidance, or versioning as required.',
        },
      },
    ];
  },
};

export const missingRelatedTestsRule: RiskRule = {
  id: 'missing-related-tests',
  defaultWeight: 20,
  evaluate(context) {
    const changedSources = new Set(
      context.changedFiles
        .filter(
          ({ categories }) =>
            categories.includes('source') && !categories.includes('test'),
        )
        .map(({ path }) => path),
    );
    const changedTests = new Set(
      context.changedFiles
        .filter(
          ({ categories, status }) =>
            categories.includes('test') && status !== 'deleted',
        )
        .map(({ path }) => path),
    );
    return [...(context.testRelationships ?? [])]
      .sort((left, right) => compareText(left.sourcePath, right.sourcePath))
      .flatMap((relationship): readonly RuleMatch[] => {
        if (!changedSources.has(relationship.sourcePath)) return [];
        const testPaths = [...relationship.testPaths].sort(compareText);
        const changedRelatedTests = testPaths.filter((path) =>
          changedTests.has(path),
        );
        if (changedRelatedTests.length > 0) return [];
        return [
          {
            evidence: {
              kind: 'test-relationship',
              summary: `No related test changed for ${relationship.sourcePath}`,
              data: {
                sourcePath: relationship.sourcePath,
                relatedTests: testPaths,
                changedRelatedTests,
              },
              sourcePaths: [relationship.sourcePath, ...testPaths],
            },
            finding: {
              title: `No related test changed: ${relationship.sourcePath}`,
              severity: 'medium',
              explanation:
                'A changed source file has explicit test-relationship evidence but none of those tests changed.',
              affectedPaths: [relationship.sourcePath, ...testPaths],
              remediation:
                'Add or update a related test, or document why existing coverage is sufficient for this change.',
            },
          },
        ];
      });
  },
};

export const testsAddedRule: RiskRule = {
  id: 'tests-added',
  defaultWeight: -10,
  evaluate(context) {
    const changedSources = new Set(
      context.changedFiles
        .filter(
          ({ categories }) =>
            categories.includes('source') && !categories.includes('test'),
        )
        .map(({ path }) => path),
    );
    const addedTests = new Set(
      context.changedFiles
        .filter(
          ({ categories, status }) =>
            categories.includes('test') && status === 'added',
        )
        .map(({ path }) => path),
    );
    const relatedSources = new Set<string>();
    const relatedAddedTests = new Set<string>();
    for (const relationship of context.testRelationships ?? []) {
      if (!changedSources.has(relationship.sourcePath)) continue;
      for (const testPath of relationship.testPaths) {
        if (addedTests.has(testPath)) {
          relatedSources.add(relationship.sourcePath);
          relatedAddedTests.add(testPath);
        }
      }
    }
    if (relatedAddedTests.size === 0) return [];
    const sourcePaths = [...relatedSources].sort(compareText);
    const testPaths = [...relatedAddedTests].sort(compareText);
    return [
      {
        evidence: {
          kind: 'test-relationship',
          summary: `${testPaths.length} related test file(s) added`,
          data: { sourcePaths, testPaths },
          sourcePaths: [...sourcePaths, ...testPaths],
        },
        finding: {
          title: 'Related tests added',
          severity: 'info',
          explanation:
            'New test files are explicitly related to source files changed in the same analysis.',
          affectedPaths: [...sourcePaths, ...testPaths],
          remediation:
            'Review that the new tests exercise the behavior and failure modes introduced by the source changes.',
        },
      },
    ];
  },
};

export const missingOwnerRule: RiskRule = {
  id: 'missing-owner',
  defaultWeight: 15,
  evaluate(context) {
    const relationships = context.ownershipRelationships;
    if (relationships === undefined) return [];
    const unownedPaths = relationships
      .filter(({ owners }) => owners.length === 0)
      .map(({ path }) => path)
      .sort(compareText);
    if (unownedPaths.length === 0) return [];
    return [
      {
        evidence: {
          kind: 'ownership',
          summary: `${unownedPaths.length} changed file(s) have no matching CODEOWNERS rule`,
          data: {
            fileCount: unownedPaths.length,
            unownedPaths,
          },
          sourcePaths: unownedPaths,
        },
        finding: {
          title: 'Changed files lack CODEOWNERS',
          severity: 'medium',
          explanation:
            'Complete CODEOWNERS evidence is available, but one or more changed paths have no matching owner rule.',
          affectedPaths: unownedPaths,
          remediation:
            'Add a matching CODEOWNERS rule or document who is responsible for reviewing these paths.',
        },
      },
    ];
  },
};

export const insufficientCoverageRule: RiskRule = {
  id: 'insufficient-coverage',
  defaultWeight: 20,
  evaluate(context, options) {
    const relationships = context.coverageRelationships;
    if (relationships === undefined) return [];
    const minLinePercent = numberOption(options, 'minLinePercent', 80, 0, 100);
    const insufficient = [...relationships]
      .sort((left, right) => compareText(left.path, right.path))
      .flatMap<CoverageConcern>((relationship) => {
        if (
          relationship.linesFound === null ||
          relationship.linesHit === null
        ) {
          return [
            {
              ...relationship,
              linePercent: null,
              reason: 'missing-record' as const,
            },
          ];
        }
        if (relationship.linesFound === 0) {
          return [
            {
              ...relationship,
              linePercent: null,
              reason: 'no-measurable-lines' as const,
            },
          ];
        }
        const linePercent =
          (relationship.linesHit * 100) / relationship.linesFound;
        if (linePercent >= minLinePercent) return [];
        return [
          {
            ...relationship,
            linePercent: Math.round(linePercent * 100) / 100,
            reason: 'below-threshold' as const,
          },
        ];
      });
    if (insufficient.length === 0) return [];
    const affectedPaths = insufficient.map(({ path }) => path);
    return [
      {
        evidence: {
          kind: 'coverage',
          summary: `${insufficient.length} changed source file(s) have insufficient supplied line coverage`,
          data: {
            minLinePercent,
            paths: insufficient,
          },
          sourcePaths: affectedPaths,
        },
        finding: {
          title: 'Changed source has insufficient supplied coverage',
          severity: 'medium',
          explanation:
            'Complete supplied coverage evidence reports missing, unmeasurable, or below-threshold line coverage for changed source files.',
          affectedPaths,
          remediation:
            'Add or update tests, regenerate the LCOV artifact for the analyzed head, or document why the configured threshold is not appropriate.',
        },
      },
    ];
  },
};

export const dependencyManifestRule = categoryRule({
  id: 'dependency-manifest',
  title: 'Dependency files changed',
  categories: ['dependency'],
  defaultWeight: 15,
  severity: 'medium',
  explanation: 'The change modifies a dependency manifest or lockfile.',
  remediation:
    'Review dependency intent, provenance, version changes, and generated lockfile differences.',
});

export const migrationRule = categoryRule({
  id: 'migration',
  title: 'Migration changed',
  categories: ['migration'],
  defaultWeight: 25,
  severity: 'high',
  explanation: 'The change modifies a path classified as a migration.',
  remediation:
    'Document rollout, compatibility, backup, and rollback behavior.',
});

export const infrastructureRule = categoryRule({
  id: 'infrastructure',
  title: 'Infrastructure or CI changed',
  categories: ['infrastructure', 'ci'],
  defaultWeight: 25,
  severity: 'high',
  explanation:
    'The change modifies infrastructure or continuous-delivery configuration.',
  remediation:
    'Require an infrastructure-aware review and verify deployment and rollback plans.',
});

export const DEFAULT_RULES = [
  dependencyManifestRule,
  highFanInRule,
  insufficientCoverageRule,
  infrastructureRule,
  largeChangeRule,
  migrationRule,
  missingOwnerRule,
  missingRelatedTestsRule,
  multiAreaRule,
  publicExportRule,
  sensitivePathRule,
  testsAddedRule,
] as const;
