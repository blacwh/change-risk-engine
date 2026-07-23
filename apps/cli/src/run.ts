#!/usr/bin/env node

import { runCli } from './main.js';

const result = await runCli(process.argv.slice(2), process.cwd());
if (result.stdout.length > 0) process.stdout.write(result.stdout);
if (result.stderr.length > 0) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
