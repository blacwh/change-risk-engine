import { describe, expect, it } from 'vitest';

import { renderHtmlReport } from './html.js';

const result = {
  schemaVersion: 1,
  revisions: { base: 'abc', head: 'def' },
  changedFiles: [
    {
      path: 'src/<unsafe>.ts',
      status: 'modified',
      additions: 2,
      deletions: 1,
      binary: false,
      categories: ['source'],
    },
  ],
  evidence: [
    {
      id: 'evidence-unsafe',
      kind: 'git',
      summary: 'Observed </style><script>alert(1)</script>',
      data: { value: '<img src=x onerror=alert(1)>' },
      sourcePaths: ['src/<unsafe>.ts'],
    },
  ],
  findings: [
    {
      id: 'finding-1',
      ruleId: 'example',
      title: 'Review <unsafe>',
      severity: 'high',
      weight: 20,
      explanation: 'Evidence-backed explanation.',
      evidenceIds: ['evidence-unsafe'],
      affectedPaths: ['src/<unsafe>.ts'],
      remediation: 'Review it.',
    },
  ],
  score: 20,
  classification: 'moderate',
  scoreContributions: [
    { ruleId: 'example', findingIds: ['finding-1'], weight: 20 },
  ],
  limitations: ['No source was executed.'],
};

describe('HTML report', () => {
  it('renders a complete standalone report with repository text escaped', () => {
    const output = renderHtmlReport(result);
    expect(output.startsWith('<!doctype html>')).toBe(true);
    expect(output).toContain('Content-Security-Policy');
    expect(output).toContain('MODERATE');
    expect(output).toContain('Score contributions');
    expect(output).toContain('Findings: <code>finding-1</code>');
    expect(output).toContain('Finding ID');
    expect(output).toContain('Schema version 1');
    expect(output).toContain('href="#evidence-1"');
    expect(output).toContain('src/&lt;unsafe&gt;.ts');
    expect(output).toContain(
      'Observed &lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<img src=x');
    expect(output.endsWith('\n')).toBe(true);
  });

  it('rejects invalid analysis results', () => {
    expect(() => renderHtmlReport({ ...result, score: 99 })).toThrow();
  });
});
