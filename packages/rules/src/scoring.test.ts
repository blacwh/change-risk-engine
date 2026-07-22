import type { Finding } from '@change-risk/core';
import { describe, expect, it } from 'vitest';

import type { RuleEvaluation } from './engine.js';
import { scoreRuleEvaluation } from './scoring.js';

const thresholds = { moderate: 20, high: 50, critical: 80 };

function finding(id: string, ruleId: string, weight: number): Finding {
  return {
    id,
    ruleId,
    title: ruleId,
    severity: 'medium',
    weight,
    explanation: 'Evidence-backed test finding.',
    evidenceIds: [`${id}:evidence`],
    affectedPaths: [],
  };
}

function evaluation(findings: readonly Finding[]): RuleEvaluation {
  return { evidence: [], findings };
}

describe('transparent rule scoring', () => {
  it('groups visible contributions in rule order and classifies thresholds', () => {
    const result = scoreRuleEvaluation(
      evaluation([
        finding('z:1', 'z-rule', 30),
        finding('a:2', 'a-rule', 15),
        finding('a:1', 'a-rule', 15),
      ]),
      thresholds,
    );
    expect(result.score).toBe(60);
    expect(result.classification).toBe('high');
    expect(result.scoreContributions).toEqual([
      { ruleId: 'a-rule', findingIds: ['a:1', 'a:2'], weight: 30 },
      { ruleId: 'z-rule', findingIds: ['z:1'], weight: 30 },
    ]);
  });

  it('applies mitigation without allowing a negative aggregate', () => {
    const mitigated = scoreRuleEvaluation(
      evaluation([
        finding('risk', 'large-change', 20),
        finding('tests', 'tests-added', -10),
      ]),
      thresholds,
    );
    expect(mitigated).toMatchObject({
      score: 10,
      classification: 'low',
      scoreContributions: [
        { ruleId: 'large-change', findingIds: ['risk'], weight: 20 },
        { ruleId: 'tests-added', findingIds: ['tests'], weight: -10 },
      ],
    });

    const capped = scoreRuleEvaluation(
      evaluation([finding('tests', 'tests-added', -10)]),
      thresholds,
    );
    expect(capped.score).toBe(0);
    expect(capped.scoreContributions[0]?.weight).toBe(0);
  });

  it('rejects invalid thresholds, duplicate ids, and non-finite totals', () => {
    expect(() =>
      scoreRuleEvaluation(evaluation([]), { ...thresholds, high: 10 }),
    ).toThrow(/thresholds/);
    expect(() =>
      scoreRuleEvaluation(
        evaluation([finding('same', 'one', 1), finding('same', 'two', 1)]),
        thresholds,
      ),
    ).toThrow(/unique/);
    expect(() =>
      scoreRuleEvaluation(
        evaluation([
          finding('huge-a', 'one', Number.MAX_VALUE),
          finding('huge-b', 'one', Number.MAX_VALUE),
        ]),
        thresholds,
      ),
    ).toThrow(/not finite/);
  });
});
