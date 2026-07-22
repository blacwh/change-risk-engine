import type { ChangedFile, Evidence, Finding } from '@change-risk/core';

export type RuleSetting = {
  enabled?: boolean;
  options?: Readonly<Record<string, unknown>>;
  weight?: number;
};

export type RuleContext = {
  changedFiles: readonly ChangedFile[];
  sensitiveAreas: readonly { id: string; patterns: readonly string[] }[];
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
