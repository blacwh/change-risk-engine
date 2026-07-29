import type { ChangedFile } from '@change-risk/core';
import { DirectedDependencyGraph } from '@change-risk/dependency-graph';
import { describe, expect, it } from 'vitest';

import { evaluateRules, type RiskRule, type RuleContext } from './engine.js';
import {
  DEFAULT_RULES,
  highFanInRule,
  insufficientCoverageRule,
  largeChangeRule,
  missingOwnerRule,
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
    expect(() =>
      evaluateRules(context, [largeChangeRule], {
        typo: { enabled: false },
      }),
    ).toThrow(/Unknown rule setting: typo/);
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

describe('ownership rule', () => {
  it('reports one deterministic finding for all unowned changed paths', () => {
    const result = evaluateRules(
      {
        changedFiles: [
          file('src/owned.ts', ['source']),
          file('src/z-unowned.ts', ['source']),
          file('docs/a-unowned.md', ['documentation']),
        ],
        ownershipRelationships: [
          { path: 'src/z-unowned.ts', owners: [] },
          { path: 'src/owned.ts', owners: ['@owner'] },
          { path: 'docs/a-unowned.md', owners: [] },
        ],
        sensitiveAreas: [],
      },
      [missingOwnerRule],
      { 'missing-owner': { weight: 7 } },
    );
    expect(result.findings[0]).toMatchObject({
      ruleId: 'missing-owner',
      weight: 7,
      affectedPaths: ['docs/a-unowned.md', 'src/z-unowned.ts'],
    });
    expect(result.evidence[0]?.data).toEqual({
      fileCount: 2,
      unownedPaths: ['docs/a-unowned.md', 'src/z-unowned.ts'],
    });
  });

  it('does not infer missing ownership from absent or complete evidence', () => {
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/a.ts', ['source'])],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
      ),
    ).toEqual({ evidence: [], findings: [] });
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/a.ts', ['source'])],
          ownershipRelationships: [{ path: 'src/a.ts', owners: ['@owner'] }],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
      ),
    ).toEqual({ evidence: [], findings: [] });
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/a.ts', ['source'])],
          ownershipRelationships: [{ path: 'src/a.ts', owners: [] }],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
        { 'missing-owner': { enabled: false } },
      ),
    ).toEqual({ evidence: [], findings: [] });
  });

  it('rejects partial, duplicate, unbounded, and unrelated relationships', () => {
    const changedFiles = [
      file('src/a.ts', ['source']),
      file('src/b.ts', ['source']),
    ];
    expect(() =>
      evaluateRules(
        {
          changedFiles,
          ownershipRelationships: [{ path: 'src/a.ts', owners: [] }],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
      ),
    ).toThrow(/cover every changed path/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          ownershipRelationships: [
            { path: 'src/a.ts', owners: ['@owner', '@owner'] },
          ],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
      ),
    ).toThrow(/owners must be unique/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          ownershipRelationships: [
            {
              path: 'src/a.ts',
              owners: Array.from(
                { length: 101 },
                (_, index) => `@owner-${index}`,
              ),
            },
          ],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
      ),
    ).toThrow(/invalid fields/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          ownershipRelationships: [
            { path: 'src/other.ts', owners: ['@owner'] },
          ],
          sensitiveAreas: [],
        },
        [missingOwnerRule],
      ),
    ).toThrow(/unchanged path/);
  });
});

