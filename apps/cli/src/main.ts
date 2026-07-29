import { resolve } from 'node:path';

import {
  renderHtmlReport,
  renderJsonReport,
  renderTerminalReport,
} from '@change-risk/reporters';

import { analyzeRepositoryWithArtifacts } from './analyze.js';

const HELP = `Usage: change-risk analyze [options]

Options:
  --base <revision>       Base revision (default: HEAD~1)
  --head <revision>       Head revision (default: HEAD)
  --repo <path>           Repository root (default: current directory)
  --config <path>         Repository-relative JSON config (default: .change-risk.json if present)
  --coverage <path>       Repository-relative LCOV artifact
  --format <terminal|json|html>
  --fail-on <none|low|moderate|high|critical>
  --help
  --version
`;

declare const __CHANGE_RISK_VERSION__: string;
const VERSION =
  typeof __CHANGE_RISK_VERSION__ === 'string'
    ? __CHANGE_RISK_VERSION__
    : '0.0.0';
const levels = ['low', 'moderate', 'high', 'critical'] as const;
type RiskLevel = (typeof levels)[number];
type FailOn = RiskLevel | 'none';

export type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type AnalyzeArguments = {
  base: string;
  head: string;
  repositoryRoot: string;
  configPath?: string;
  coveragePath?: string;
  format: 'html' | 'json' | 'terminal';
  failOn: FailOn;
};

function valueAfter(args: readonly string[], index: number): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${args[index] ?? 'option'}`);
  }
  return value;
}

function parseAnalyzeArguments(
  args: readonly string[],
  workingDirectory: string,
): AnalyzeArguments {
  let base = 'HEAD~1';
  let head = 'HEAD';
  let repositoryRoot = workingDirectory;
  let configPath: string | undefined;
  let coveragePath: string | undefined;
  let format: 'html' | 'json' | 'terminal' = 'terminal';
  let failOn: FailOn = 'none';
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === undefined) break;
    if (
      ![
        '--base',
        '--config',
        '--coverage',
        '--fail-on',
        '--format',
        '--head',
        '--repo',
      ].includes(option)
    ) {
      throw new Error(`Unknown option: ${option}`);
    }
    if (seen.has(option)) throw new Error(`Duplicate option: ${option}`);
    seen.add(option);
    const value = valueAfter(args, index);
    index += 1;
    if (option === '--base') base = value;
    else if (option === '--head') head = value;
    else if (option === '--repo')
      repositoryRoot = resolve(workingDirectory, value);
    else if (option === '--config') configPath = value;
    else if (option === '--coverage') coveragePath = value;
    else if (option === '--format') {
      if (value !== 'html' && value !== 'json' && value !== 'terminal') {
        throw new Error('--format must be terminal, json, or html');
      }
      format = value;
    } else {
      if (value !== 'none' && !levels.includes(value as RiskLevel)) {
        throw new Error(
          '--fail-on must be none, low, moderate, high, or critical',
        );
      }
      failOn = value as FailOn;
    }
  }
  return {
    base,
    head,
    repositoryRoot,
    ...(configPath === undefined ? {} : { configPath }),
    ...(coveragePath === undefined ? {} : { coveragePath }),
    format,
    failOn,
  };
}

function failsPolicy(classification: RiskLevel, failOn: FailOn): boolean {
  return (
    failOn !== 'none' &&
    levels.indexOf(classification) >= levels.indexOf(failOn)
  );
}

export async function runCli(
  args: readonly string[],
  workingDirectory: string,
): Promise<CliResult> {
  try {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      return { stdout: HELP, stderr: '', exitCode: 0 };
    }
    if (args[0] === '--version') {
      return { stdout: `${VERSION}\n`, stderr: '', exitCode: 0 };
    }
    if (args[0] !== 'analyze') {
      throw new Error(`Unknown command: ${args[0]}`);
    }
    if (args[1] === '--help' || args[1] === '-h') {
      return { stdout: HELP, stderr: '', exitCode: 0 };
    }
    const parsed = parseAnalyzeArguments(args.slice(1), workingDirectory);
    const analysis = await analyzeRepositoryWithArtifacts({
      repositoryRoot: parsed.repositoryRoot,
      base: parsed.base,
      head: parsed.head,
      ...(parsed.configPath === undefined
        ? {}
        : { configPath: parsed.configPath }),
      ...(parsed.coveragePath === undefined
        ? {}
        : { coveragePath: parsed.coveragePath }),
    });
    const { result } = analysis;
    const stdout =
      parsed.format === 'json'
        ? renderJsonReport(result)
        : parsed.format === 'html'
          ? renderHtmlReport(
              result,
              analysis.blastRadius === undefined
                ? {}
                : { blastRadius: analysis.blastRadius },
            )
          : renderTerminalReport(result);
    return {
      stdout,
      stderr: '',
      exitCode: failsPolicy(result.classification, parsed.failOn) ? 2 : 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return { stdout: '', stderr: `change-risk: ${message}\n`, exitCode: 1 };
  }
}
