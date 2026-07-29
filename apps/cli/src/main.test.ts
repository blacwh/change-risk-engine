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
    expect(help.stdout).toContain('--baseline-coverage <path>');
    await expect(runCli(['unknown'], '.')).resolves.toEqual({
      stdout: '',
      stderr: 'change-risk: Unknown command: unknown\n',
      exitCode: 1,
    });
    await expect(
      runCli(['analyze', '--baseline-coverage', 'coverage/base.info'], '.'),
    ).resolves.toMatchObject({
      exitCode: 1,
      stderr: 'change-risk: --baseline-coverage requires --coverage\n',
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
      expect(JSON.stringify(report.evidence)).toContain(
        '"changedLinePercent":0',
      );
      expect(JSON.stringify(report.evidence)).toContain(
        '"below-changed-line-threshold"',
      );
      expect(report.limitations).toContain(
        'Coverage evidence is caller supplied; freshness and revision alignment are not verified.',
      );
      expect(report.limitations).toContain(
        'Changed-line coverage uses new-side zero-context Git hunks; deleted-side and non-instrumented lines are not scored.',
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

  it('maps rename-aware baseline LCOV and reports deterministic regression evidence', async () => {
    const renamedContents = 'export const stable = true;\n'.repeat(10);
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'coverage/base.info': [
            'SF:src/old-name.ts',
            ...Array.from({ length: 10 }, (_, index) => `DA:${index + 1},1`),
            'LF:10',
            'LH:10',
            'end_of_record',
          ].join('\n'),
          'coverage/head.info': '',
          'src/old-name.ts': renamedContents,
        },
      },
      {
        message: 'head',
        files: {
          'coverage/head.info': [
            'SF:src/new-name.ts',
            ...Array.from(
              { length: 10 },
              (_, index) => `DA:${index + 1},${index < 8 ? 1 : 0}`,
            ),
            'LF:10',
            'LH:8',
            'end_of_record',
          ].join('\n'),
          'src/old-name.ts': null,
          'src/new-name.ts': renamedContents,
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
        'coverage/head.info',
        '--baseline-coverage',
        'coverage/base.info',
        '--format',
        'json',
      ];
      const first = await runCli(arguments_, '.');
      const second = await runCli(arguments_, '.');
      expect(first).toEqual(second);
      expect(first).toMatchObject({ exitCode: 0, stderr: '' });
      const report = JSON.parse(first.stdout) as {
        evidence: { kind: string; data: Record<string, unknown> }[];
        limitations: string[];
      };
      const serialized = JSON.stringify(
        report.evidence.find(({ kind }) => kind === 'coverage')?.data,
      );
      expect(serialized).toContain('"path":"src/new-name.ts"');
      expect(serialized).toContain('"baselinePath":"src/old-name.ts"');
      expect(serialized).toContain('"baselineLinePercent":100');
      expect(serialized).toContain('"linePercentDelta":-20');
      expect(serialized).toContain('"coverage-regression"');
      expect(report.limitations).toContain(
        'Baseline coverage evidence is caller supplied; freshness and revision alignment are not verified.',
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('preserves head coverage when baseline LCOV is invalid', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'coverage/base.info': 'SF:../private.ts\nLF:0\nLH:0\nend_of_record\n',
          'coverage/head.info':
            'SF:src/service.ts\nDA:1,0\nLF:1\nLH:0\nend_of_record\n',
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
          'coverage/head.info',
          '--baseline-coverage',
          'coverage/base.info',
          '--format',
          'json',
        ],
        '.',
      );
      const report = JSON.parse(response.stdout) as {
        findings: { ruleId: string }[];
        limitations: string[];
      };
      expect(report.findings.map(({ ruleId }) => ruleId)).toContain(
        'insufficient-coverage',
      );
      expect(report.limitations).toContain(
        'Baseline coverage evidence unavailable: invalid-source-path (line 1).',
      );
      expect(JSON.stringify(report.limitations)).not.toContain('private.ts');
    } finally {
      await fixture.cleanup();
    }
  });

  it('preserves whole-file coverage when bounded Git hunk collection fails', async () => {
    const repeated = 2_200_000;
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'coverage/lcov.info':
            'SF:src/large.ts\nDA:1,0\nLF:1\nLH:0\nend_of_record\n',
          'src/large.ts': `export const value = '${'a'.repeat(repeated)}';\n`,
        },
      },
      {
        message: 'head',
        files: {
          'src/large.ts': `export const value = '${'b'.repeat(repeated)}';\n`,
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
          '--coverage',
          'coverage/lcov.info',
          '--format',
          'json',
        ],
        '.',
      );
      expect(response).toMatchObject({ exitCode: 0, stderr: '' });
      const report = JSON.parse(response.stdout) as {
        evidence: { kind: string; data: Record<string, unknown> }[];
        findings: { ruleId: string }[];
        limitations: string[];
      };
      expect(report.findings.map(({ ruleId }) => ruleId)).toContain(
        'insufficient-coverage',
      );
      const coverageEvidence = report.evidence.find(
        ({ kind }) => kind === 'coverage',
      );
      expect(JSON.stringify(coverageEvidence?.data)).not.toContain(
        'changedLineCount',
      );
      expect(report.limitations).toContain(
        'Changed-line coverage evidence unavailable: Git changed-line ranges could not be collected.',
      );
    } finally {
      await fixture.cleanup();
    }
  }, 20_000);

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