describe('coverage rule', () => {
  const coverageFiles: ChangedFile[] = [
    file('src/at-threshold.ts', ['source']),
    file('src/below.ts', ['source']),
    file('src/missing.ts', ['source']),
    file('src/no-lines.ts', ['source']),
    file('src/generated.ts', ['source', 'generated']),
    file('src/a.test.ts', ['source', 'test']),
    { ...file('src/deleted.ts', ['source']), status: 'deleted' },
  ];

  it('aggregates missing, unmeasurable, and below-threshold coverage', () => {
    const result = evaluateRules(
      {
        changedFiles: coverageFiles,
        coverageRelationships: [
          { path: 'src/no-lines.ts', linesFound: 0, linesHit: 0 },
          { path: 'src/missing.ts', linesFound: null, linesHit: null },
          { path: 'src/below.ts', linesFound: 2, linesHit: 1 },
          { path: 'src/at-threshold.ts', linesFound: 10, linesHit: 8 },
        ],
        sensitiveAreas: [],
      },
      [insufficientCoverageRule],
      {
        'insufficient-coverage': {
          options: { minLinePercent: 80 },
          weight: 12,
        },
      },
    );
    expect(result.findings[0]).toMatchObject({
      ruleId: 'insufficient-coverage',
      weight: 12,
      affectedPaths: ['src/below.ts', 'src/missing.ts', 'src/no-lines.ts'],
    });
    expect(result.evidence[0]?.data).toEqual({
      maxLinePercentDrop: 0,
      minChangedLinePercent: 80,
      minLinePercent: 80,
      paths: [
        {
          path: 'src/below.ts',
          linesFound: 2,
          linesHit: 1,
          linePercent: 50,
          reason: 'below-threshold',
          reasons: ['below-threshold'],
        },
        {
          path: 'src/missing.ts',
          linesFound: null,
          linesHit: null,
          linePercent: null,
          reason: 'missing-record',
          reasons: ['missing-record'],
        },
        {
          path: 'src/no-lines.ts',
          linesFound: 0,
          linesHit: 0,
          linePercent: null,
          reason: 'no-measurable-lines',
          reasons: ['no-measurable-lines'],
        },
      ],
    });
  });

  it('combines baseline regression with current coverage concerns', () => {
    const result = evaluateRules(
      {
        changedFiles: [
          file('src/regressed.ts', ['source']),
          file('src/improved.ts', ['source']),
          file('src/no-baseline.ts', ['source']),
        ],
        coverageRelationships: [
          {
            path: 'src/regressed.ts',
            linesFound: 10,
            linesHit: 8,
            baselinePath: 'src/old-name.ts',
            baselineLinesFound: 10,
            baselineLinesHit: 9,
          },
          {
            path: 'src/improved.ts',
            linesFound: 10,
            linesHit: 9,
            baselinePath: 'src/improved.ts',
            baselineLinesFound: 10,
            baselineLinesHit: 8,
          },
          {
            path: 'src/no-baseline.ts',
            linesFound: 10,
            linesHit: 10,
            baselinePath: 'src/no-baseline.ts',
            baselineLinesFound: null,
            baselineLinesHit: null,
          },
        ],
        sensitiveAreas: [],
      },
      [insufficientCoverageRule],
      {
        'insufficient-coverage': {
          options: { minLinePercent: 70, maxLinePercentDrop: 5 },
          weight: 13,
        },
      },
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      weight: 13,
      affectedPaths: ['src/regressed.ts'],
    });
    expect(result.evidence[0]?.data).toMatchObject({
      maxLinePercentDrop: 5,
      paths: [
        {
          path: 'src/regressed.ts',
          linesFound: 10,
          linesHit: 8,
          linePercent: 80,
          baselinePath: 'src/old-name.ts',
          baselineLinesFound: 10,
          baselineLinesHit: 9,
          baselineLinePercent: 90,
          linePercentDelta: -10,
          reason: 'coverage-regression',
          reasons: ['coverage-regression'],
        },
      ],
    });
  });

  it('combines whole-file and changed-line concerns into one finding weight', () => {
    const result = evaluateRules(
      {
        changedFiles: [
          file('src/changed-low.ts', ['source']),
          file('src/whole-low.ts', ['source']),
          file('src/unmeasurable.ts', ['source']),
          file('src/pure-delete.ts', ['source']),
        ],
        coverageRelationships: [
          {
            path: 'src/changed-low.ts',
            linesFound: 10,
            linesHit: 9,
            changedLineCount: 2,
            changedLinesFound: 2,
            changedLinesHit: 0,
          },
          {
            path: 'src/whole-low.ts',
            linesFound: 2,
            linesHit: 1,
            changedLineCount: 1,
            changedLinesFound: 1,
            changedLinesHit: 1,
          },
          {
            path: 'src/unmeasurable.ts',
            linesFound: 10,
            linesHit: 10,
            changedLineCount: 2,
            changedLinesFound: 0,
            changedLinesHit: 0,
          },
          {
            path: 'src/pure-delete.ts',
            linesFound: 10,
            linesHit: 10,
            changedLineCount: 0,
            changedLinesFound: 0,
            changedLinesHit: 0,
          },
        ],
        sensitiveAreas: [],
      },
      [insufficientCoverageRule],
      {
        'insufficient-coverage': {
          options: {
            minLinePercent: 80,
            minChangedLinePercent: 90,
          },
          weight: 17,
        },
      },
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      weight: 17,
      affectedPaths: [
        'src/changed-low.ts',
        'src/unmeasurable.ts',
        'src/whole-low.ts',
      ],
    });
    expect(result.evidence[0]?.data).toMatchObject({
      minChangedLinePercent: 90,
      minLinePercent: 80,
      paths: [
        expect.objectContaining({
          path: 'src/changed-low.ts',
          linePercent: 90,
          changedLinePercent: 0,
          reasons: ['below-changed-line-threshold'],
        }),
        expect.objectContaining({
          path: 'src/unmeasurable.ts',
          linePercent: 100,
          changedLinePercent: null,
          reasons: ['no-measurable-changed-lines'],
        }),
        expect.objectContaining({
          path: 'src/whole-low.ts',
          linePercent: 50,
          changedLinePercent: 100,
          reasons: ['below-threshold'],
        }),
      ],
    });
  });

  it('does not infer coverage without evidence or below-threshold paths', () => {
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/a.ts', ['source'])],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toEqual({ evidence: [], findings: [] });
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/a.ts', ['source'])],
          coverageRelationships: [
            { path: 'src/a.ts', linesFound: 10, linesHit: 9 },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toEqual({ evidence: [], findings: [] });
    expect(
      evaluateRules(
        {
          changedFiles: [file('src/a.ts', ['source'])],
          coverageRelationships: [
            { path: 'src/a.ts', linesFound: null, linesHit: null },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
        { 'insufficient-coverage': { enabled: false } },
      ),
    ).toEqual({ evidence: [], findings: [] });
  });

  it('validates threshold options and complete eligible relationships', () => {
    const changedFiles = [
      file('src/a.ts', ['source']),
      file('src/b.ts', ['source']),
    ];
    expect(() =>
      evaluateRules(
        {
          changedFiles,
          coverageRelationships: [
            { path: 'src/a.ts', linesFound: 1, linesHit: 1 },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toThrow(/cover every eligible changed source/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            { path: 'src/a.ts', linesFound: 1, linesHit: null },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toThrow(/invalid fields/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            { path: 'src/a.test.ts', linesFound: 1, linesHit: 1 },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toThrow(/ineligible changed path/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            { path: 'src/a.ts', linesFound: 1, linesHit: 1 },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
        { 'insufficient-coverage': { options: { minLinePercent: 101 } } },
      ),
    ).toThrow(/minLinePercent/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            {
              path: 'src/a.ts',
              linesFound: 1,
              linesHit: 1,
              changedLineCount: 1,
              changedLinesFound: 2,
              changedLinesHit: 1,
            },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toThrow(/invalid fields/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            {
              path: 'src/a.ts',
              linesFound: 1,
              linesHit: 1,
              changedLineCount: 1,
            },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toThrow(/invalid fields/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            {
              path: 'src/a.ts',
              linesFound: 1,
              linesHit: 1,
            },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
        {
          'insufficient-coverage': {
            options: { minChangedLinePercent: -1 },
          },
        },
      ),
    ).toThrow(/minChangedLinePercent/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            {
              path: 'src/a.ts',
              linesFound: 1,
              linesHit: 1,
              baselineLinesFound: 1,
              baselineLinesHit: 1,
            },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
      ),
    ).toThrow(/invalid fields/);
    expect(() =>
      evaluateRules(
        {
          changedFiles: [changedFiles[0]!],
          coverageRelationships: [
            { path: 'src/a.ts', linesFound: 1, linesHit: 1 },
          ],
          sensitiveAreas: [],
        },
        [insufficientCoverageRule],
        {
          'insufficient-coverage': {
            options: { maxLinePercentDrop: 101 },
          },
        },
      ),
    ).toThrow(/maxLinePercentDrop/);
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
