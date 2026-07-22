import { describe, expect, it } from 'vitest';

import { parseAnalysisResult } from './result.js';

const validResult = {
  schemaVersion: 1,
  revisions: { base: 'abc', head: 'def' },
  changedFiles: [],
  evidence: [{ id: 'e1', kind: 'git', summary: 'A file changed', data: {} }],
  findings: [
    {
      id: 'f1',
      ruleId: 'large-change',
      title: 'Large change',
      severity: 'medium',
      weight: 20,
      explanation: 'The configured threshold was exceeded.',
      evidenceIds: ['e1'],
      affectedPaths: ['src/index.ts'],
    },
  ],
  score: 20,
  classification: 'moderate',
  scoreContributions: [
    { ruleId: 'large-change', findingIds: ['f1'], weight: 20 },
  ],
  limitations: [],
} as const;

describe('analysis result schema v1', () => {
  it('accepts an evidence-backed result', () => {
    expect(parseAnalysisResult(validResult)).toEqual(validResult);
  });

  it('rejects findings with missing evidence', () => {
    expect(() =>
      parseAnalysisResult({
        ...validResult,
        findings: [{ ...validResult.findings[0], evidenceIds: ['missing'] }],
      }),
    ).toThrow(/Unknown evidence id/);
  });

  it('rejects score contributions with missing findings', () => {
    expect(() =>
      parseAnalysisResult({
        ...validResult,
        scoreContributions: [
          { ruleId: 'large-change', findingIds: ['missing'], weight: 20 },
        ],
      }),
    ).toThrow(/Unknown finding id/);
  });

  it('rejects a score that hides its contribution total', () => {
    expect(() => parseAnalysisResult({ ...validResult, score: 21 })).toThrow(
      /Score must equal/,
    );
  });
});
