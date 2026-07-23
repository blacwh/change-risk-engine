import { describe, expect, it, vi } from 'vitest';

import type { RiskRule } from '@change-risk/rules';

import { createPluginRegistry } from './registry.js';

function rule(id: string): RiskRule {
  return { id, defaultWeight: 1, evaluate: () => [] };
}

describe('plugin registry', () => {
  it('composes trusted components deterministically without executing them', () => {
    const evaluate = vi.fn(() => []);
    const indexRepository = vi.fn(async () => ({
      repositoryRoot: '/repo',
      modules: [],
      issues: [],
    }));
    const registry = createPluginRegistry({
      builtInRules: [rule('built-in')],
      plugins: [
        {
          apiVersion: 1,
          id: 'vendor-pack',
          rules: [{ id: 'vendor-rule', defaultWeight: 2, evaluate }],
          languageAdapters: [
            { id: 'vendor-language', canHandle: () => true, indexRepository },
          ],
        },
      ],
    });
    expect(registry.rules.map(({ id }) => id)).toEqual([
      'built-in',
      'vendor-rule',
    ]);
    expect(registry.languageAdapter('vendor-language')?.id).toBe(
      'vendor-language',
    );
    expect(evaluate).not.toHaveBeenCalled();
    expect(indexRepository).not.toHaveBeenCalled();
    expect(Object.isFrozen(registry.rules)).toBe(true);
    expect(Object.isFrozen(registry.rules[0])).toBe(true);
  });

  it('rejects unsupported versions, invalid components, and collisions', () => {
    expect(() =>
      createPluginRegistry({
        plugins: [{ apiVersion: 2 as 1, id: 'future' }],
      }),
    ).toThrow(/unsupported API/);
    expect(() =>
      createPluginRegistry({
        builtInRules: [rule('same')],
        plugins: [{ apiVersion: 1, id: 'pack', rules: [rule('same')] }],
      }),
    ).toThrow(/unique/);
    expect(() =>
      createPluginRegistry({
        plugins: [{ apiVersion: 1, id: '../unsafe' }],
      }),
    ).toThrow(/invalid id/);
  });
});
