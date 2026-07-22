import { z } from 'zod';

export const CONFIG_SCHEMA_VERSION = 1 as const;

const thresholdsSchema = z
  .object({
    moderate: z.number().finite().nonnegative(),
    high: z.number().finite().nonnegative(),
    critical: z.number().finite().nonnegative(),
  })
  .strict()
  .refine(
    ({ moderate, high, critical }) => moderate < high && high < critical,
    { message: 'Thresholds must increase from moderate to high to critical' },
  );

export const changeRiskConfigSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    ignorePatterns: z.array(z.string().min(1)).default([]),
    analysis: z
      .object({
        maxEntries: z.number().int().positive().max(1_000_000).default(100_000),
        maxFileBytes: z
          .number()
          .int()
          .positive()
          .max(100_000_000)
          .default(1_000_000),
        maxFiles: z.number().int().positive().max(100_000).default(10_000),
        maxGraphEdges: z
          .number()
          .int()
          .positive()
          .max(1_000_000)
          .default(1_000_000),
        maxTraversalDepth: z.number().int().positive().max(100).default(20),
      })
      .strict()
      .default({
        maxEntries: 100_000,
        maxFileBytes: 1_000_000,
        maxFiles: 10_000,
        maxGraphEdges: 1_000_000,
        maxTraversalDepth: 20,
      }),
    thresholds: thresholdsSchema.default({
      moderate: 20,
      high: 50,
      critical: 80,
    }),
    sensitiveAreas: z
      .array(
        z
          .object({
            id: z.string().min(1),
            patterns: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .default([]),
    rules: z
      .record(
        z.string().min(1),
        z
          .object({
            enabled: z.boolean().default(true),
            weight: z.number().finite(),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();

export type ChangeRiskConfig = z.infer<typeof changeRiskConfigSchema>;

export const changeRiskConfigJsonSchema = z.toJSONSchema(
  changeRiskConfigSchema,
);

export function parseChangeRiskConfig(input: unknown): ChangeRiskConfig {
  return changeRiskConfigSchema.parse(input);
}
