import { analysisResultSchema } from '@change-risk/core';
import { z } from 'zod';

export const EVALUATION_INPUT_SCHEMA_VERSION = 1 as const;
export const EVALUATION_SUMMARY_SCHEMA_VERSION = 1 as const;
export const EVALUATOR_VERSION = 1 as const;
export const MAX_EVALUATION_CASES = 10_000;
export const MAX_CASE_CHANGED_FILES = 10_000;
export const MAX_CASE_FINDINGS = 10_000;
export const MAX_CASE_LIMITATIONS = 1_000;
export const MAX_LIMITATION_TEXT_LENGTH = 4_096;
export const MAX_EVALUATION_RULES = 32;
export const MAX_EVALUATION_SEGMENTS = 1_000;
export const MIN_COMPARISON_CASES = 40;

export const REVIEW_TIERS = [
  'routine',
  'focused',
  'intensive',
  'exceptional',
] as const;
export const ANALYZER_TIERS = ['low', 'moderate', 'high', 'critical'] as const;
export const EVALUATION_LANGUAGES = ['typescript', 'python'] as const;
export const EVALUATION_PROFILES = [
  'default-scoring',
  'repository-policy',
] as const;
export const EVALUATION_POLICY_PACKS = [
  'security-sensitive',
  'strict-review',
] as const;
export const SAMPLING_STRATA = ['representative', 'signal-enriched'] as const;
export const EVALUATION_SPLITS = [
  'development',
  'forward-time',
  'unseen-repository',
] as const;
export const CHANGE_SIZE_BANDS = ['small', 'medium', 'large'] as const;
export const REVIEW_REASON_CODES = [
  'consumer-compatibility',
  'data-state',
  'deployment-runtime',
  'security-access',
  'dependency-supply',
  'verification-gap',
  'operational-impact',
  'coordination-scope',
  'other-documented',
] as const;
export const LIMITATION_CATEGORIES = [
  'worktree',
  'language-index',
  'public-surface',
  'ownership',
  'coverage',
  'changed-lines',
  'baseline-coverage',
  'graph',
  'artifact-provenance',
  'other',
] as const;
export const ANALYSIS_UNAVAILABLE_REASONS = [
  'revision-unavailable',
  'invalid-result',
  'resource-limit',
  'operational-error',
  'other',
] as const;

const boundedIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const objectIdSchema = z.string().regex(/^[0-9a-f]{40}$/);
const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const reviewerIdSchema = boundedIdSchema;
const reasonCodesSchema = z
  .array(z.enum(REVIEW_REASON_CODES))
  .max(REVIEW_REASON_CODES.length)
  .refine((values) => new Set(values).size === values.length, {
    message: 'Reason codes must be unique',
  });

const tierLabelSchema = z
  .object({
    reviewerId: reviewerIdSchema,
    tier: z.enum(REVIEW_TIERS),
    reasonCodes: reasonCodesSchema,
  })
  .strict();

const insufficientContextLabelSchema = z
  .object({
    reviewerId: reviewerIdSchema,
    insufficientContext: z.literal(true),
    reasonCodes: reasonCodesSchema,
  })
  .strict();

export const reviewLabelSchema = z.union([
  tierLabelSchema,
  insufficientContextLabelSchema,
]);

const completeAnalysisSchema = z
  .object({
    status: z.literal('complete'),
    result: analysisResultSchema,
  })
  .strict();

const unavailableAnalysisSchema = z
  .object({
    status: z.literal('unavailable'),
    reason: z.enum(ANALYSIS_UNAVAILABLE_REASONS),
  })
  .strict();

