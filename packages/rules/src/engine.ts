import type { ChangedFile, Evidence, Finding } from '@change-risk/core';
import type { DirectedDependencyGraph } from '@change-risk/dependency-graph';

export type RuleSetting = {
  enabled?: boolean;
  options?: Readonly<Record<string, unknown>>;
  weight?: number;
};

export type RuleContext = {
  changedFiles: readonly ChangedFile[];
  coverageRelationships?: readonly CoverageRelationship[];
  dependencyGraph?: DirectedDependencyGraph;
  ownershipRelationships?: readonly OwnershipRelationship[];
  publicExportChanges?: readonly PublicExportChange[];
  sensitiveAreas: readonly { id: string; patterns: readonly string[] }[];
  testRelationships?: readonly TestRelationship[];
};

export type PublicExportChange = {
  path: string;
  exportName: string;
  change: 'added' | 'modified' | 'removed';
};

export type TestRelationship = {
  sourcePath: string;
  testPaths: readonly string[];
};

export type OwnershipRelationship = {
  path: string;
  owners: readonly string[];
};

export type CoverageRelationship = {
  path: string;
  linesFound: number | null;
  linesHit: number | null;
};

export type RuleMatch = {
  evidence: Omit<Evidence, 'id'>;
  finding: Omit<Finding, 'evidenceIds' | 'id' | 'ruleId' | 'weight'>;
};

export type RiskRule = {
  id: string;
  defaultWeight: number;
  evaluate(
    context: RuleContext,
    options: Readonly<Record<string, unknown>>,
  ): readonly RuleMatch[];
};

