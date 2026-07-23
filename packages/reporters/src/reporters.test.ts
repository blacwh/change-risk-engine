import { describe, expect, it } from 'vitest';

import {
  GITHUB_COMMENT_MARKER,
  renderGitHubMarkdownReport,
  renderJsonReport,
  renderTerminalReport,
} from './reporters.js';

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
      Score contributions:
      - large-change: +20 (1 finding)
      Limitations:
      - Graph analysis is not available.
      "
    `);
  });

  it('rejects invalid results instead of rendering partial data', () => {
    expect(() => renderJsonReport({ ...result, schemaVersion: 2 })).toThrow();
  });

  it('renders a bounded maintained-comment body with escaped evidence', () => {
    const markdown = renderGitHubMarkdownReport({
      ...result,
      findings: [
        {
          ...result.findings[0],
          title: 'Large | change <check> [link](bad)',
          affectedPaths: ['src/a|b.ts'],
        },
      ],
    });
    expect(markdown.startsWith(GITHUB_COMMENT_MARKER)).toBe(true);
    expect(markdown).toContain(
      'Large &#124; change &lt;check&gt; &#91;link&#93;(bad)',
    );
    expect(markdown).toContain('score 20');
    expect(markdown).toContain('Effective score contributions');
    expect(markdown).toContain('Evidence: `e1`');
    expect(markdown.length).toBeLessThanOrEqual(60_000);
  });
});