export const evaluationCaseSchema = z
  .object({
    id: boundedIdSchema,
    repositoryId: boundedIdSchema,
    duplicateGroup: boundedIdSchema,
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    language: z.enum(EVALUATION_LANGUAGES),
    profile: z.enum(EVALUATION_PROFILES),
    policyPacks: z
      .array(z.enum(EVALUATION_POLICY_PACKS))
      .max(EVALUATION_POLICY_PACKS.length)
      .refine((values) => new Set(values).size === values.length, {
        message: 'Policy packs must be unique',
      }),
    samplingStratum: z.enum(SAMPLING_STRATA),
    split: z.enum(EVALUATION_SPLITS),
    configurationDigest: digestSchema,
    revisions: z
      .object({ base: objectIdSchema, head: objectIdSchema })
      .strict(),
    analysis: z.discriminatedUnion('status', [
      completeAnalysisSchema,
      unavailableAnalysisSchema,
    ]),
  })
  .strict()
  .superRefine((evaluationCase, context) => {
    if (
      evaluationCase.profile === 'default-scoring' &&
      evaluationCase.policyPacks.length > 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Default-scoring cases cannot select policy packs',
        path: ['policyPacks'],
      });
    }
    if (evaluationCase.analysis.status !== 'complete') {
      return;
    }
    const { result } = evaluationCase.analysis;
    if (
      result.revisions.base !== evaluationCase.revisions.base ||
      result.revisions.head !== evaluationCase.revisions.head
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Analysis revisions must match case revisions',
        path: ['analysis', 'result', 'revisions'],
      });
    }
    const bounds = [
      ['changedFiles', result.changedFiles.length, MAX_CASE_CHANGED_FILES],
      ['findings', result.findings.length, MAX_CASE_FINDINGS],
      ['limitations', result.limitations.length, MAX_CASE_LIMITATIONS],
    ] as const;
    for (const [field, count, maximum] of bounds) {
      if (count > maximum) {
        context.addIssue({
          code: 'too_big',
          origin: 'array',
          maximum,
          inclusive: true,
          message: `${field} exceeds the evaluation bound`,
          path: ['analysis', 'result', field],
        });
      }
    }
    for (const [index, finding] of result.findings.entries()) {
      if (!boundedIdSchema.safeParse(finding.ruleId).success) {
        context.addIssue({
          code: 'custom',
          message: 'Finding rule ids must be bounded stable ids',
          path: ['analysis', 'result', 'findings', index, 'ruleId'],
        });
      }
    }
    for (const [index, limitation] of result.limitations.entries()) {
      if (limitation.length > MAX_LIMITATION_TEXT_LENGTH) {
        context.addIssue({
          code: 'too_big',
          origin: 'string',
          maximum: MAX_LIMITATION_TEXT_LENGTH,
          inclusive: true,
          message: 'Limitation text exceeds the evaluation bound',
          path: ['analysis', 'result', 'limitations', index],
        });
      }
    }
  });

export const evaluationLabelRecordSchema = z
  .object({
    caseId: boundedIdSchema,
    primaryLabels: z.tuple([reviewLabelSchema, reviewLabelSchema]),
    resolvedTier: z.enum(REVIEW_TIERS).optional(),
    adjudicator: tierLabelSchema.optional(),
  })
  .strict()
  .superRefine((record, context) => {
    const [left, right] = record.primaryLabels;
    if (left.reviewerId === right.reviewerId) {
      context.addIssue({
        code: 'custom',
        message: 'Primary reviewers must be distinct',
        path: ['primaryLabels'],
      });
    }

    const hasInsufficientContext =
      'insufficientContext' in left || 'insufficientContext' in right;
    if (hasInsufficientContext) {
      if (
        record.resolvedTier !== undefined ||
        record.adjudicator !== undefined
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Insufficient-context labels cannot have a resolved tier or adjudicator',
        });
      }
      return;
    }

    const leftIndex = REVIEW_TIERS.indexOf(left.tier);
    const rightIndex = REVIEW_TIERS.indexOf(right.tier);
    const distance = Math.abs(leftIndex - rightIndex);
    if (record.resolvedTier === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Tier labels require a resolved tier',
        path: ['resolvedTier'],
      });
    }
    if (distance > 1) {
      if (record.adjudicator === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'Disagreements over one tier require an adjudicator',
          path: ['adjudicator'],
        });
      } else {
        if (
          record.adjudicator.reviewerId === left.reviewerId ||
          record.adjudicator.reviewerId === right.reviewerId
        ) {
          context.addIssue({
            code: 'custom',
            message: 'The adjudicator must be a distinct reviewer',
            path: ['adjudicator', 'reviewerId'],
          });
        }
        if (record.resolvedTier !== record.adjudicator.tier) {
          context.addIssue({
            code: 'custom',
            message: 'Resolved tier must match the adjudicator tier',
            path: ['resolvedTier'],
          });
        }
      }
    } else if (record.adjudicator !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Adjudication is only allowed for disagreements over one tier',
        path: ['adjudicator'],
      });
    } else if (left.tier === right.tier && record.resolvedTier !== left.tier) {
      context.addIssue({
        code: 'custom',
        message: 'Matching primary tiers must remain the resolved tier',
        path: ['resolvedTier'],
      });
    } else if (
      left.tier !== right.tier &&
      record.resolvedTier !== left.tier &&
      record.resolvedTier !== right.tier
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A one-tier disagreement must resolve to a primary tier',
        path: ['resolvedTier'],
      });
    }
  });

