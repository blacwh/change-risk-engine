import type { AnalysisResult } from '@change-risk/core';

import type { RuleEvaluation } from './engine.js';

export type RiskThresholds = {
  moderate: number;
  high: number;
  critical: number;
};

export type ScoredRuleEvaluation = RuleEvaluation & {
  score: number;
  classification: AnalysisResult['classification'];
  scoreContributions: AnalysisResult['scoreContributions'];
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateThresholds(thresholds: RiskThresholds): void {
  if (
    !Number.isFinite(thresholds.moderate) ||
    !Number.isFinite(thresholds.high) ||
    !Number.isFinite(thresholds.critical) ||
    thresholds.moderate < 0 ||
    thresholds.moderate >= thresholds.high ||
    thresholds.high >= thresholds.critical
  ) {
    throw new Error(
      'Risk thresholds must be finite, nonnegative, and strictly increasing',
    );
  }
}

function classificationFor(
  score: number,
  thresholds: RiskThresholds,
): AnalysisResult['classification'] {
  if (score >= thresholds.critical) return 'critical';
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.moderate) return 'moderate';
  return 'low';
}

export function scoreRuleEvaluation(
  evaluation: RuleEvaluation,
  thresholds: RiskThresholds,
): ScoredRuleEvaluation {
  validateThresholds(thresholds);
  const findingIds = new Set<string>();
  const grouped = new Map<
    string,
    { findingIds: string[]; rawWeight: number }
  >();
  for (const finding of evaluation.findings) {
    if (findingIds.has(finding.id))
      throw new Error('Finding ids must be unique');
    if (!Number.isFinite(finding.weight)) {
      throw new Error('Finding weights must be finite');
    }
    findingIds.add(finding.id);
    const group = grouped.get(finding.ruleId) ?? {
      findingIds: [],
      rawWeight: 0,
    };
    group.findingIds.push(finding.id);
    group.rawWeight += finding.weight;
    if (!Number.isFinite(group.rawWeight)) {
      throw new Error(`Rule ${finding.ruleId} contribution is not finite`);
    }
    grouped.set(finding.ruleId, group);
  }

  const groups = [...grouped.entries()].sort(([left], [right]) =>
    compareText(left, right),
  );
  let availableScore = groups.reduce(
    (total, [, group]) =>
      group.rawWeight > 0 ? total + group.rawWeight : total,
    0,
  );
  if (!Number.isFinite(availableScore)) {
    throw new Error('Positive score contribution total is not finite');
  }

  const scoreContributions = groups.map(([ruleId, group]) => {
    group.findingIds.sort(compareText);
    const weight =
      group.rawWeight < 0
        ? availableScore === 0
          ? 0
          : Math.max(group.rawWeight, -availableScore)
        : group.rawWeight;
    if (weight < 0) availableScore += weight;
    return { ruleId, findingIds: group.findingIds, weight };
  });
  const score = scoreContributions.reduce(
    (total, contribution) => total + contribution.weight,
    0,
  );
  return {
    ...evaluation,
    score,
    classification: classificationFor(score, thresholds),
    scoreContributions,
  };
}
