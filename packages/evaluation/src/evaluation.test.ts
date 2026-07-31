import type { AnalysisResult } from '@change-risk/core';
import { describe, expect, it } from 'vitest';

import {
  MAX_CASE_LIMITATIONS,
  MAX_EVALUATION_RULES,
  MAX_EVALUATION_SEGMENTS,
  MAX_LIMITATION_TEXT_LENGTH,
  evaluateAndRenderHistory,
  evaluateHistory,
  historyEvaluationInputSchema,
  historyEvaluationSummarySchema,
  parseHistoryEvaluationInput,
  renderHistoryEvaluationSummary,
  type EvaluationCase,
  type EvaluationLabelRecord,
  type HistoryEvaluationInput,
  type ReviewTier,
} from './index.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const DIGEST_A = '1'.repeat(64);
const DIGEST_B = '2'.repeat(64);
const DIGEST_C = '3'.repeat(64);

function result(
  options: {
    classification?: AnalysisResult['classification'];
    score?: number;
    files?: number;
    lines?: number;
    rules?: string[];
    limitations?: string[];
  } = {},
): AnalysisResult {
  const rules = options.rules ?? [];
  const score = rules.length === 0 ? 0 : (options.score ?? rules.length);
  const fileCount = options.files ?? 1;
  const totalLines = options.lines ?? 10;
  const changedFiles = Array.from({ length: fileCount }, (_, index) => ({
    path: `src/file-${String(index).padStart(2, '0')}.ts`,
    status: 'modified' as const,
    additions: index === 0 ? totalLines : 0,
    deletions: 0,
    binary: false,
    categories: ['source' as const],
  }));
  const findings = rules.map((ruleId, index) => ({
    id: `finding-${index}`,
    ruleId,
    title: ruleId,
    severity: 'medium' as const,
    weight: 1,
    explanation: 'Fixture evidence',
    evidenceIds: [`evidence-${index}`],
    affectedPaths: [],
  }));
  return {
    schemaVersion: 1,
    revisions: { base: SHA_A, head: SHA_B },
    changedFiles,
    evidence: rules.map((_, index) => ({
      id: `evidence-${index}`,
      kind: 'fixture',
      summary: 'Fixture evidence',
      data: {},
    })),
    findings,
    score,
    classification: options.classification ?? 'low',
    scoreContributions: rules.map((ruleId, index) => ({
      ruleId,
      findingIds: [`finding-${index}`],
      weight: index === 0 ? score - (rules.length - 1) : 1,
    })),
    limitations: options.limitations ?? [],
  };
}

function evaluationCase(
  id: string,
  sequence: number,
  analysis: EvaluationCase['analysis'],
  overrides: Partial<EvaluationCase> = {},
): EvaluationCase {
  const revisions = {
    base: sequence.toString(16).padStart(40, '0'),
    head: (sequence + 100).toString(16).padStart(40, '0'),
  };
  const alignedAnalysis: EvaluationCase['analysis'] =
    analysis.status === 'complete'
      ? {
          status: 'complete',
          result: { ...analysis.result, revisions },
        }
      : analysis;
  return {
    id,
    repositoryId: 'repository-a',
    duplicateGroup: `group-${id}`,
    sequence,
    language: 'typescript',
    profile: 'default-scoring',
    policyPacks: [],
    samplingStratum: 'representative',
    split: 'development',
    configurationDigest: DIGEST_A,
    revisions,
    analysis: alignedAnalysis,
    ...overrides,
  };
}

function label(
  caseId: string,
  left: ReviewTier,
  right: ReviewTier,
  resolvedTier: ReviewTier,
): EvaluationLabelRecord {
  return {
    caseId,
    primaryLabels: [
      { reviewerId: 'reviewer-a', tier: left, reasonCodes: [] },
      { reviewerId: 'reviewer-b', tier: right, reasonCodes: [] },
    ],
    resolvedTier,
  };
}

