import type { ChangedFile } from '@change-risk/core';
import { describe, expect, it } from 'vitest';

import { evaluateRules, type RiskRule, type RuleContext } from './engine.js';
import {
  DEFAULT_RULES,
  largeChangeRule,
  multiAreaRule,
  sensitivePathRule,
} from './rules.js';

function file(
  path: string,
  categories: ChangedFile['categories'],
  lines = 1,
): ChangedFile {
  return {
    path,
    status: 'modified',
    additions: lines,
    deletions: 0,
    binary: false,
    categories,
  };
}

const context: RuleContext = {
  changedFiles: [
    file('package.json', ['dependency']),
    file('src/auth/login.ts', ['source'], 300),
    file('migrations/001.sql', ['migration']),
    file('terraform/main.tf', ['infrastructure']),
  ],
  sensitiveAreas: [{ id: 'authentication', patterns: ['src/auth/**'] }],
};

describe('rule engine', () => {
  it('assigns stable evidence links and configurable weights in rule-id order', () => {
    const result = evaluateRules(context, DEFAULT_RULES, {
      'large-change': { weight: 30, options: { maxFiles: 2, maxLines: 100 } },
    });
    expect(result.findings.map(({ ruleId }) => ruleId)).toEqual([
      'dependency-manifest',
      'infrastructure',
      'large-change',
      'migration',
      'multi-area-change',
      'sensitive-path',
    ]);
    const large = result.findings.find(
      ({ ruleId }) => ruleId === 'large-change',
    );
    expect(large).toMatchObject({
      id: 'large-change:1:finding',
      weight: 30,
      evidenceIds: ['large-change:1:evidence'],
    });
    expect(
      result.evidence.find(({ id }) => id === 'large-change:1:evidence'),
    ).toMatchObject({
      data: { fileCount: 4, lineCount: 303, maxFiles: 2, maxLines: 100 },
    });
  });

  it('disables configured rules without suppressing other findings', () => {
    const result = evaluateRules(context, DEFAULT_RULES, {
      'dependency-manifest': { enabled: false },
      'large-change': { enabled: false },
    });
    expect(result.findings.map(({ ruleId }) => ruleId)).not.toContain(
      'dependency-manifest',
    );
    expect(result.findings.map(({ ruleId }) => ruleId)).toContain('migration');
  });

  it('rejects duplicate rule ids and non-finite weights', () => {
    const duplicate: RiskRule = { ...largeChangeRule };
    expect(() => evaluateRules(context, [largeChangeRule, duplicate])).toThrow(
      /unique/,
    );
    expect(() =>
      evaluateRules(context, [largeChangeRule], {
        'large-change': { weight: Infinity },
      }),
    ).toThrow(/non-finite/);
  });

  it('rejects ambiguous or unbounded sensitive-area configuration', () => {
    expect(() =>
      evaluateRules(
        {
          changedFiles: [],
          sensitiveAreas: [
            { id: 'auth', patterns: ['one/**'] },
            { id: 'auth', patterns: ['two/**'] },
          ],
        },
        DEFAULT_RULES,
      ),
    ).toThrow(/unique/);
  });
});

describe('change-shape rules', () => {
  it('does not flag changes at or below configured size limits', () => {
    const result = evaluateRules(
      { changedFiles: [file('src/a.ts', ['source'], 10)], sensitiveAreas: [] },
      [largeChangeRule],
      { 'large-change': { options: { maxFiles: 1, maxLines: 10 } } },
    );
    expect(result.findings).toEqual([]);
  });

  it('reports all deterministic top-level areas', () => {
    const result = evaluateRules(context, [multiAreaRule], {
      'multi-area-change': { options: { minAreas: 3 } },
    });
    expect(result.evidence[0]?.data).toEqual({
      areas: ['(root)', 'migrations', 'src', 'terraform'],
      minAreas: 3,
    });
  });

  it('rejects invalid rule-specific thresholds', () => {
    expect(() =>
      evaluateRules(context, [largeChangeRule], {
        'large-change': { options: { maxFiles: 0 } },
      }),
    ).toThrow(/maxFiles/);
  });
});

describe('path and category rules', () => {
  it('emits one sensitive finding per matching configured area', () => {
    const result = evaluateRules(
      {
        changedFiles: [file('src/auth/login.ts', ['source'])],
        sensitiveAreas: [
          { id: 'source-wide', patterns: ['src/**'] },
          { id: 'authentication', patterns: ['src/auth/*.ts'] },
          { id: 'billing', patterns: ['src/billing/**'] },
        ],
      },
      [sensitivePathRule],
    );
    expect(result.findings.map(({ title }) => title)).toEqual([
      'Sensitive area changed: authentication',
      'Sensitive area changed: source-wide',
    ]);
  });

  it('emits no default findings for an empty change', () => {
    expect(
      evaluateRules({ changedFiles: [], sensitiveAreas: [] }, DEFAULT_RULES),
    ).toEqual({ evidence: [], findings: [] });
  });
});
