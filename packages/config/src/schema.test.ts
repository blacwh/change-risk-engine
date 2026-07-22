import { describe, expect, it } from 'vitest';

import { parseChangeRiskConfig } from './schema.js';

describe('change-risk configuration schema v1', () => {
  it('applies bounded deterministic defaults', () => {
    expect(parseChangeRiskConfig({ schemaVersion: 1 })).toEqual({
      schemaVersion: 1,
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

  it('rejects unknown keys and unsupported versions', () => {
    expect(() => parseChangeRiskConfig({ schemaVersion: 2 })).toThrow();
    expect(() =>
      parseChangeRiskConfig({ schemaVersion: 1, surprise: true }),
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
});
