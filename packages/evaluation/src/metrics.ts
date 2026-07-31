import type { AnalysisResult } from '@change-risk/core';

import {
  ANALYSIS_UNAVAILABLE_REASONS,
  ANALYZER_TIERS,
  EVALUATION_SUMMARY_SCHEMA_VERSION,
  EVALUATOR_VERSION,
  LIMITATION_CATEGORIES,
  MIN_COMPARISON_CASES,
  REVIEW_TIERS,
  historyEvaluationSummarySchema,
  parseHistoryEvaluationInput,
  type EvaluationCase,
  type EvaluationLabelRecord,
  type EvaluationSegment,
  type HistoryEvaluationInput,
  type HistoryEvaluationSummary,
  type ReviewTier,
} from './schema.js';

const WILSON_Z = 1.959963984540054;

type LabeledCase = {
  evaluationCase: EvaluationCase;
  label: EvaluationLabelRecord;
};

type SegmentDimensions = EvaluationSegment['dimensions'];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function interval(successes: number, total: number) {
  if (total === 0) {
    return { successes, total, estimate: 0, lower: 0, upper: 0 };
  }
  const estimate = successes / total;
  const zSquared = WILSON_Z * WILSON_Z;
  const denominator = 1 + zSquared / total;
  const center = (estimate + zSquared / (2 * total)) / denominator;
  const margin =
    (WILSON_Z *
      Math.sqrt((estimate * (1 - estimate) + zSquared / (4 * total)) / total)) /
    denominator;
  return {
    successes,
    total,
    estimate,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

function tierIndex(tier: ReviewTier): number {
  return REVIEW_TIERS.indexOf(tier);
}

function completeResult(
  evaluationCase: EvaluationCase,
): AnalysisResult | undefined {
  return evaluationCase.analysis.status === 'complete'
    ? evaluationCase.analysis.result
    : undefined;
}

function labelTiers(
  label: EvaluationLabelRecord,
): [number, number] | undefined {
  const [left, right] = label.primaryLabels;
  if ('insufficientContext' in left || 'insufficientContext' in right) {
    return undefined;
  }
  return [tierIndex(left.tier), tierIndex(right.tier)];
}

function limitationCategory(limitation: string) {
  const normalized = limitation.trim().toLowerCase();
  const prefixes: ReadonlyArray<
    readonly [string, (typeof LIMITATION_CATEGORIES)[number]]
  > = [
    ['worktree', 'worktree'],
    ['language index', 'language-index'],
    ['language-index', 'language-index'],
    ['language analysis', 'language-index'],
    ['revision source reads', 'public-surface'],
    ['python public-surface', 'public-surface'],
    ['public surface', 'public-surface'],
    ['public-surface', 'public-surface'],
    ['ownership', 'ownership'],
    ['baseline coverage', 'baseline-coverage'],
    ['baseline-coverage', 'baseline-coverage'],
    ['changed-line', 'changed-lines'],
    ['changed line', 'changed-lines'],
    ['coverage', 'coverage'],
    ['dependency graph', 'graph'],
    ['graph', 'graph'],
    ['artifact provenance', 'artifact-provenance'],
    ['artifact-provenance', 'artifact-provenance'],
  ];
  return (
    prefixes.find(([prefix]) => normalized.startsWith(prefix))?.[1] ?? 'other'
  );
}

function changeSize(result: AnalysisResult) {
  const files = result.changedFiles.length;
  const lines = result.changedFiles.reduce(
    (total, file) => total + file.additions + file.deletions,
    0,
  );
  if (files <= 5 && lines <= 100) {
    return 'small' as const;
  }
  if (files <= 20 && lines <= 500) {
    return 'medium' as const;
  }
  return 'large' as const;
}

function averageRanks(values: readonly number[]): number[] {
  const entries = values
    .map((value, index) => ({ value, index }))
    .sort(
      (left, right) => left.value - right.value || left.index - right.index,
    );
  const ranks = Array<number>(values.length);
  let start = 0;
  while (start < entries.length) {
    let end = start + 1;
    while (
      end < entries.length &&
      entries[end]?.value === entries[start]?.value
    ) {
      end += 1;
    }
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      const originalIndex = entries[index]?.index;
      if (originalIndex !== undefined) {
        ranks[originalIndex] = rank;
      }
    }
    start = end;
  }
  return ranks;
}

function spearman(left: readonly number[], right: readonly number[]) {
  if (left.length < 2 || right.length !== left.length) {
    return null;
  }
  const leftRanks = averageRanks(left);
  const rightRanks = averageRanks(right);
  const leftMean =
    leftRanks.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean =
    rightRanks.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (leftRanks[index] ?? 0) - leftMean;
    const rightDelta = (rightRanks[index] ?? 0) - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  if (leftVariance === 0 || rightVariance === 0) {
    return null;
  }
  return Math.max(
    -1,
    Math.min(1, covariance / Math.sqrt(leftVariance * rightVariance)),
  );
}

function quadraticWeightedKappa(
  pairs: ReadonlyArray<readonly [number, number]>,
) {
  if (pairs.length === 0) {
    return null;
  }
  const leftCounts = [0, 0, 0, 0];
  const rightCounts = [0, 0, 0, 0];
  let observed = 0;
  for (const [left, right] of pairs) {
    leftCounts[left] = (leftCounts[left] ?? 0) + 1;
    rightCounts[right] = (rightCounts[right] ?? 0) + 1;
    observed += (left - right) ** 2 / 9;
  }
  observed /= pairs.length;
  let expected = 0;
  for (let left = 0; left < 4; left += 1) {
    for (let right = 0; right < 4; right += 1) {
      expected +=
        ((left - right) ** 2 / 9) *
        ((leftCounts[left] ?? 0) / pairs.length) *
        ((rightCounts[right] ?? 0) / pairs.length);
    }
  }
  return expected === 0
    ? null
    : Math.max(-1, Math.min(1, 1 - observed / expected));
}

function buildSegment(
  dimensions: SegmentDimensions,
  cases: readonly LabeledCase[],
): EvaluationSegment {
  const complete = cases.flatMap(({ evaluationCase, label }) => {
    const result = completeResult(evaluationCase);
    return result === undefined ? [] : [{ evaluationCase, label, result }];
  });
  const agreementPairs = cases.flatMap(({ label }) => {
    const pair = labelTiers(label);
    return pair === undefined ? [] : [pair];
  });
  const evaluated = complete.flatMap(({ evaluationCase, label, result }) =>
    label.resolvedTier === undefined
      ? []
      : [
          {
            evaluationCase,
            label,
            result,
            expected: tierIndex(label.resolvedTier),
          },
        ],
  );
  const unavailableCounts = new Map<string, number>();
  for (const { evaluationCase } of cases) {
    if (evaluationCase.analysis.status === 'unavailable') {
      unavailableCounts.set(
        evaluationCase.analysis.reason,
        (unavailableCounts.get(evaluationCase.analysis.reason) ?? 0) + 1,
      );
    }
  }

  const limitationCases = new Map<string, number>();
  const ruleCases = new Map<string, number>();
  const ruleFindings = new Map<string, number>();
  const cooccurrence = new Map<string, number>();
  for (const { result } of complete) {
    const categories = new Set(result.limitations.map(limitationCategory));
    for (const category of categories) {
      limitationCases.set(category, (limitationCases.get(category) ?? 0) + 1);
    }
    const perCaseRules = new Map<string, number>();
    for (const finding of result.findings) {
      perCaseRules.set(
        finding.ruleId,
        (perCaseRules.get(finding.ruleId) ?? 0) + 1,
      );
      ruleFindings.set(
        finding.ruleId,
        (ruleFindings.get(finding.ruleId) ?? 0) + 1,
      );
    }
    const rules = [...perCaseRules.keys()].sort(compareText);
    for (const rule of rules) {
      ruleCases.set(rule, (ruleCases.get(rule) ?? 0) + 1);
    }
    for (let left = 0; left < rules.length; left += 1) {
      for (let right = left + 1; right < rules.length; right += 1) {
        const key = `${rules[left]}\0${rules[right]}`;
        cooccurrence.set(key, (cooccurrence.get(key) ?? 0) + 1);
      }
    }
  }

  const matrix = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const scores: number[] = [];
  const expectedRanks: number[] = [];
  let exact = 0;
  let withinOne = 0;
  let underOne = 0;
  let underTwo = 0;
  let overOne = 0;
  let overTwo = 0;
  for (const { expected, result } of evaluated) {
    const actual = ANALYZER_TIERS.indexOf(result.classification);
    const row = matrix[expected];
    if (row !== undefined) {
      row[actual] = (row[actual] ?? 0) + 1;
    }
    const delta = actual - expected;
    exact += Number(delta === 0);
    withinOne += Number(Math.abs(delta) <= 1);
    underOne += Number(delta === -1);
    underTwo += Number(delta <= -2);
    overOne += Number(delta === 1);
    overTwo += Number(delta >= 2);
    scores.push(result.score);
    expectedRanks.push(expected);
  }

  const tierMetrics = REVIEW_TIERS.map((tier, index) => {
    const truePositive = matrix[index]?.[index] ?? 0;
    const predicted = matrix.reduce((sum, row) => sum + (row[index] ?? 0), 0);
    const expected = (matrix[index] ?? []).reduce(
      (sum, value) => sum + value,
      0,
    );
    const precision = predicted === 0 ? 0 : truePositive / predicted;
    const recall = expected === 0 ? 0 : truePositive / expected;
    return {
      tier,
      precision,
      precisionInterval: interval(truePositive, predicted),
      recall,
      recallInterval: interval(truePositive, expected),
      f1:
        precision + recall === 0
          ? 0
          : (2 * precision * recall) / (precision + recall),
    };
  });
  const highExpected =
    (matrix[2] ?? []).reduce((sum, value) => sum + value, 0) +
    (matrix[3] ?? []).reduce((sum, value) => sum + value, 0);
  const highCorrect =
    (matrix[2]?.[2] ?? 0) +
    (matrix[2]?.[3] ?? 0) +
    (matrix[3]?.[2] ?? 0) +
    (matrix[3]?.[3] ?? 0);

  return {
    dimensions,
    caseCount: cases.length,
    comparisonStatus:
      evaluated.length >= MIN_COMPARISON_CASES ? 'sufficient' : 'insufficient',
    analyzableRate: interval(complete.length, cases.length),
    insufficientContextCount: cases.filter(
      ({ label }) => label.resolvedTier === undefined,
    ).length,
    evaluatedCaseCount: evaluated.length,
    unavailableAnalysis: ANALYSIS_UNAVAILABLE_REASONS.map((reason) => ({
      reason,
      cases: unavailableCounts.get(reason) ?? 0,
      total: cases.length,
      prevalence: interval(unavailableCounts.get(reason) ?? 0, cases.length),
    })),
    limitationPrevalence: LIMITATION_CATEGORIES.map((category) => ({
      category,
      cases: limitationCases.get(category) ?? 0,
      total: complete.length,
      prevalence: interval(limitationCases.get(category) ?? 0, complete.length),
    })),
    findingPrevalence: [...ruleFindings.keys()]
      .sort(compareText)
      .map((ruleId) => ({
        ruleId,
        cases: ruleCases.get(ruleId) ?? 0,
        findings: ruleFindings.get(ruleId) ?? 0,
        total: complete.length,
        prevalence: interval(ruleCases.get(ruleId) ?? 0, complete.length),
      })),
    ruleCooccurrence: [...cooccurrence.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, count]) => {
        const [leftRuleId = '', rightRuleId = ''] = key.split('\0');
        return {
          leftRuleId,
          rightRuleId,
          cases: count,
          total: complete.length,
          prevalence: interval(count, complete.length),
        };
      }),
    reviewerAgreement: {
      pairCount: agreementPairs.length,
      exact: interval(
        agreementPairs.filter(([left, right]) => left === right).length,
        agreementPairs.length,
      ),
      withinOneTier: interval(
        agreementPairs.filter(([left, right]) => Math.abs(left - right) <= 1)
          .length,
        agreementPairs.length,
      ),
      quadraticWeightedKappa: quadraticWeightedKappa(agreementPairs),
    },
    classification: {
      confusionMatrix: matrix,
      exact: interval(exact, evaluated.length),
      withinOneTier: interval(withinOne, evaluated.length),
      tierMetrics,
      macroRecall:
        tierMetrics.reduce((sum, metric) => sum + metric.recall, 0) / 4,
      macroF1: tierMetrics.reduce((sum, metric) => sum + metric.f1, 0) / 4,
      combinedHighTierRecall: interval(highCorrect, highExpected),
      underTriageOneTier: interval(underOne, evaluated.length),
      underTriageTwoOrMoreTiers: interval(underTwo, evaluated.length),
      overTriageOneTier: interval(overOne, evaluated.length),
      overTriageTwoOrMoreTiers: interval(overTwo, evaluated.length),
      spearmanRank: spearman(scores, expectedRanks),
    },
  };
}

