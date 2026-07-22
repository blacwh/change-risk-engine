import type { ChangedFile } from '@change-risk/core';
import { DirectedDependencyGraph } from '@change-risk/dependency-graph';
import { describe, expect, it } from 'vitest';

import { evaluateRules, type RiskRule, type RuleContext } from './engine.js';
import {
  DEFAULT_RULES,
  highFanInRule,
  largeChangeRule,
  missingRelatedTestsRule,
  multiAreaRule,
  publicExportRule,
  sensitivePathRule,
  testsAddedRule,
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

describe('dependency and public-surface rules', () => {
  const dependencyGraph = new DirectedDependencyGraph({
    nodes: [
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
      'src/d.ts',
      'src/shared.ts',
      'src/ui.ts',
    ],
    edges: [
      { from: 'src/a.ts', to: 'src/shared.ts' },
      { from: 'src/b.ts', to: 'src/shared.ts' },
      { from: 'src/c.ts', to: 'src/shared.ts' },
      { from: 'src/d.ts', to: 'src/shared.ts' },
      { from: 'src/ui.ts', to: 'src/a.ts' },
    ],
  });

  it('reports deterministic blast-radius evidence for changed central modules', () => {
    const result = evaluateRules(
      {
        changedFiles: [file('src/shared.ts', ['source'])],
        dependencyGraph,
        sensitiveAreas: [],
      },
      [highFanInRule],
      { 'high-fan-in': { options: { minFanIn: 4, maxTraversalDepth: 2 } } },
    );
    expect(result.evidence[0]).toMatchObject({
      data: {
        path: 'src/shared.ts',
        fanIn: 4,
        fanOut: 0,
        minFanIn: 4,
        directDependents: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'],
        transitiveDependents: [
          { path: 'src/a.ts', distance: 1 },
          { path: 'src/b.ts', distance: 1 },
          { path: 'src/c.ts', distance: 1 },
          { path: 'src/d.ts', distance: 1 },
          { path: 'src/ui.ts', distance: 2 },
        ],
        truncated: false,
      },
    });
    expect(result.findings[0]?.affectedPaths).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
      'src/d.ts',
      'src/shared.ts',
      'src/ui.ts',
    ]);
  });

  it('does not report graph findings without graph evidence', () => {
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/shared.ts', ['source'])],
          sensitiveAreas: [],
        },
        [highFanInRule],
      ),
    ).toEqual({ evidence: [], findings: [] });
  });

  it('reports sorted public-export evidence and raises severity for removals', () => {
    const result = evaluateRules(
      {
        changedFiles: [file('src/public.ts', ['source'])],
        publicExportChanges: [
          { path: 'src/public.ts', exportName: 'zeta', change: 'added' },
          { path: 'src/public.ts', exportName: 'alpha', change: 'removed' },
        ],
        sensitiveAreas: [],
      },
      [publicExportRule],
    );
    expect(result.evidence[0]?.data).toEqual({
      changes: [
        { path: 'src/public.ts', exportName: 'alpha', change: 'removed' },
        { path: 'src/public.ts', exportName: 'zeta', change: 'added' },
      ],
    });
    expect(result.findings[0]).toMatchObject({
      severity: 'high',
      affectedPaths: ['src/public.ts'],
    });
  });

  it('rejects invalid graph options and incomplete public-export evidence', () => {
    expect(() =>
      evaluateRules(
        { changedFiles: [], dependencyGraph, sensitiveAreas: [] },
        [highFanInRule],
        { 'high-fan-in': { options: { maxTraversalDepth: 101 } } },
      ),
    ).toThrow(/maxTraversalDepth/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [],
          publicExportChanges: [
            { path: '', exportName: 'value', change: 'modified' },
          ],
          sensitiveAreas: [],
        },
        [publicExportRule],
      ),
    ).toThrow(/invalid fields/);
  });
});

describe('test-evidence rules', () => {
  const testContext: RuleContext = {
    changedFiles: [
      file('src/auth.ts', ['source']),
      { ...file('test/auth.test.ts', ['source', 'test']), status: 'added' },
      file('src/billing.ts', ['source']),
    ],
    sensitiveAreas: [],
    testRelationships: [
      { sourcePath: 'src/billing.ts', testPaths: ['test/billing.test.ts'] },
      { sourcePath: 'src/auth.ts', testPaths: ['test/auth.test.ts'] },
    ],
  };

  it('finds changed sources whose explicitly related tests did not change', () => {
    const result = evaluateRules(testContext, [missingRelatedTestsRule]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      title: 'No related test changed: src/billing.ts',
      affectedPaths: ['src/billing.ts', 'test/billing.test.ts'],
      weight: 20,
    });
  });

  it('mitigates only tests added for changed related source files', () => {
    const result = evaluateRules(testContext, [testsAddedRule]);
    expect(result.findings[0]).toMatchObject({
      title: 'Related tests added',
      severity: 'info',
      weight: -10,
    });
    expect(result.evidence[0]?.data).toEqual({
      sourcePaths: ['src/auth.ts'],
      testPaths: ['test/auth.test.ts'],
    });
  });

  it('does not treat deleted or unrelated tests as coverage evidence', () => {
    const result = evaluateRules(
      {
        changedFiles: [
          file('src/auth.ts', ['source']),
          {
            ...file('test/auth.test.ts', ['source', 'test']),
            status: 'deleted',
          },
          {
            ...file('test/unrelated.test.ts', ['source', 'test']),
            status: 'added',
          },
        ],
        sensitiveAreas: [],
        testRelationships: [
          { sourcePath: 'src/auth.ts', testPaths: ['test/auth.test.ts'] },
        ],
      },
      [missingRelatedTestsRule, testsAddedRule],
    );
    expect(result.findings.map(({ ruleId }) => ruleId)).toEqual([
      'missing-related-tests',
    ]);
  });

  it('rejects duplicate or unbounded test relationships', () => {
    expect(() =>
      evaluateRules(
        {
          changedFiles: [],
          sensitiveAreas: [],
          testRelationships: [
            { sourcePath: 'src/a.ts', testPaths: [] },
            { sourcePath: 'src/a.ts', testPaths: ['test/a.test.ts'] },
          ],
        },
        [missingRelatedTestsRule],
      ),
    ).toThrow(/source paths must be unique/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [],
          sensitiveAreas: [],
          testRelationships: [
            {
              sourcePath: 'src/a.ts',
              testPaths: ['test/a.test.ts', 'test/a.test.ts'],
            },
          ],
        },
        [missingRelatedTestsRule],
      ),
    ).toThrow(/test paths must be unique/);
  });
});
