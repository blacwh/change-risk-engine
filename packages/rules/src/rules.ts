import type { ChangedFile } from '@change-risk/core';

import type { RiskRule, RuleMatch } from './engine.js';
import { globMatches, integerOption } from './options.js';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function paths(files: readonly ChangedFile[]): string[] {
  return files.map(({ path }) => path).sort(compareText);
}

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
  infrastructureRule,
  largeChangeRule,
  migrationRule,
  multiAreaRule,
  sensitivePathRule,
] as const;
