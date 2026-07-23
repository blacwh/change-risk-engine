import { describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';

import { createFixtureRepository } from '../../../packages/fixtures/src/index.js';
import { runCli } from './main.js';

describe('change-risk CLI', () => {
  it('renders help and rejects unsupported commands without throwing', async () => {
    await expect(runCli([], '.')).resolves.toMatchObject({
      exitCode: 0,
      stderr: '',
    });
    await expect(runCli(['unknown'], '.')).resolves.toEqual({
      stdout: '',
      stderr: 'change-risk: Unknown command: unknown\n',
      exitCode: 1,
    });
  });

  it('analyzes exact revisions and applies the configured exit policy', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'src/auth.ts': 'export const auth = true;\n',
          'src/index.ts':
            'export function publicApi(value: string): string { return value; }\n',
        },
      },
      {
        message: 'head',
        files: {
          'src/auth.ts': 'export const auth = false;\n',
          'src/auth.test.ts':
            "import { auth } from './auth.js';\nexport const observed = auth;\n",
          'src/index.ts':
            'export function publicApi(value: number): string { return String(value); }\n',
        },
      },
    ]);
    try {
      const response = await runCli(
        [
          'analyze',
          '--repo',
          fixture.path,
          '--base',
          fixture.revisions[0]!,
          '--head',
          fixture.revisions[1]!,
          '--format',
          'json',
          '--fail-on',
          'moderate',
        ],
        '.',
      );
      expect(response.stderr).toBe('');
      expect(response.exitCode).toBe(2);
      const report = JSON.parse(response.stdout) as {
        score: number;
        classification: string;
        findings: { ruleId: string }[];
        revisions: { base: string; head: string };
      };
      expect(report.revisions).toEqual({
        base: fixture.revisions[0],
        head: fixture.revisions[1],
      });
      expect(report).not.toHaveProperty('blastRadius');
      expect(report.classification).toBe('moderate');
      expect(report.score).toBe(35);
      expect(report.findings.map(({ ruleId }) => ruleId)).toEqual([
        'missing-related-tests',
        'public-export',
        'tests-added',
      ]);

      const html = await runCli(
        [
          'analyze',
          '--repo',
          fixture.path,
          '--base',
          fixture.revisions[0]!,
          '--head',
          fixture.revisions[1]!,
          '--format',
          'html',
        ],
        '.',
      );
      expect(html).toMatchObject({ exitCode: 0, stderr: '' });
      expect(html.stdout.startsWith('<!doctype html>')).toBe(true);
      expect(html.stdout).toContain('Repository change report');
      expect(html.stdout).toContain('Dependency blast radius');
      expect(html.stdout).toContain('<svg');

      await writeFile(`${fixture.path}/untracked.ts`, 'export {};\n', 'utf8');
      const degraded = await runCli(
        [
          'analyze',
          '--repo',
          fixture.path,
          '--base',
          fixture.revisions[0]!,
          '--head',
          fixture.revisions[1]!,
          '--format',
          'json',
        ],
        '.',
      );
      const degradedReport = JSON.parse(degraded.stdout) as {
        findings: { ruleId: string }[];
        limitations: string[];
      };
      expect(degradedReport.findings.map(({ ruleId }) => ruleId)).toEqual([
        'public-export',
      ]);
      expect(degradedReport.limitations.join(' ')).toMatch(/clean worktree/);

      await expect(
        runCli(
          ['analyze', '--repo', fixture.path, '--config', '../outside.json'],
          '.',
        ),
      ).resolves.toMatchObject({ exitCode: 1, stdout: '' });
    } finally {
      await fixture.cleanup();
    }
  });
});
