#!/usr/bin/env node

import { runGitHubAction } from './main.js';

try {
  const result = await runGitHubAction();
  process.exitCode = result.exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown failure';
  process.stderr.write(`change-risk action: ${message}\n`);
  process.exitCode = 1;
}