function dimensionKey(dimensions: SegmentDimensions): string {
  return [
    dimensions.profile,
    dimensions.configurationDigest,
    dimensions.policyPacks.join(','),
    dimensions.samplingStratum,
    dimensions.split,
    dimensions.scope,
    dimensions.scope === 'language' ? dimensions.language : '',
    dimensions.scope === 'change-size' ? dimensions.changeSize : '',
  ].join('\0');
}

export function evaluateHistory(input: unknown): HistoryEvaluationSummary {
  const parsed = parseHistoryEvaluationInput(input);
  const labels = new Map(parsed.labels.map((label) => [label.caseId, label]));
  const sortedCases = [...parsed.cases]
    .sort((left, right) => compareText(left.id, right.id))
    .map((evaluationCase) => ({
      evaluationCase,
      label: labels.get(evaluationCase.id) as EvaluationLabelRecord,
    }));
  const groups = new Map<
    string,
    { dimensions: SegmentDimensions; cases: LabeledCase[] }
  >();
  const add = (dimensions: SegmentDimensions, item: LabeledCase) => {
    const key = dimensionKey(dimensions);
    const group = groups.get(key) ?? { dimensions, cases: [] };
    group.cases.push(item);
    groups.set(key, group);
  };

  for (const item of sortedCases) {
    const { evaluationCase } = item;
    const base = {
      profile: evaluationCase.profile,
      configurationDigest: evaluationCase.configurationDigest,
      policyPacks: [...evaluationCase.policyPacks].sort(compareText),
      samplingStratum: evaluationCase.samplingStratum,
      split: evaluationCase.split,
    };
    add({ scope: 'cohort', ...base }, item);
    add(
      { scope: 'language', ...base, language: evaluationCase.language },
      item,
    );
    const result = completeResult(evaluationCase);
    if (result !== undefined) {
      add(
        { scope: 'change-size', ...base, changeSize: changeSize(result) },
        item,
      );
    }
  }

  const summary: HistoryEvaluationSummary = {
    schemaVersion: EVALUATION_SUMMARY_SCHEMA_VERSION,
    evaluatorVersion: EVALUATOR_VERSION,
    provenance: {
      analyzerCommit: parsed.provenance.analyzerCommit,
      configurationDigests: [
        ...new Set(
          parsed.cases.map(({ configurationDigest }) => configurationDigest),
        ),
      ].sort(compareText),
      corpusDigest: parsed.provenance.corpusDigest,
      labelManifestDigest: parsed.provenance.labelManifestDigest,
      attestationsAreCallerSupplied: true,
    },
    caseCount: parsed.cases.length,
    segments: [...groups.values()]
      .sort((left, right) =>
        compareText(
          dimensionKey(left.dimensions),
          dimensionKey(right.dimensions),
        ),
      )
      .map(({ dimensions, cases }) => buildSegment(dimensions, cases)),
  };
  return historyEvaluationSummarySchema.parse(summary);
}

export function renderHistoryEvaluationSummary(
  summary: HistoryEvaluationSummary,
): string {
  return `${JSON.stringify(historyEvaluationSummarySchema.parse(summary), null, 2)}\n`;
}

export function evaluateAndRenderHistory(
  input: HistoryEvaluationInput,
): string {
  return renderHistoryEvaluationSummary(evaluateHistory(input));
}

export { changeSize as classifyEvaluationChangeSize };
