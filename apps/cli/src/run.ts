#!/usr/bin/env node

import { writeSync } from 'node:fs';

import { runCli } from './main.js';

function write(fileDescriptor: number, output: string): void {
  const bytes = Buffer.from(output, 'utf8');
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(
      fileDescriptor,
      bytes,
      offset,
      bytes.length - offset,
    );
    if (written === 0) throw new Error('Output stream accepted no data');
    offset += written;
  }
}

const result = await runCli(process.argv.slice(2), process.cwd());
write(process.stdout.fd, result.stdout);
write(process.stderr.fd, result.stderr);
process.exitCode = result.exitCode;