function validInput(): HistoryEvaluationInput {
  return {
    schemaVersion: 1,
    provenance: {
      analyzerCommit: SHA_C,
      corpusDigest: DIGEST_B,
      labelManifestDigest: DIGEST_C,
      analyzerIdentityAttested: true,
      configurationIdentityAttested: true,
      profileConformanceAttested: true,
      samplingProvenanceAttested: true,
      reviewerIndependenceAttested: true,
      repositoryAuthorizationAttested: true,
    },
    cases: [
      evaluationCase('case-a', 1, {
        status: 'complete',
        result: result({
          classification: 'moderate',
          score: 1,
          rules: ['large-change'],
          limitations: ['Ownership evidence unavailable at /private/path'],
        }),
      }),
      evaluationCase('case-b', 2, {
        status: 'complete',
        result: result({
          classification: 'low',
          score: 8,
          files: 6,
          lines: 120,
          rules: ['large-change', 'sensitive-path'],
          limitations: ['Unrecognized private detail'],
        }),
      }),
      evaluationCase(
        'case-c',
        3,
        {
          status: 'complete',
          result: result({
            classification: 'critical',
            score: 15,
            files: 21,
            lines: 600,
            rules: ['sensitive-path'],
            limitations: [
              'Language analysis issue: parse-error (private.py).',
              'Revision source reads are capped at 4000000 bytes.',
            ],
          }),
        },
        { language: 'python' },
      ),
      evaluationCase('case-d', 4, {
        status: 'unavailable',
        reason: 'revision-unavailable',
      }),
    ],
    labels: [
      label('case-a', 'routine', 'routine', 'routine'),
      label('case-b', 'focused', 'intensive', 'intensive'),
      {
        caseId: 'case-c',
        primaryLabels: [
          {
            reviewerId: 'reviewer-a',
            tier: 'routine',
            reasonCodes: ['consumer-compatibility'],
          },
          {
            reviewerId: 'reviewer-b',
            tier: 'exceptional',
            reasonCodes: ['operational-impact'],
          },
        ],
        resolvedTier: 'exceptional',
        adjudicator: {
          reviewerId: 'reviewer-c',
          tier: 'exceptional',
          reasonCodes: ['coordination-scope'],
        },
      },
      {
        caseId: 'case-d',
        primaryLabels: [
          {
            reviewerId: 'reviewer-a',
            insufficientContext: true,
            reasonCodes: [],
          },
          {
            reviewerId: 'reviewer-b',
            tier: 'focused',
            reasonCodes: ['verification-gap'],
          },
        ],
      },
    ],
  };
}

