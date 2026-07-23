import { constants } from 'node:fs';
import { appendFile, lstat, mkdir, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { analyzeRepository } from '@change-risk/cli';
import {
  renderGitHubMarkdownReport,
  renderJsonReport,
} from '@change-risk/reporters';

import { maintainPullRequestComment } from './github.js';

const MAX_EVENT_BYTES = 1024 * 1024;
const LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
type RiskLevel = (typeof LEVELS)[number];
type FailOn = RiskLevel | 'none';

type EventContext = {
  base: string;
  head: string;
  pullRequestNumber?: number;
  sameRepository: boolean;
};

export type ActionRuntime = {
  environment?: NodeJS.ProcessEnv;
  fetchImplementation?: typeof fetch;
};

export type ActionResult = {
  exitCode: 0 | 2;
  classification: RiskLevel;
  score: number;
  outputPath: string;
  comment: 'created' | 'updated' | 'skipped';
};

function object(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`${label} must be an object`);
  }
  return input as Record<string, unknown>;
}

function textField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    /[\r\n]/u.test(value)
  ) {
    throw new Error(
      `GitHub event ${key} must be a nonempty single-line string`,
    );
  }
  return value;
}

async function readEvent(path: string): Promise<Record<string, unknown>> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > MAX_EVENT_BYTES) {
      throw new Error('GitHub event file must be a bounded regular file');
    }
    const content = await handle.readFile('utf8');
    if (Buffer.byteLength(content, 'utf8') > MAX_EVENT_BYTES) {
      throw new Error('GitHub event file exceeded the size limit');
    }
    return object(JSON.parse(content) as unknown, 'GitHub event');
  } finally {
    await handle.close();
  }
}

function eventContext(
  event: Record<string, unknown>,
  repository: string,
): EventContext {
  if (event.pull_request !== undefined) {
    const pullRequest = object(event.pull_request, 'pull_request');
    const base = object(pullRequest.base, 'pull_request.base');
    const head = object(pullRequest.head, 'pull_request.head');
    const baseRepository = object(base.repo, 'pull_request.base.repo');
    const headRepository = object(head.repo, 'pull_request.head.repo');
    const number = event.number;
    if (!Number.isSafeInteger(number) || (number as number) < 1) {
      throw new Error(
        'GitHub event pull request number must be a positive integer',
      );
    }
    const baseName = textField(baseRepository, 'full_name');
    const headName = textField(headRepository, 'full_name');
    return {
      base: textField(base, 'sha'),
      head: textField(head, 'sha'),
      pullRequestNumber: number as number,
      sameRepository: baseName === repository && headName === repository,
    };
  }
  return {
    base: textField(event, 'before'),
    head: textField(event, 'after'),
    sameRepository: false,
  };
}

function input(
  environment: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = environment[`INPUT_${name.toUpperCase()}`]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function booleanInput(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('comment input must be true or false');
}

function failOnInput(value: string | undefined): FailOn {
  const candidate = value ?? 'none';
  if (candidate === 'none' || LEVELS.includes(candidate as RiskLevel)) {
    return candidate as FailOn;
  }
  throw new Error(
    'fail-on input must be none, low, moderate, high, or critical',
  );
}

function gateFails(classification: RiskLevel, failOn: FailOn): boolean {
  return (
    failOn !== 'none' &&
    LEVELS.indexOf(classification) >= LEVELS.indexOf(failOn)
  );
}

async function safeOutputPath(
  workspace: string,
  requested: string,
): Promise<string> {
  if (
    isAbsolute(requested) ||
    requested.length === 0 ||
    /[\r\n\0]/u.test(requested)
  ) {
    throw new Error('output must be a repository-relative path');
  }
  const root = await realpath(workspace);
  const target = resolve(root, requested);
  const targetRelative = relative(root, target);
  if (targetRelative === '..' || targetRelative.startsWith(`..${sep}`)) {
    throw new Error('output must remain inside GITHUB_WORKSPACE');
  }
  const segments = targetRelative.split(sep);
  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error('output path must not contain symbolic links');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      break;
    }
  }
  await mkdir(dirname(target), { recursive: true });
  if ((await realpath(dirname(target))) !== dirname(target)) {
    throw new Error('output path must not contain symbolic links');
  }
  return target;
}

async function writeReport(path: string, content: string): Promise<void> {
  const handle = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_TRUNC |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}

async function appendCommandFile(
  path: string | undefined,
  content: string,
): Promise<void> {
  if (path !== undefined && path.length > 0)
    await appendFile(path, content, 'utf8');
}

export async function runGitHubAction(
  runtime: ActionRuntime = {},
): Promise<ActionResult> {
  const environment = runtime.environment ?? process.env;
  const workspace = environment.GITHUB_WORKSPACE;
  const eventPath = environment.GITHUB_EVENT_PATH;
  const repository = environment.GITHUB_REPOSITORY;
  if (
    workspace === undefined ||
    eventPath === undefined ||
    repository === undefined
  ) {
    throw new Error(
      'GITHUB_WORKSPACE, GITHUB_EVENT_PATH, and GITHUB_REPOSITORY are required',
    );
  }
  const [owner, repositoryName, extra] = repository.split('/');
  if (!owner || !repositoryName || extra !== undefined) {
    throw new Error('GITHUB_REPOSITORY must have owner/name form');
  }
  const context = eventContext(await readEvent(eventPath), repository);
  const configPath = input(environment, 'CONFIG');
  const result = await analyzeRepository({
    repositoryRoot: workspace,
    base: context.base,
    head: context.head,
    ...(configPath === undefined ? {} : { configPath }),
  });
  const outputPath = await safeOutputPath(
    workspace,
    input(environment, 'OUTPUT') ?? 'change-risk-report.json',
  );
  await writeReport(outputPath, renderJsonReport(result));
  const markdown = renderGitHubMarkdownReport(result);
  await appendCommandFile(
    environment.GITHUB_OUTPUT,
    `classification=${result.classification}\nscore=${result.score}\njson-path=${outputPath}\n`,
  );
  await appendCommandFile(environment.GITHUB_STEP_SUMMARY, markdown);

  let comment: ActionResult['comment'] = 'skipped';
  if (
    booleanInput(input(environment, 'COMMENT'), true) &&
    context.pullRequestNumber !== undefined &&
    context.sameRepository
  ) {
    const token = environment.GITHUB_TOKEN;
    if (token === undefined || token.length === 0) {
      throw new Error(
        'GITHUB_TOKEN is required to comment on same-repository pull requests',
      );
    }
    const commentResult = await maintainPullRequestComment({
      apiUrl: environment.GITHUB_API_URL ?? 'https://api.github.com',
      token,
      owner,
      repository: repositoryName,
      pullRequestNumber: context.pullRequestNumber,
      body: markdown,
      ...(runtime.fetchImplementation === undefined
        ? {}
        : { fetchImplementation: runtime.fetchImplementation }),
    });
    comment = commentResult.action;
  }
  const failOn = failOnInput(input(environment, 'FAIL-ON'));
  return {
    exitCode: gateFails(result.classification, failOn) ? 2 : 0,
    classification: result.classification,
    score: result.score,
    outputPath,
    comment,
  };
}
