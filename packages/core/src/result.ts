import { z } from 'zod';

export const ANALYSIS_RESULT_SCHEMA_VERSION = 1 as const;

const changedFileSchema = z
  .object({
    path: z.string().min(1),
    previousPath: z.string().min(1).optional(),
    status: z.enum(['added', 'modified', 'deleted', 'renamed']),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    binary: z.boolean(),
    categories: z.array(z.string().min(1)),
  })
  .strict();

const evidenceSchema = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    summary: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
    sourcePaths: z.array(z.string().min(1)).optional(),
  })
  .strict();

const findingSchema = z
  .object({
    id: z.string().min(1),
    ruleId: z.string().min(1),
    title: z.string().min(1),
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
    weight: z.number().finite(),
    explanation: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).min(1),
    affectedPaths: z.array(z.string().min(1)),
    remediation: z.string().min(1).optional(),
  })
  .strict();

export const analysisResultSchema = z
  .object({
    schemaVersion: z.literal(ANALYSIS_RESULT_SCHEMA_VERSION),
    revisions: z
      .object({ base: z.string().min(1), head: z.string().min(1) })
      .strict(),
    changedFiles: z.array(changedFileSchema),
    evidence: z.array(evidenceSchema),
    findings: z.array(findingSchema),
    score: z.number().finite().nonnegative(),
    classification: z.enum(['low', 'moderate', 'high', 'critical']),
    scoreContributions: z.array(
      z
        .object({
          ruleId: z.string().min(1),
          findingIds: z.array(z.string().min(1)).min(1),
          weight: z.number().finite(),
        })
        .strict(),
    ),
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((result, context) => {
    const evidenceIds = new Set(result.evidence.map(({ id }) => id));
    const findingIds = new Set(result.findings.map(({ id }) => id));

    if (evidenceIds.size !== result.evidence.length) {
      context.addIssue({
        code: 'custom',
        message: 'Evidence ids must be unique',
        path: ['evidence'],
      });
    }
    if (findingIds.size !== result.findings.length) {
      context.addIssue({
        code: 'custom',
        message: 'Finding ids must be unique',
        path: ['findings'],
      });
    }

    for (const [index, finding] of result.findings.entries()) {
      for (const evidenceId of finding.evidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
          context.addIssue({
            code: 'custom',
            message: `Unknown evidence id: ${evidenceId}`,
            path: ['findings', index, 'evidenceIds'],
          });
        }
      }
    }

    for (const [index, contribution] of result.scoreContributions.entries()) {
      for (const findingId of contribution.findingIds) {
        if (!findingIds.has(findingId)) {
          context.addIssue({
            code: 'custom',
            message: `Unknown finding id: ${findingId}`,
            path: ['scoreContributions', index, 'findingIds'],
          });
        } else if (
          result.findings.find(({ id }) => id === findingId)?.ruleId !==
          contribution.ruleId
        ) {
          context.addIssue({
            code: 'custom',
            message: `Finding ${findingId} belongs to a different rule`,
            path: ['scoreContributions', index, 'findingIds'],
          });
        }
      }
    }

    const contributionTotal = result.scoreContributions.reduce(
      (total, contribution) => total + contribution.weight,
      0,
    );
    if (Math.abs(contributionTotal - result.score) > Number.EPSILON) {
      context.addIssue({
        code: 'custom',
        message: 'Score must equal the sum of visible contributions',
        path: ['score'],
      });
    }
  });

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type ChangedFile = z.infer<typeof changedFileSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Finding = z.infer<typeof findingSchema>;

export const analysisResultJsonSchema = z.toJSONSchema(analysisResultSchema);

export function parseAnalysisResult(input: unknown): AnalysisResult {
  return analysisResultSchema.parse(input);
}