export const historyEvaluationInputSchema = z
  .object({
    schemaVersion: z.literal(EVALUATION_INPUT_SCHEMA_VERSION),
    provenance: z
      .object({
        analyzerCommit: objectIdSchema,
        corpusDigest: digestSchema,
        labelManifestDigest: digestSchema,
        analyzerIdentityAttested: z.literal(true),
        configurationIdentityAttested: z.literal(true),
        profileConformanceAttested: z.literal(true),
        samplingProvenanceAttested: z.literal(true),
        reviewerIndependenceAttested: z.literal(true),
        repositoryAuthorizationAttested: z.literal(true),
      })
      .strict(),
    cases: z.array(evaluationCaseSchema).min(1).max(MAX_EVALUATION_CASES),
    labels: z
      .array(evaluationLabelRecordSchema)
      .min(1)
      .max(MAX_EVALUATION_CASES),
  })
  .strict()
  .superRefine((input, context) => {
    const caseIds = new Set<string>();
    const labelCaseIds = new Set<string>();
    const exactChanges = new Set<string>();
    const ruleIds = new Set<string>();
    const segmentKeys = new Set<string>();
    const duplicateGroups = new Map<
      string,
      { repositoryId: string; split: string }
    >();
    const repositorySplits = new Map<string, Set<string>>();
    const repositorySequences = new Map<string, Map<number, string>>();
    const repositoryTimeline = new Map<
      string,
      { development: number[]; forward: number[] }
    >();

    for (const [index, evaluationCase] of input.cases.entries()) {
      if (caseIds.has(evaluationCase.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate case id: ${evaluationCase.id}`,
          path: ['cases', index, 'id'],
        });
      }
      caseIds.add(evaluationCase.id);
      const exactChange = [
        evaluationCase.repositoryId,
        evaluationCase.revisions.base,
        evaluationCase.revisions.head,
      ].join('\0');
      if (exactChanges.has(exactChange)) {
        context.addIssue({
          code: 'custom',
          message: 'Exact repository revision pairs must be unique',
          path: ['cases', index, 'revisions'],
        });
      }
      exactChanges.add(exactChange);

      const segmentBase = [
        evaluationCase.profile,
        evaluationCase.configurationDigest,
        [...evaluationCase.policyPacks].sort().join(','),
        evaluationCase.samplingStratum,
        evaluationCase.split,
      ].join('\0');
      segmentKeys.add(`${segmentBase}\0cohort`);
      segmentKeys.add(`${segmentBase}\0language\0${evaluationCase.language}`);
      if (evaluationCase.analysis.status === 'complete') {
        for (const finding of evaluationCase.analysis.result.findings) {
          ruleIds.add(finding.ruleId);
        }
        const files = evaluationCase.analysis.result.changedFiles.length;
        const lines = evaluationCase.analysis.result.changedFiles.reduce(
          (total, file) => total + file.additions + file.deletions,
          0,
        );
        const size =
          files <= 5 && lines <= 100
            ? 'small'
            : files <= 20 && lines <= 500
              ? 'medium'
              : 'large';
        segmentKeys.add(`${segmentBase}\0change-size\0${size}`);
      }

      const group = duplicateGroups.get(evaluationCase.duplicateGroup);
      if (
        group !== undefined &&
        (group.repositoryId !== evaluationCase.repositoryId ||
          group.split !== evaluationCase.split)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate groups cannot cross repositories or splits',
          path: ['cases', index, 'duplicateGroup'],
        });
      } else {
        duplicateGroups.set(evaluationCase.duplicateGroup, {
          repositoryId: evaluationCase.repositoryId,
          split: evaluationCase.split,
        });
      }

      const splits =
        repositorySplits.get(evaluationCase.repositoryId) ?? new Set<string>();
      splits.add(evaluationCase.split);
      repositorySplits.set(evaluationCase.repositoryId, splits);

      const sequences =
        repositorySequences.get(evaluationCase.repositoryId) ??
        new Map<number, string>();
      if (sequences.has(evaluationCase.sequence)) {
        context.addIssue({
          code: 'custom',
          message: 'Sequence values must be unique within a repository',
          path: ['cases', index, 'sequence'],
        });
      }
      sequences.set(evaluationCase.sequence, evaluationCase.id);
      repositorySequences.set(evaluationCase.repositoryId, sequences);

      const timeline = repositoryTimeline.get(evaluationCase.repositoryId) ?? {
        development: [],
        forward: [],
      };
      if (evaluationCase.split === 'development') {
        timeline.development.push(evaluationCase.sequence);
      } else if (evaluationCase.split === 'forward-time') {
        timeline.forward.push(evaluationCase.sequence);
      }
      repositoryTimeline.set(evaluationCase.repositoryId, timeline);
    }

    for (const [repositoryId, splits] of repositorySplits) {
      if (splits.has('unseen-repository') && splits.size > 1) {
        context.addIssue({
          code: 'custom',
          message: `Unseen repository ${repositoryId} cannot appear in another split`,
          path: ['cases'],
        });
      }
    }
    for (const [repositoryId, timeline] of repositoryTimeline) {
      if (timeline.development.length > 0 && timeline.forward.length > 0) {
        const latestDevelopment = Math.max(...timeline.development);
        const earliestForward = Math.min(...timeline.forward);
        if (earliestForward <= latestDevelopment) {
          context.addIssue({
            code: 'custom',
            message: `Forward-time cases for ${repositoryId} must follow development cases`,
            path: ['cases'],
          });
        }
      }
    }

    for (const [index, label] of input.labels.entries()) {
      if (labelCaseIds.has(label.caseId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate label case id: ${label.caseId}`,
          path: ['labels', index, 'caseId'],
        });
      }
      labelCaseIds.add(label.caseId);
      if (!caseIds.has(label.caseId)) {
        context.addIssue({
          code: 'custom',
          message: `Label references unknown case: ${label.caseId}`,
          path: ['labels', index, 'caseId'],
        });
      }
    }
    for (const caseId of caseIds) {
      if (!labelCaseIds.has(caseId)) {
        context.addIssue({
          code: 'custom',
          message: `Missing label for case: ${caseId}`,
          path: ['labels'],
        });
      }
    }
    if (ruleIds.size > MAX_EVALUATION_RULES) {
      context.addIssue({
        code: 'custom',
        message: `Corpus exceeds the ${MAX_EVALUATION_RULES} rule-id bound`,
        path: ['cases'],
      });
    }
    if (segmentKeys.size > MAX_EVALUATION_SEGMENTS) {
      context.addIssue({
        code: 'custom',
        message: `Corpus exceeds the ${MAX_EVALUATION_SEGMENTS} segment bound`,
        path: ['cases'],
      });
    }
  });