describe('historical evaluation schemas', () => {
  it('accepts a bounded versioned corpus and emits valid source-free metrics', () => {
    const summary = evaluateHistory(validInput());
    expect(historyEvaluationSummarySchema.parse(summary)).toEqual(summary);
    expect(summary.caseCount).toBe(4);
    expect(summary.provenance.configurationDigests).toEqual([DIGEST_A]);

    const cohort = summary.segments.find(
      ({ dimensions }) => dimensions.scope === 'cohort',
    );
    expect(cohort).toMatchObject({
      caseCount: 4,
      comparisonStatus: 'insufficient',
      analyzableRate: { successes: 3, total: 4, estimate: 0.75 },
      insufficientContextCount: 1,
      evaluatedCaseCount: 3,
      reviewerAgreement: {
        pairCount: 3,
        exact: { successes: 1, total: 3 },
        withinOneTier: { successes: 2, total: 3 },
        quadraticWeightedKappa: expect.closeTo(0.0625, 12),
      },
      classification: {
        confusionMatrix: [
          [0, 1, 0, 0],
          [0, 0, 0, 0],
          [1, 0, 0, 0],
          [0, 0, 0, 1],
        ],
        exact: { successes: 1, total: 3 },
        withinOneTier: { successes: 2, total: 3 },
        underTriageTwoOrMoreTiers: { successes: 1, total: 3 },
        overTriageOneTier: { successes: 1, total: 3 },
        spearmanRank: 1,
      },
    });
    expect(cohort?.unavailableAnalysis).toContainEqual(
      expect.objectContaining({
        reason: 'revision-unavailable',
        cases: 1,
        total: 4,
      }),
    );
    expect(cohort?.findingPrevalence).toMatchObject([
      { ruleId: 'large-change', cases: 2, findings: 2, total: 3 },
      { ruleId: 'sensitive-path', cases: 2, findings: 2, total: 3 },
    ]);
    expect(cohort?.ruleCooccurrence).toMatchObject([
      {
        leftRuleId: 'large-change',
        rightRuleId: 'sensitive-path',
        cases: 1,
        total: 3,
      },
    ]);
    expect(cohort?.limitationPrevalence).toContainEqual(
      expect.objectContaining({
        category: 'ownership',
        cases: 1,
        total: 3,
      }),
    );
    expect(cohort?.limitationPrevalence).toContainEqual(
      expect.objectContaining({
        category: 'other',
        cases: 1,
        total: 3,
      }),
    );
    expect(cohort?.limitationPrevalence).toContainEqual(
      expect.objectContaining({
        category: 'language-index',
        cases: 1,
        total: 3,
      }),
    );
    expect(cohort?.limitationPrevalence).toContainEqual(
      expect.objectContaining({
        category: 'public-surface',
        cases: 1,
        total: 3,
      }),
    );

    const json = renderHistoryEvaluationSummary(summary);
    expect(json.endsWith('\n')).toBe(true);
    expect(json).not.toContain('/private/path');
    expect(json).not.toContain('private.py');
    expect(json).not.toContain('repository-a');
    expect(json).not.toContain('reviewer-a');
    expect(json).not.toContain('case-a');
  });

  it('rejects malformed revisions, mismatched results, labels, and leakage', () => {
    const malformed = validInput();
    malformed.cases[0] = {
      ...malformed.cases[0]!,
      revisions: { base: 'short', head: SHA_B },
    };
    expect(() => parseHistoryEvaluationInput(malformed)).toThrow();

    const mismatch = validInput();
    const first = mismatch.cases[0]!;
    mismatch.cases[0] = {
      ...first,
      revisions: { base: SHA_C, head: SHA_B },
    };
    expect(() => parseHistoryEvaluationInput(mismatch)).toThrow(
      /Analysis revisions must match/,
    );

    const missingLabel = validInput();
    missingLabel.labels = missingLabel.labels.slice(1);
    expect(() => parseHistoryEvaluationInput(missingLabel)).toThrow(
      /Missing label/,
    );

    const exactDuplicate = validInput();
    exactDuplicate.cases[1] = {
      ...exactDuplicate.cases[1]!,
      revisions: { ...exactDuplicate.cases[0]!.revisions },
    };
    if (exactDuplicate.cases[1]!.analysis.status === 'complete') {
      exactDuplicate.cases[1]!.analysis.result.revisions = {
        ...exactDuplicate.cases[0]!.revisions,
      };
    }
    expect(() => parseHistoryEvaluationInput(exactDuplicate)).toThrow(
      /revision pairs must be unique/,
    );

    const duplicateAcrossSplits = validInput();
    duplicateAcrossSplits.cases[1] = {
      ...duplicateAcrossSplits.cases[1]!,
      duplicateGroup: duplicateAcrossSplits.cases[0]!.duplicateGroup,
      split: 'forward-time',
    };
    expect(() => parseHistoryEvaluationInput(duplicateAcrossSplits)).toThrow(
      /Duplicate groups cannot cross/,
    );

    const unseenLeakage = validInput();
    unseenLeakage.cases[3] = {
      ...unseenLeakage.cases[3]!,
      split: 'unseen-repository',
    };
    expect(() => parseHistoryEvaluationInput(unseenLeakage)).toThrow(
      /cannot appear in another split/,
    );

    const timeLeakage = validInput();
    timeLeakage.cases[1] = {
      ...timeLeakage.cases[1]!,
      split: 'forward-time',
      sequence: 0,
    };
    expect(() => parseHistoryEvaluationInput(timeLeakage)).toThrow(
      /must follow development/,
    );
  });

  it('requires distinct blinded reviewers and bounded adjudication', () => {
    const sameReviewer = validInput();
    sameReviewer.labels[0] = {
      ...sameReviewer.labels[0]!,
      primaryLabels: [
        {
          reviewerId: 'reviewer-a',
          tier: 'routine',
          reasonCodes: [],
        },
        {
          reviewerId: 'reviewer-a',
          tier: 'routine',
          reasonCodes: [],
        },
      ],
    };
    expect(() => parseHistoryEvaluationInput(sameReviewer)).toThrow(
      /must be distinct/,
    );

    const missingAdjudicator = validInput();
    missingAdjudicator.labels[2] = {
      ...missingAdjudicator.labels[2]!,
      adjudicator: undefined,
    };
    expect(() => parseHistoryEvaluationInput(missingAdjudicator)).toThrow(
      /require an adjudicator/,
    );

    const improperResolution = validInput();
    improperResolution.labels[1] = {
      ...improperResolution.labels[1]!,
      resolvedTier: 'exceptional',
    };
    expect(() => parseHistoryEvaluationInput(improperResolution)).toThrow(
      /must resolve to a primary tier/,
    );
  });

  it('keeps effective configurations and policy packs in separate cohorts', () => {
    const input = validInput();
    input.cases[1] = {
      ...input.cases[1]!,
      profile: 'repository-policy',
      policyPacks: ['strict-review', 'security-sensitive'],
      configurationDigest: DIGEST_B,
    };
    const summary = evaluateHistory(input);
    const cohorts = summary.segments.filter(
      ({ dimensions }) => dimensions.scope === 'cohort',
    );
    expect(cohorts).toHaveLength(2);
    expect(cohorts.map(({ dimensions }) => dimensions)).toMatchObject([
      {
        profile: 'default-scoring',
        configurationDigest: DIGEST_A,
        policyPacks: [],
      },
      {
        profile: 'repository-policy',
        configurationDigest: DIGEST_B,
        policyPacks: ['security-sensitive', 'strict-review'],
      },
    ]);

    const invalid = validInput();
    invalid.cases[0] = {
      ...invalid.cases[0]!,
      policyPacks: ['strict-review'],
    };
    expect(() => parseHistoryEvaluationInput(invalid)).toThrow(
      /Default-scoring cases cannot select policy packs/,
    );
  });

  it('enforces per-case evaluation bounds', () => {
    const overLimit = validInput();
    const first = overLimit.cases[0]!;
    if (first.analysis.status !== 'complete') {
      throw new Error('Expected complete fixture result');
    }
    overLimit.cases[0] = {
      ...first,
      analysis: {
        status: 'complete',
        result: {
          ...first.analysis.result,
          limitations: Array.from(
            { length: MAX_CASE_LIMITATIONS + 1 },
            (_, index) => `limitation-${index}`,
          ),
        },
      },
    };
    expect(() => parseHistoryEvaluationInput(overLimit)).toThrow(
      /limitations exceeds the evaluation bound/,
    );

    const longLimitation = validInput();
    const textCase = longLimitation.cases[0]!;
    if (textCase.analysis.status !== 'complete') {
      throw new Error('Expected complete fixture result');
    }
    longLimitation.cases[0] = {
      ...textCase,
      analysis: {
        status: 'complete',
        result: {
          ...textCase.analysis.result,
          limitations: ['x'.repeat(MAX_LIMITATION_TEXT_LENGTH + 1)],
        },
      },
    };
    expect(() => parseHistoryEvaluationInput(longLimitation)).toThrow(
      /Limitation text exceeds/,
    );

    const tooManyRules = validInput();
    const ruleCase = tooManyRules.cases[0]!;
    if (ruleCase.analysis.status !== 'complete') {
      throw new Error('Expected complete fixture result');
    }
    const rules = Array.from(
      { length: MAX_EVALUATION_RULES + 1 },
      (_, index) => `rule-${index}`,
    );
    tooManyRules.cases[0] = {
      ...ruleCase,
      analysis: {
        status: 'complete',
        result: {
          ...result({ rules }),
          revisions: { ...ruleCase.revisions },
        },
      },
    };
    expect(() => parseHistoryEvaluationInput(tooManyRules)).toThrow(
      /rule-id bound/,
    );

    const tooManySegments = validInput();
    const caseCount = Math.floor(MAX_EVALUATION_SEGMENTS / 3) + 1;
    tooManySegments.cases = Array.from({ length: caseCount }, (_, index) =>
      evaluationCase(
        `segment-case-${index}`,
        index + 1,
        { status: 'complete', result: result() },
        {
          configurationDigest: index.toString(16).padStart(64, '0'),
        },
      ),
    );
    tooManySegments.labels = tooManySegments.cases.map(({ id }) =>
      label(id, 'routine', 'routine', 'routine'),
    );
    expect(() => parseHistoryEvaluationInput(tooManySegments)).toThrow(
      /segment bound/,
    );
  });

  it('is invariant to case and label ordering and repeat runs', () => {
    const input = validInput();
    const first = evaluateAndRenderHistory(input);
    const second = evaluateAndRenderHistory(input);
    const reordered = evaluateAndRenderHistory({
      ...input,
      cases: [...input.cases].reverse(),
      labels: [...input.labels].reverse(),
    });
    expect(second).toBe(first);
    expect(reordered).toBe(first);
  });

  it('exports JSON schemas for the separate input and summary contracts', () => {
    expect(historyEvaluationInputSchema.safeParse(validInput()).success).toBe(
      true,
    );
    expect(
      historyEvaluationSummarySchema.safeParse(evaluateHistory(validInput()))
        .success,
    ).toBe(true);
  });
});
