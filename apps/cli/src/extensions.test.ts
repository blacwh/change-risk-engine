import { describe, expect, it } from 'vitest';

import { typeScriptLanguageAdapter } from '@change-risk/language-typescript';
import { createPluginRegistry } from '@change-risk/plugin-sdk';
import { DEFAULT_RULES } from '@change-risk/rules';

import { createFixtureRepository } from '../../../packages/fixtures/src/index.js';
import { analyzeRepository } from './analyze.js';

describe('programmatic extension composition', () => {
  it('runs explicitly supplied trusted rules and the registered built-in adapter', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: { 'src/index.ts': 'export const value = 1;\n' },
      },
      {
        message: 'head',
        files: { 'src/index.ts': 'export const value = 2;\n' },
      },
    ]);
    try {
      const registry = createPluginRegistry({
        builtInRules: DEFAULT_RULES,
        builtInLanguageAdapters: [typeScriptLanguageAdapter],
        plugins: [
          {
            apiVersion: 1,
            id: 'example-pack',
            rules: [
              {
                id: 'example-policy',
                defaultWeight: 7,
                evaluate: (context) => {
                  const path = context.changedFiles[0]?.path;
                  return path === undefined
                    ? []
                    : [
                        {
                          evidence: {
                            kind: 'example',
                            summary: 'Example host policy matched',
                            data: { path },
                            sourcePaths: [path],
                          },
                          finding: {
                            title: 'Example host policy',
                            severity: 'low',
                            explanation:
                              'Supplied by a trusted embedding host.',
                            affectedPaths: [path],
                          },
                        },
                      ];
                },
              },
            ],
          },
        ],
      });
      const adapter = registry.languageAdapter('typescript');
      expect(adapter).toBeDefined();
      const result = await analyzeRepository({
        repositoryRoot: fixture.path,
        base: fixture.revisions[0]!,
        head: fixture.revisions[1]!,
        rules: registry.rules,
        languageAdapter: adapter!,
      });
      expect(result.findings.map(({ ruleId }) => ruleId)).toContain(
        'example-policy',
      );
      expect(
        result.scoreContributions.find(
          ({ ruleId }) => ruleId === 'example-policy',
        )?.weight,
      ).toBe(7);
    } finally {
      await fixture.cleanup();
    }
  });
});