const countIntervalSchema = z
  .object({
    successes: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    estimate: z.number().min(0).max(1),
    lower: z.number().min(0).max(1),
    upper: z.number().min(0).max(1),
  })
  .strict();

const summaryPolicyPacksSchema = z
  .array(z.enum(EVALUATION_POLICY_PACKS))
  .max(EVALUATION_POLICY_PACKS.length)
  .refine((values) => new Set(values).size === values.length, {
    message: 'Summary policy packs must be unique',
  });

const tierMetricSchema = z
  .object({
    tier: z.enum(REVIEW_TIERS),
    precision: z.number().min(0).max(1),
    precisionInterval: countIntervalSchema,
    recall: z.number().min(0).max(1),
    recallInterval: countIntervalSchema,
    f1: z.number().min(0).max(1),
  })
  .strict();

const segmentDimensionsSchema = z.discriminatedUnion('scope', [
  z
    .object({
      scope: z.literal('cohort'),
      profile: z.enum(EVALUATION_PROFILES),
      configurationDigest: digestSchema,
      policyPacks: summaryPolicyPacksSchema,
      samplingStratum: z.enum(SAMPLING_STRATA),
      split: z.enum(EVALUATION_SPLITS),
    })
    .strict(),
  z
    .object({
      scope: z.literal('language'),
      profile: z.enum(EVALUATION_PROFILES),
      configurationDigest: digestSchema,
      policyPacks: summaryPolicyPacksSchema,
      samplingStratum: z.enum(SAMPLING_STRATA),
      split: z.enum(EVALUATION_SPLITS),
      language: z.enum(EVALUATION_LANGUAGES),
    })
    .strict(),
  z
    .object({
      scope: z.literal('change-size'),
      profile: z.enum(EVALUATION_PROFILES),
      configurationDigest: digestSchema,
      policyPacks: summaryPolicyPacksSchema,
      samplingStratum: z.enum(SAMPLING_STRATA),
      split: z.enum(EVALUATION_SPLITS),
      changeSize: z.enum(CHANGE_SIZE_BANDS),
    })
    .strict(),
]);

