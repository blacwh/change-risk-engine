import { z } from 'zod';

import { composePolicyPacks, POLICY_PACK_IDS } from './policy-packs.js';

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

const changeRiskConfigInputSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    policyPacks: z
      .array(z.enum(POLICY_PACK_IDS))
      .max(POLICY_PACK_IDS.length)
      .default([]),
    ignorePatterns: z
      .array(z.string().min(1).max(1_000))
      .max(1_000)
      .default([]),
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
    thresholds: thresholdsSchema.optional().meta({
      default: { moderate: 20, high: 50, critical: 80 },
    }),
    sensitiveAreas: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            patterns: z.array(z.string().min(1).max(1_000)).min(1).max(100),
          })
          .strict(),
      )
      .optional()
      .meta({ default: [] }),
    rules: z
      .record(
        z.string().min(1),
        z
          .object({
            enabled: z.boolean().optional().meta({ default: true }),
            options: z
              .record(z.string(), z.unknown())
              .optional()
              .meta({ default: {} }),
            weight: z.number().finite().optional(),
          })
          .strict(),
      )
      .optional()
      .meta({ default: {} }),
  })
  .strict()
  .superRefine((config, context) => {
    if (new Set(config.policyPacks).size !== config.policyPacks.length) {
      context.addIssue({
        code: 'custom',
        message: 'Policy pack ids must be unique',
        path: ['policyPacks'],
      });
    }
    const ids = (config.sensitiveAreas ?? []).map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Sensitive area ids must be unique',
        path: ['sensitiveAreas'],
      });
    }
  });

type ChangeRiskConfigInput = z.infer<typeof changeRiskConfigInputSchema>;

function resolveRules(
  packedRules: ReturnType<typeof composePolicyPacks>['rules'],
  configuredRules: NonNullable<ChangeRiskConfigInput['rules']>,
): Record<
  string,
  {
    enabled: boolean;
    options: Record<string, unknown>;
    weight?: number;
  }
> {
  const resolved: Record<
    string,
    {
      enabled: boolean;
      options: Record<string, unknown>;
      weight?: number;
    }
  > = {};
  const ids = [
    ...new Set([...Object.keys(packedRules), ...Object.keys(configuredRules)]),
  ].sort();
  for (const id of ids) {
    const packed = packedRules[id];
    const configured = configuredRules[id];
    const weight = configured?.weight ?? packed?.weight;
    resolved[id] = {
      enabled: configured?.enabled ?? packed?.enabled ?? true,
      options: {
        ...(packed?.options ?? {}),
        ...(configured?.options ?? {}),
      },
      ...(weight === undefined ? {} : { weight }),
    };
  }
  return resolved;
}

function resolveConfig(input: ChangeRiskConfigInput) {
  const packed = composePolicyPacks(input.policyPacks);
  return {
    schemaVersion: input.schemaVersion,
    policyPacks: input.policyPacks,
    ignorePatterns: input.ignorePatterns,
    analysis: input.analysis,
    thresholds: input.thresholds ??
      packed.thresholds ?? {
        moderate: 20,
        high: 50,
        critical: 80,
      },
    sensitiveAreas:
      input.sensitiveAreas ??
      packed.sensitiveAreas.map((area) => ({
        id: area.id,
        patterns: [...area.patterns],
      })),
    rules: resolveRules(packed.rules, input.rules ?? {}),
  };
}

export const changeRiskConfigSchema =
  changeRiskConfigInputSchema.transform(resolveConfig);

export type ChangeRiskConfig = z.infer<typeof changeRiskConfigSchema>;

export const changeRiskConfigJsonSchema = z.toJSONSchema(
  changeRiskConfigInputSchema,
);

export function parseChangeRiskConfig(input: unknown): ChangeRiskConfig {
  return changeRiskConfigSchema.parse(input);
}
