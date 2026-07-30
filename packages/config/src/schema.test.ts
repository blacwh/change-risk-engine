import { describe, expect, it } from 'vitest';

import {
  changeRiskConfigJsonSchema,
  changeRiskConfigSchema,
  parseChangeRiskConfig,
} from './schema.js';

describe('change-risk configuration schema v1', () => {
  it('applies bounded deterministic defaults', () => {
    expect(parseChangeRiskConfig({ schemaVersion: 1 })).toEqual({
      schemaVersion: 1,
      policyPacks: [],
      ignorePatterns: [],
      analysis: {
        maxEntries: 100_000,
        maxFileBytes: 1_000_000,
        maxFiles: 10_000,
        maxGraphEdges: 1_000_000,
        maxTraversalDepth: 20,
      },
      thresholds: { moderate: 20, high: 50, critical: 80 },
      sensitiveAreas: [],
      rules: {},
    });
  });

  it('rejects unordered thresholds', () => {
    expect(() =>
      parseChangeRiskConfig({
        schemaVersion: 1,
        thresholds: { moderate: 50, high: 20, critical: 80 },
      }),
    ).toThrow(/Thresholds must increase/);
  });

  it('exports bounded policy-pack input metadata in the JSON Schema', () => {
    expect(changeRiskConfigJsonSchema).toMatchObject({
      properties: {
        policyPacks: {
          default: [],
          maxItems: 2,
          items: {
            enum: ['security-sensitive', 'strict-review'],
          },
        },
        thresholds: {
          default: { moderate: 20, high: 50, critical: 80 },
        },
      },
    });
  });

  it('normalizes rule settings while allowing rule-specific options', () => {
    expect(
      parseChangeRiskConfig({
        schemaVersion: 1,
        rules: { 'large-change': { options: { maxFiles: 12 } } },
      }).rules,
    ).toEqual({
      'large-change': { enabled: true, options: { maxFiles: 12 } },
    });
  });

  it('composes bounded built-in policy packs deterministically', () => {
    const input = {
      schemaVersion: 1,
      policyPacks: ['strict-review', 'security-sensitive'],
    } as const;
    const first = parseChangeRiskConfig(input);
    const second = parseChangeRiskConfig(input);
    expect(first).toEqual(second);
    expect(changeRiskConfigSchema.parse(input)).toEqual(first);
    const reversed = parseChangeRiskConfig({
      schemaVersion: 1,
      policyPacks: ['security-sensitive', 'strict-review'],
    });
    expect(reversed.policyPacks).toEqual([
      'security-sensitive',
      'strict-review',
    ]);
    expect(reversed.thresholds).toEqual(first.thresholds);
    expect(reversed.sensitiveAreas).toEqual(first.sensitiveAreas);
    expect(reversed.rules).toEqual(first.rules);
    expect(
      first.sensitiveAreas.every(
        ({ id, patterns }) =>
          id.length <= 200 &&
          patterns.length <= 100 &&
          patterns.every(
            (pattern) => pattern.length > 0 && pattern.length <= 1_000,
          ),
      ),
    ).toBe(true);
    expect(first).toMatchObject({
      policyPacks: ['strict-review', 'security-sensitive'],
      thresholds: { moderate: 15, high: 40, critical: 70 },
      sensitiveAreas: [
        { id: 'authentication' },
        { id: 'authorization' },
        { id: 'credentials-and-secrets' },
        { id: 'cryptography' },
      ],
      rules: {
        'high-fan-in': { enabled: true, options: { minFanIn: 3 } },
        'insufficient-coverage': {
          enabled: true,
          options: {
            maxLinePercentDrop: 0,
            minChangedLinePercent: 90,
            minLinePercent: 90,
          },
        },
        'large-change': {
          enabled: true,
          options: { maxFiles: 10, maxLines: 250 },
        },
        'multi-area-change': {
          enabled: true,
          options: { minAreas: 2 },
        },
      },
    });
  });

  it('applies explicit configuration after selected pack defaults', () => {
    expect(
      parseChangeRiskConfig({
        schemaVersion: 1,
        policyPacks: ['strict-review', 'security-sensitive'],
        thresholds: { moderate: 10, high: 30, critical: 50 },
        sensitiveAreas: [{ id: 'payments', patterns: ['src/payments/**'] }],
        rules: {
          'large-change': {
            enabled: false,
            weight: 7,
            options: { maxFiles: 5 },
          },
        },
      }),
    ).toMatchObject({
      thresholds: { moderate: 10, high: 30, critical: 50 },
      sensitiveAreas: [{ id: 'payments', patterns: ['src/payments/**'] }],
      rules: {
        'large-change': {
          enabled: false,
          weight: 7,
          options: { maxFiles: 5, maxLines: 250 },
        },
      },
    });
  });

  it('rejects unknown keys and unsupported versions', () => {
    expect(() => parseChangeRiskConfig({ schemaVersion: 2 })).toThrow();
    expect(() =>
      parseChangeRiskConfig({ schemaVersion: 1, surprise: true }),
    ).toThrow();
  });

  it('rejects unknown, duplicate, and over-limit policy-pack selections', () => {
    expect(() =>
      parseChangeRiskConfig({
        schemaVersion: 1,
        policyPacks: ['unknown'],
      }),
    ).toThrow();
    expect(() =>
      parseChangeRiskConfig({
        schemaVersion: 1,
        policyPacks: ['strict-review', 'strict-review'],
      }),
    ).toThrow(/Policy pack ids must be unique/);
    expect(() =>
      parseChangeRiskConfig({
        schemaVersion: 1,
        policyPacks: [
          'security-sensitive',
          'strict-review',
          'security-sensitive',
        ],
      }),
    ).toThrow();
  });

  it('rejects duplicate sensitive-area ids', () => {
    expect(() =>
      parseChangeRiskConfig({
        schemaVersion: 1,
        sensitiveAreas: [
          { id: 'auth', patterns: ['src/auth/**'] },
          { id: 'auth', patterns: ['packages/auth/**'] },
        ],
      }),
    ).toThrow(/Sensitive area ids must be unique/);
  });

  it('bounds ignore pattern count and length', () => {
    expect(() =>
      parseChangeRiskConfig({
        schemaVersion: 1,
        ignorePatterns: ['x'.repeat(1_001)],
      }),
    ).toThrow();
  });
});
