import { describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';

import { createFixtureRepository } from '../../../packages/fixtures/src/index.js';
import { runCli } from './main.js';

describe('change-risk CLI', () => {
  it('renders help and rejects unsupported commands without throwing', async () => {
    const help = await runCli([], '.');
    expect(help).toMatchObject({
      exitCode: 0,
      stderr: '',
    });
    expect(help.stdout).toContain('--coverage <path>');
    await expect(runCli(['unknown'], '.')).resolves.toEqual({
      stdout: '',
      stderr: 'change-risk: Unknown command: unknown\n',
      exitCode: 1,
    });
  });

  it('maps supplied LCOV to every eligible changed source deterministically', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'coverage/lcov.info': [
            'SF:src/covered.ts',
            'DA:1,1',
            'LF:1',
            'LH:1',
            'end_of_record',
            'SF:src/low.ts',
            'DA:1,0',
            'LF:1',
            'LH:0',
            'end_of_record',
          ].join('\n'),
          'src/covered.ts': 'export const covered = 1;\n',
          'src/low.ts': 'export const low = 1;\n',
          'src/missing.ts': 'export const missing = 1;\n',
        },
      },
      {
        message: 'head',
        files: {
          'src/covered.ts': 'export const covered = 2;\n',
          'src/low.ts': 'export const low = 2;\n',
          'src/missing.ts': 'export const missing = 2;\n',
        },
      },
    ]);
    try {
      const arguments_ = [
        'analyze',
        '--repo',
        fixture.path,
        '--base',
        fixture.revisions[0]!,
        '--head',
        fixture.revisions[1]!,
        '--coverage',
        'coverage/lcov.info',
        '--format',
        'json',
      ];
      const first = await runCli(arguments_, '.');
      const second = await runCli(arguments_, '.');
      expect(first).toEqual(second);
      expect(first).toMatchObject({ exitCode: 0, stderr: '' });
      const report = JSON.parse(first.stdout) as {
        evidence: {
          kind: string;
          data: Record<string, unknown>;
          sourcePaths?: string[];
        }[];
        findings: { ruleId: string; affectedPaths: string[] }[];
        limitations: string[];
      };
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          ruleId: 'insufficient-coverage',
          affectedPaths: ['src/low.ts', 'src/missing.ts'],
        }),
      );
      expect(report.evidence).toContainEqual(
        expect.objectContaining({
          kind: 'coverage',
          sourcePaths: ['src/low.ts', 'src/missing.ts'],
        }),
      );
      expect(report.limitations).toContain(
        'Coverage evidence is caller supplied; freshness and revision alignment are not verified.',
      );
      await expect(
        runCli(
          ['analyze', '--repo', fixture.path, '--coverage', '../outside.info'],
          '.',
        ),
      ).resolves.toMatchObject({ exitCode: 1, stdout: '' });
    } finally {
      await fixture.cleanup();
    }
  });

  it('turns malformed LCOV into a source-free limitation without a finding', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'coverage/lcov.info': 'SF:../private.ts\nLF:0\nLH:0\nend_of_record\n',
          'src/service.ts': 'export const service = 1;\n',
        },
      },
      {
        message: 'head',
        files: { 'src/service.ts': 'export const service = 2;\n' },
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
          '--coverage',
          'coverage/lcov.info',
          '--format',
          'json',
        ],
        '.',
      );
      const report = JSON.parse(response.stdout) as {
        findings: { ruleId: string }[];
        limitations: string[];
      };
      expect(report.findings.map(({ ruleId }) => ruleId)).not.toContain(
        'insufficient-coverage',
      );
      expect(report.limitations).toContain(
        'Coverage evidence unavailable: invalid-source-path (line 1).',
      );
      expect(JSON.stringify(report.limitations)).not.toContain('private.ts');
    } finally {
      await fixture.cleanup();
    }
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

  it('reports deterministic missing-owner evidence from the head CODEOWNERS file', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          '.github/CODEOWNERS': '/docs/owned.md @docs\n',
          'docs/owned.md': 'Owned.\n',
          'docs/unowned.md': 'Unowned.\n',
        },
      },
      {
        message: 'head',
        files: {
          'docs/owned.md': 'Owned and changed.\n',
          'docs/unowned.md': 'Unowned and changed.\n',
        },
      },
    ]);
    try {
      const arguments_ = [
        'analyze',
        '--repo',
        fixture.path,
        '--base',
        fixture.revisions[0]!,
        '--head',
        fixture.revisions[1]!,
        '--format',
        'json',
      ];
      const first = await runCli(arguments_, '.');
      const second = await runCli(arguments_, '.');
      expect(first).toEqual(second);
      expect(first).toMatchObject({ exitCode: 0, stderr: '' });
      const report = JSON.parse(first.stdout) as {
        evidence: {
          kind: string;
          data: Record<string, unknown>;
          sourcePaths?: string[];
        }[];
        findings: { ruleId: string; affectedPaths: string[] }[];
        score: number;
      };
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          ruleId: 'missing-owner',
          affectedPaths: ['docs/unowned.md'],
        }),
      );
      expect(report.evidence).toContainEqual(
        expect.objectContaining({
          kind: 'ownership',
          data: {
            fileCount: 1,
            unownedPaths: ['docs/unowned.md'],
          },
          sourcePaths: ['docs/unowned.md'],
        }),
      );
      expect(report.score).toBe(15);
    } finally {
      await fixture.cleanup();
    }
  });

  it('turns malformed CODEOWNERS into a source-free limitation without a finding', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          '.github/CODEOWNERS': '* @maintainers\n',
          'docs/guide.md': 'Base.\n',
        },
      },
      {
        message: 'head',
        files: {
          '.github/CODEOWNERS': '!private/** @secret-team\n',
          'docs/guide.md': 'Changed.\n',
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
        ],
        '.',
      );
      const report = JSON.parse(response.stdout) as {
        findings: { ruleId: string }[];
        limitations: string[];
      };
      expect(report.findings.map(({ ruleId }) => ruleId)).not.toContain(
        'missing-owner',
      );
      expect(report.limitations).toContain(
        'Ownership evidence unavailable: unsupported-pattern (line 1).',
      );
      expect(JSON.stringify(report.limitations)).not.toContain('secret-team');
    } finally {
      await fixture.cleanup();
    }
  });
});
