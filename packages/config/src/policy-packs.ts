export const POLICY_PACK_IDS = Object.freeze([
  'security-sensitive',
  'strict-review',
] as const);

export type PolicyPackId = (typeof POLICY_PACK_IDS)[number];

type PolicyPackRuleSetting = {
  enabled?: boolean;
  options?: Readonly<Record<string, unknown>>;
  weight?: number;
};

type PolicyPackDefinition = {
  thresholds?: {
    moderate: number;
    high: number;
    critical: number;
  };
  sensitiveAreas?: readonly {
    id: string;
    patterns: readonly string[];
  }[];
  rules?: Readonly<Record<string, PolicyPackRuleSetting>>;
};

export type ComposedPolicyPackDefaults = {
  thresholds?: {
    moderate: number;
    high: number;
    critical: number;
  };
  sensitiveAreas: readonly {
    id: string;
    patterns: readonly string[];
  }[];
  rules: Readonly<Record<string, PolicyPackRuleSetting>>;
};

const POLICY_PACKS: Readonly<Record<PolicyPackId, PolicyPackDefinition>> = {
  'security-sensitive': {
    sensitiveAreas: [
      {
        id: 'authentication',
        patterns: [
          '**/auth.*',
          '**/auth/**',
          '**/authentication.*',
          '**/authentication/**',
          'auth.*',
          'auth/**',
          'authentication.*',
          'authentication/**',
        ],
      },
      {
        id: 'authorization',
        patterns: [
          '**/authorization.*',
          '**/authorization/**',
          '**/permissions.*',
          '**/permissions/**',
          '**/rbac.*',
          '**/rbac/**',
          'authorization.*',
          'authorization/**',
          'permissions.*',
          'permissions/**',
          'rbac.*',
          'rbac/**',
        ],
      },
      {
        id: 'cryptography',
        patterns: [
          '**/crypto.*',
          '**/crypto/**',
          '**/cryptography.*',
          '**/cryptography/**',
          'crypto.*',
          'crypto/**',
          'cryptography.*',
          'cryptography/**',
        ],
      },
      {
        id: 'credentials-and-secrets',
        patterns: [
          '**/credentials.*',
          '**/credentials/**',
          '**/secrets.*',
          '**/secrets/**',
          'credentials.*',
          'credentials/**',
          'secrets.*',
          'secrets/**',
        ],
      },
    ],
  },
  'strict-review': {
    thresholds: { moderate: 15, high: 40, critical: 70 },
    rules: {
      'high-fan-in': { options: { minFanIn: 3 } },
      'insufficient-coverage': {
        options: {
          maxLinePercentDrop: 0,
          minChangedLinePercent: 90,
          minLinePercent: 90,
        },
      },
      'large-change': { options: { maxFiles: 10, maxLines: 250 } },
      'multi-area-change': { options: { minAreas: 2 } },
    },
  },
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function mergeRuleSettings(
  current: Readonly<Record<string, PolicyPackRuleSetting>>,
  next: Readonly<Record<string, PolicyPackRuleSetting>>,
): Readonly<Record<string, PolicyPackRuleSetting>> {
  const merged: Record<string, PolicyPackRuleSetting> = {};
  const ids = [
    ...new Set([...Object.keys(current), ...Object.keys(next)]),
  ].sort(compareText);
  for (const id of ids) {
    const before = current[id];
    const after = next[id];
    const weight = after?.weight ?? before?.weight;
    merged[id] = {
      enabled: after?.enabled ?? before?.enabled ?? true,
      options: {
        ...(before?.options ?? {}),
        ...(after?.options ?? {}),
      },
      ...(weight === undefined ? {} : { weight }),
    };
  }
  return merged;
}

export function composePolicyPacks(
  ids: readonly PolicyPackId[],
): ComposedPolicyPackDefaults {
  let thresholds: ComposedPolicyPackDefaults['thresholds'];
  const sensitiveAreas = new Map<
    string,
    { id: string; patterns: readonly string[] }
  >();
  let rules: Readonly<Record<string, PolicyPackRuleSetting>> = {};
  for (const id of ids) {
    const pack = POLICY_PACKS[id];
    if (pack.thresholds !== undefined) {
      thresholds = { ...pack.thresholds };
    }
    for (const area of pack.sensitiveAreas ?? []) {
      sensitiveAreas.set(area.id, {
        id: area.id,
        patterns: [...area.patterns],
      });
    }
    rules = mergeRuleSettings(rules, pack.rules ?? {});
  }
  return {
    ...(thresholds === undefined ? {} : { thresholds }),
    sensitiveAreas: [...sensitiveAreas.values()].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    rules,
  };
}
