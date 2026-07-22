import { describe, expect, it } from 'vitest';

import { renderJsonReport, renderTerminalReport } from './reporters.js';

const result = {
  schemaVersion: 1,
  revisions: { base: 'abc', head: 'def' },
  changedFiles: [
    {
      path: 'src/index.ts',
      status: 'modified',
      additions: 2,
      deletions: 1,
      binary: false,
      categories: ['source'],
    },
  ],
  evidence: [{ id: 'e1', kind: 'git', summary: 'changed', data: {} }],
  findings: [
    {
      id: 'f1',
      ruleId: 'large-change',
      title: 'Large change',
      severity: 'medium',
      weight: 20,
      explanation: 'Threshold exceeded.',
      evidenceIds: ['e1'],
      affectedPaths: ['src/index.ts'],
    },
  ],
  score: 20,
  classification: 'moderate',
  scoreContributions: [
    { ruleId: 'large-change', findingIds: ['f1'], weight: 20 },
  ],
  limitations: ['Graph analysis is not available.'],
};

describe('report skeletons', () => {
  it('renders deterministic machine-readable JSON with a trailing newline', () => {
    const rendered = renderJsonReport(result);
    expect(JSON.parse(rendered)).toEqual(result);
    expect(rendered.endsWith('\n')).toBe(true);
  });

  it('renders a concise evidence-backed terminal summary', () => {
    expect(renderTerminalReport(result)).toMatchInlineSnapshot(`
      "Change risk: MODERATE (20)
      Revisions: abc..def
      Changed files: 1 (+2 -1; 0 binary)
      Findings:
      - [MEDIUM] Large change (+20): Threshold exceeded.
      Limitations:
      - Graph analysis is not available.
      "
    `);
  });

  it('rejects invalid results instead of rendering partial data', () => {
    expect(() => renderJsonReport({ ...result, schemaVersion: 2 })).toThrow();
  });
});