export type RuleEvaluation = {
  evidence: readonly Evidence[];
  findings: readonly Finding[];
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function evaluateRules(
  context: RuleContext,
  rules: readonly RiskRule[],
  settings: Readonly<Record<string, RuleSetting>> = {},
): RuleEvaluation {
  const coverageRelationships = context.coverageRelationships;
  if (coverageRelationships !== undefined) {
    if (coverageRelationships.length > 100_000) {
      throw new Error('Coverage relationship limit exceeded');
    }
    const eligiblePaths = new Set(
      context.changedFiles
        .filter(
          ({ categories, status }) =>
            status !== 'deleted' &&
            categories.includes('source') &&
            !categories.includes('test') &&
            !categories.includes('generated'),
        )
        .map(({ path }) => path),
    );
    const coveragePaths = new Set<string>();
    for (const relationship of coverageRelationships) {
      const bothMissing =
        relationship.linesFound === null && relationship.linesHit === null;
      const bothMeasured =
        relationship.linesFound !== null &&
        relationship.linesHit !== null &&
        Number.isSafeInteger(relationship.linesFound) &&
        Number.isSafeInteger(relationship.linesHit) &&
        relationship.linesFound >= 0 &&
        relationship.linesHit >= 0 &&
        relationship.linesHit <= relationship.linesFound;
      if (
        relationship.path.length === 0 ||
        relationship.path.length > 1_000 ||
        (!bothMissing && !bothMeasured)
      ) {
        throw new Error('Coverage relationships contain invalid fields');
      }
      if (coveragePaths.has(relationship.path)) {
        throw new Error('Coverage relationship paths must be unique');
      }
      if (!eligiblePaths.has(relationship.path)) {
        throw new Error(
          'Coverage relationships contain an ineligible changed path',
        );
      }
      coveragePaths.add(relationship.path);
    }
    if (
      coveragePaths.size !== eligiblePaths.size ||
      [...eligiblePaths].some((path) => !coveragePaths.has(path))
    ) {
      throw new Error(
        'Coverage relationships must cover every eligible changed source exactly once',
      );
    }
  }
  const publicExportChanges = context.publicExportChanges ?? [];
  if (publicExportChanges.length > 100_000) {
    throw new Error('Public export change limit exceeded');
  }
  const publicExportKeys = new Set<string>();
  for (const change of publicExportChanges) {
    if (
      change.path.length === 0 ||
      change.path.length > 1_000 ||
      change.exportName.length === 0 ||
      change.exportName.length > 1_000 ||
      !['added', 'modified', 'removed'].includes(change.change)
    ) {
      throw new Error('Public export changes contain invalid fields');
    }
    const key = `${change.path}\0${change.exportName}\0${change.change}`;
    if (publicExportKeys.has(key)) {
      throw new Error('Public export changes must be unique');
    }
    publicExportKeys.add(key);
  }
  const testRelationships = context.testRelationships ?? [];
  if (testRelationships.length > 100_000) {
    throw new Error('Test relationship limit exceeded');
  }
  const relationshipSources = new Set<string>();
  for (const relationship of testRelationships) {
    if (
      relationship.sourcePath.length === 0 ||
      relationship.sourcePath.length > 1_000 ||
      relationship.testPaths.length > 1_000 ||
      relationship.testPaths.some(
        (path) => path.length === 0 || path.length > 1_000,
      )
    ) {
      throw new Error('Test relationships contain invalid fields');
    }
    if (relationshipSources.has(relationship.sourcePath)) {
      throw new Error('Test relationship source paths must be unique');
    }
    if (
      new Set(relationship.testPaths).size !== relationship.testPaths.length
    ) {
      throw new Error('Related test paths must be unique');
    }
    relationshipSources.add(relationship.sourcePath);
  }
  const ownershipRelationships = context.ownershipRelationships;
  if (ownershipRelationships !== undefined) {
    if (ownershipRelationships.length > 100_000) {
      throw new Error('Ownership relationship limit exceeded');
    }
    const changedPaths = new Set(context.changedFiles.map(({ path }) => path));
    const ownershipPaths = new Set<string>();
    for (const relationship of ownershipRelationships) {
      if (
        relationship.path.length === 0 ||
        relationship.path.length > 1_000 ||
        relationship.owners.length > 100 ||
        relationship.owners.some(
          (owner) => owner.length === 0 || owner.length > 200,
        )
      ) {
        throw new Error('Ownership relationships contain invalid fields');
      }
      if (ownershipPaths.has(relationship.path)) {
        throw new Error('Ownership relationship paths must be unique');
      }
      if (new Set(relationship.owners).size !== relationship.owners.length) {
        throw new Error('Ownership relationship owners must be unique');
      }
      if (!changedPaths.has(relationship.path)) {
        throw new Error('Ownership relationships contain an unchanged path');
      }
      ownershipPaths.add(relationship.path);
    }
    if (
      ownershipPaths.size !== changedPaths.size ||
      [...changedPaths].some((path) => !ownershipPaths.has(path))
    ) {
      throw new Error(
        'Ownership relationships must cover every changed path exactly once',
      );
    }
  }
  const sensitiveIds = context.sensitiveAreas.map(({ id }) => id);
  if (new Set(sensitiveIds).size !== sensitiveIds.length) {
    throw new Error('Sensitive area ids must be unique');
  }
  if (
    context.sensitiveAreas.some(
      ({ id, patterns }) =>
        id.length === 0 ||
        id.length > 200 ||
        patterns.length === 0 ||
        patterns.length > 100 ||
        patterns.some(
          (pattern) => pattern.length === 0 || pattern.length > 1_000,
        ),
    )
  ) {
    throw new Error('Sensitive areas exceed id or pattern bounds');
  }
  const sortedRules = [...rules].sort((left, right) =>
    compareText(left.id, right.id),
  );
  if (sortedRules.some(({ id }) => id.length === 0))
    throw new Error('Rule ids cannot be empty');
  if (new Set(sortedRules.map(({ id }) => id)).size !== sortedRules.length) {
    throw new Error('Rule ids must be unique');
  }
  const ruleIds = new Set(sortedRules.map(({ id }) => id));
  const unknownSetting = Object.keys(settings)
    .sort(compareText)
    .find((id) => !ruleIds.has(id));
  if (unknownSetting !== undefined) {
    throw new Error(`Unknown rule setting: ${unknownSetting}`);
  }

  const evidence: Evidence[] = [];
  const findings: Finding[] = [];
  for (const rule of sortedRules) {
    const setting = settings[rule.id];
    if (setting?.enabled === false) continue;
    const weight = setting?.weight ?? rule.defaultWeight;
    if (!Number.isFinite(weight))
      throw new Error(`Rule ${rule.id} has a non-finite weight`);
    const matches = rule.evaluate(context, setting?.options ?? {});
    for (const [index, match] of matches.entries()) {
      const ordinal = index + 1;
      const evidenceId = `${rule.id}:${ordinal}:evidence`;
      const findingId = `${rule.id}:${ordinal}:finding`;
      const sourcePaths = match.evidence.sourcePaths;
      evidence.push({
        ...match.evidence,
        id: evidenceId,
        ...(sourcePaths === undefined
          ? {}
          : { sourcePaths: [...new Set(sourcePaths)].sort(compareText) }),
      });
      findings.push({
        ...match.finding,
        id: findingId,
        ruleId: rule.id,
        weight,
        evidenceIds: [evidenceId],
        affectedPaths: [...new Set(match.finding.affectedPaths)].sort(
          compareText,
        ),
      });
    }
  }
  return { evidence, findings };
}
