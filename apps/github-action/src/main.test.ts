import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFixtureRepository } from '../../../packages/fixtures/src/index.js';
import { runGitHubAction } from './main.js';

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((operation) => operation()));
});

describe('GitHub Action composition', () => {
  it('writes complete outputs before applying the configured gate', async () => {
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
    cleanup.push(fixture.cleanup);
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'change-risk-action-'));
    cleanup.push(() => rm(runtimeRoot, { recursive: true, force: true }));
    const eventPath = join(runtimeRoot, 'event.json');
    const outputCommand = join(runtimeRoot, 'output');
    const summary = join(runtimeRoot, 'summary');
    await Promise.all([
      writeFile(
        eventPath,
        JSON.stringify({
          before: fixture.revisions[0],
          after: fixture.revisions[1],
        }),
      ),
      writeFile(outputCommand, ''),
      writeFile(summary, ''),
    ]);

    const result = await runGitHubAction({
      environment: {
        GITHUB_WORKSPACE: fixture.path,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repository',
        GITHUB_OUTPUT: outputCommand,
        GITHUB_STEP_SUMMARY: summary,
        'INPUT_FAIL-ON': 'low',
      },
    });

    expect(result).toMatchObject({
      exitCode: 2,
      classification: 'moderate',
      comment: 'skipped',
    });
    const report = JSON.parse(await readFile(result.outputPath, 'utf8')) as {
      schemaVersion: number;
      revisions: { base: string; head: string };
    };
    expect(report).toMatchObject({
      schemaVersion: 1,
      revisions: {
        base: fixture.revisions[0],
        head: fixture.revisions[1],
      },
    });
    expect(await readFile(outputCommand, 'utf8')).toContain(
      'classification=moderate',
    );
    expect(await readFile(summary, 'utf8')).toContain('Change risk report');
  });

  it('forwards the optional coverage artifact into analysis', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          'coverage/lcov.info':
            'SF:src/service.ts\nDA:1,0\nLF:1\nLH:0\nend_of_record\n',
          'coverage/baseline.info':
            'SF:src/service.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\n',
          'src/service.ts': 'export const service = 1;\n',
        },
      },
      {
        message: 'head',
        files: { 'src/service.ts': 'export const service = 2;\n' },
      },
    ]);
    cleanup.push(fixture.cleanup);
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'change-risk-action-'));
    cleanup.push(() => rm(runtimeRoot, { recursive: true, force: true }));
    const eventPath = join(runtimeRoot, 'event.json');
    await writeFile(
      eventPath,
      JSON.stringify({
        before: fixture.revisions[0],
        after: fixture.revisions[1],
      }),
    );

    const result = await runGitHubAction({
      environment: {
        GITHUB_WORKSPACE: fixture.path,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repository',
        INPUT_COVERAGE: 'coverage/lcov.info',
        'INPUT_BASELINE-COVERAGE': 'coverage/baseline.info',
      },
    });
    const report = JSON.parse(await readFile(result.outputPath, 'utf8')) as {
      evidence: { kind: string; sourcePaths?: string[] }[];
      findings: { ruleId: string; affectedPaths: string[] }[];
      limitations: string[];
    };
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        ruleId: 'insufficient-coverage',
        affectedPaths: ['src/service.ts'],
      }),
    );
    expect(report.evidence).toContainEqual(
      expect.objectContaining({
        kind: 'coverage',
        sourcePaths: ['src/service.ts'],
      }),
    );
    expect(JSON.stringify(report.evidence)).toContain(
      '"below-changed-line-threshold"',
    );
    expect(JSON.stringify(report.evidence)).toContain('"coverage-regression"');
    expect(report.limitations).toContain(
      'Coverage evidence is caller supplied; freshness and revision alignment are not verified.',
    );
    expect(report.limitations).toContain(
      'Baseline coverage evidence is caller supplied; freshness and revision alignment are not verified.',
    );
  });

  it('uses policy packs selected by repository configuration', async () => {
    const fixture = await createFixtureRepository([
      {
        message: 'base',
        files: {
          '.change-risk.json': JSON.stringify({
            schemaVersion: 1,
            policyPacks: ['security-sensitive'],
          }),
          'src/auth.ts': 'export const authenticate = true;\n',
        },
      },
      {
        message: 'head',
        files: {
          'src/auth.ts': 'export const authenticate = false;\n',
        },
      },
    ]);
    cleanup.push(fixture.cleanup);
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'change-risk-action-'));
    cleanup.push(() => rm(runtimeRoot, { recursive: true, force: true }));
    const eventPath = join(runtimeRoot, 'event.json');
    await writeFile(
      eventPath,
      JSON.stringify({
        before: fixture.revisions[0],
        after: fixture.revisions[1],
      }),
    );

    const result = await runGitHubAction({
      environment: {
        GITHUB_WORKSPACE: fixture.path,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repository',
      },
    });
    const report = JSON.parse(await readFile(result.outputPath, 'utf8')) as {
      findings: { ruleId: string; affectedPaths: string[] }[];
    };
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        ruleId: 'sensitive-path',
        affectedPaths: ['src/auth.ts'],
      }),
    );
  });

  it('never calls the comments API for fork pull requests', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'src/index.ts': 'export {};\n' } },
      {
        message: 'head',
        files: { 'src/index.ts': 'export const changed = true;\n' },
      },
    ]);
    cleanup.push(fixture.cleanup);
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'change-risk-action-'));
    cleanup.push(() => rm(runtimeRoot, { recursive: true, force: true }));
    const eventPath = join(runtimeRoot, 'event.json');
    await writeFile(
      eventPath,
      JSON.stringify({
        number: 12,
        pull_request: {
          base: {
            sha: fixture.revisions[0],
            repo: { full_name: 'owner/repository' },
          },
          head: {
            sha: fixture.revisions[1],
            repo: { full_name: 'contributor/fork' },
          },
        },
      }),
    );
    let calls = 0;
    const result = await runGitHubAction({
      environment: {
        GITHUB_WORKSPACE: fixture.path,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repository',
        GITHUB_TOKEN: 'must-not-be-used',
      },
      fetchImplementation: (() => {
        calls += 1;
        throw new Error('unexpected network call');
      }) as typeof fetch,
    });
    expect(result.comment).toBe('skipped');
    expect(calls).toBe(0);
  });

  it('creates the maintained comment for a same-repository pull request', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'README.md': 'base\n' } },
      { message: 'head', files: { 'README.md': 'head\n' } },
    ]);
    cleanup.push(fixture.cleanup);
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'change-risk-action-'));
    cleanup.push(() => rm(runtimeRoot, { recursive: true, force: true }));
    const eventPath = join(runtimeRoot, 'event.json');
    await writeFile(
      eventPath,
      JSON.stringify({
        number: 13,
        pull_request: {
          base: {
            sha: fixture.revisions[0],
            repo: { full_name: 'owner/repository' },
          },
          head: {
            sha: fixture.revisions[1],
            repo: { full_name: 'owner/repository' },
          },
        },
      }),
    );
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('[]', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 77,
            body: '<!-- change-risk-engine -->',
            user: { login: 'github-actions[bot]', type: 'Bot' },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      );
    const result = await runGitHubAction({
      environment: {
        GITHUB_WORKSPACE: fixture.path,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repository',
        GITHUB_TOKEN: 'token',
      },
      fetchImplementation: request,
    });
    expect(result.comment).toBe('created');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects output traversal', async () => {
    const fixture = await createFixtureRepository([
      { message: 'base', files: { 'README.md': 'base\n' } },
      { message: 'head', files: { 'README.md': 'head\n' } },
    ]);
    cleanup.push(fixture.cleanup);
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'change-risk-action-'));
    cleanup.push(() => rm(runtimeRoot, { recursive: true, force: true }));
    const eventPath = join(runtimeRoot, 'event.json');
    await writeFile(
      eventPath,
      JSON.stringify({
        before: fixture.revisions[0],
        after: fixture.revisions[1],
      }),
    );
    await expect(
      runGitHubAction({
        environment: {
          GITHUB_WORKSPACE: fixture.path,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'owner/repository',
          INPUT_OUTPUT: '../outside.json',
        },
      }),
    ).rejects.toThrow('inside GITHUB_WORKSPACE');
  });
});