const segmentSchema = z
  .object({
    dimensions: segmentDimensionsSchema,
    caseCount: z.number().int().nonnegative(),
    comparisonStatus: z.enum(['sufficient', 'insufficient']),
    analyzableRate: countIntervalSchema,
    insufficientContextCount: z.number().int().nonnegative(),
    evaluatedCaseCount: z.number().int().nonnegative(),
    unavailableAnalysis: z
      .array(
        z
          .object({
            reason: z.enum(ANALYSIS_UNAVAILABLE_REASONS),
            cases: z.number().int().nonnegative(),
            total: z.number().int().nonnegative(),
            prevalence: countIntervalSchema,
          })
          .strict(),
      )
      .length(ANALYSIS_UNAVAILABLE_REASONS.length),
    limitationPrevalence: z
      .array(
        z
          .object({
            category: z.enum(LIMITATION_CATEGORIES),
            cases: z.number().int().nonnegative(),
            total: z.number().int().nonnegative(),
            prevalence: countIntervalSchema,
          })
          .strict(),
      )
      .length(LIMITATION_CATEGORIES.length),
    findingPrevalence: z
      .array(
        z
          .object({
            ruleId: boundedIdSchema,
            cases: z.number().int().nonnegative(),
            findings: z.number().int().nonnegative(),
            total: z.number().int().nonnegative(),
            prevalence: countIntervalSchema,
          })
          .strict(),
      )
      .max(MAX_EVALUATION_RULES),
    ruleCooccurrence: z
      .array(
        z
          .object({
            leftRuleId: boundedIdSchema,
            rightRuleId: boundedIdSchema,
            cases: z.number().int().nonnegative(),
            total: z.number().int().nonnegative(),
            prevalence: countIntervalSchema,
          })
          .strict(),
      )
      .max((MAX_EVALUATION_RULES * (MAX_EVALUATION_RULES - 1)) / 2),
    reviewerAgreement: z
      .object({
        pairCount: z.number().int().nonnegative(),
        exact: countIntervalSchema,
        withinOneTier: countIntervalSchema,
        quadraticWeightedKappa: z.number().min(-1).max(1).nullable(),
      })
      .strict(),
    classification: z
      .object({
        confusionMatrix: z
          .array(z.array(z.number().int().nonnegative()).length(4))
          .length(4),
        exact: countIntervalSchema,
        withinOneTier: countIntervalSchema,
        tierMetrics: z.array(tierMetricSchema).length(4),
        macroRecall: z.number().min(0).max(1),
        macroF1: z.number().min(0).max(1),
        combinedHighTierRecall: countIntervalSchema,
        underTriageOneTier: countIntervalSchema,
        underTriageTwoOrMoreTiers: countIntervalSchema,
        overTriageOneTier: countIntervalSchema,
        overTriageTwoOrMoreTiers: countIntervalSchema,
        spearmanRank: z.number().min(-1).max(1).nullable(),
      })
      .strict(),
  })
  .strict();

export const historyEvaluationSummarySchema = z
  .object({
    schemaVersion: z.literal(EVALUATION_SUMMARY_SCHEMA_VERSION),
    evaluatorVersion: z.literal(EVALUATOR_VERSION),
    provenance: z
      .object({
        analyzerCommit: objectIdSchema,
        configurationDigests: z
          .array(digestSchema)
          .min(1)
          .max(MAX_EVALUATION_CASES),
        corpusDigest: digestSchema,
        labelManifestDigest: digestSchema,
        attestationsAreCallerSupplied: z.literal(true),
      })
      .strict(),
    caseCount: z.number().int().positive().max(MAX_EVALUATION_CASES),
    segments: z.array(segmentSchema).min(1).max(MAX_EVALUATION_SEGMENTS),
  })
  .strict();

export type ReviewTier = (typeof REVIEW_TIERS)[number];
export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
export type EvaluationLabelRecord = z.infer<typeof evaluationLabelRecordSchema>;
export type HistoryEvaluationInput = z.infer<
  typeof historyEvaluationInputSchema
>;
export type HistoryEvaluationSummary = z.infer<
  typeof historyEvaluationSummarySchema
>;
export type EvaluationSegment = HistoryEvaluationSummary['segments'][number];

export const historyEvaluationInputJsonSchema = z.toJSONSchema(
  historyEvaluationInputSchema,
);
export const historyEvaluationSummaryJsonSchema = z.toJSONSchema(
  historyEvaluationSummarySchema,
);

export function parseHistoryEvaluationInput(
  input: unknown,
): HistoryEvaluationInput {
  return historyEvaluationInputSchema.parse(input);
}

export function parseHistoryEvaluationSummary(
  input: unknown,
): HistoryEvaluationSummary {
  return historyEvaluationSummarySchema.parse(input);
}
