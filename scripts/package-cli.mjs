import { execFile } from 'node:child_process';
import {
  access,
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

function execFileAsync(file, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error !== null) rejectPromise(error);
      else resolvePromise({ stdout, stderr });
    });
  });
}
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(repositoryRoot, 'dist');
const packageRoot = join(outputRoot, 'release');
const cliManifest = JSON.parse(
  await readFile(join(repositoryRoot, 'apps/cli/package.json'), 'utf8'),
);
const rootManifest = JSON.parse(
  await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
);
if (
  typeof rootManifest.license !== 'string' ||
  rootManifest.license.trim().length === 0
) {
  throw new Error('Root package.json must declare an SPDX license');
}
const licenseText = await readFile(
  join(repositoryRoot, 'LICENSE'),
  'utf8',
).catch(() => {
  throw new Error('Root LICENSE file is required for packaging');
});
if (licenseText.trim().length === 0) {
  throw new Error('Root LICENSE file cannot be empty');
}
const requestedVersion = process.env.RELEASE_VERSION ?? cliManifest.version;
const version = requestedVersion.replace(/^v/u, '');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error('RELEASE_VERSION must be a v-prefixed or plain semver');
}

await rm(outputRoot, { force: true, recursive: true });
await mkdir(packageRoot, { recursive: true });
const executable = join(packageRoot, 'change-risk.js');
await build({
  entryPoints: [join(repositoryRoot, 'apps/cli/src/run.ts')],
  outfile: executable,
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; import { fileURLToPath as __fileURLToPath } from "node:url"; import { dirname as __pathDirname } from "node:path"; const require = __createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __pathDirname(__filename);',
  },
  bundle: true,
  define: { __CHANGE_RISK_VERSION__: JSON.stringify(version) },
  format: 'esm',
  legalComments: 'none',
  minify: false,
  platform: 'node',
  target: ['node20.19'],
});
await chmod(executable, 0o755);

await writeFile(
  join(packageRoot, 'package.json'),
  `${JSON.stringify(
    {
      name: 'change-risk-engine',
      version,
      description: rootManifest.description,
      type: 'module',
      bin: { 'change-risk': './change-risk.js' },
      engines: rootManifest.engines,
      license: rootManifest.license,
      repository: {
        type: 'git',
        url: 'git+https://github.com/blacwh/change-risk-engine.git',
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(join(packageRoot, 'LICENSE'), licenseText, 'utf8');
await writeFile(
  join(packageRoot, 'README.md'),
  `# Change Risk Engine CLI\n\nDeterministic repository change-risk analysis.\n\n\`\`\`bash\nchange-risk analyze --base main --head HEAD\n\`\`\`\n\nSee https://github.com/blacwh/change-risk-engine for configuration, security boundaries, and documentation.\n`,
  'utf8',
);

await execFileAsync(
  'npm',
  ['pack', packageRoot, '--pack-destination', outputRoot, '--silent'],
  { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
);
const archive = join(outputRoot, `change-risk-engine-${version}.tgz`);
await access(archive).catch(() => {
  throw new Error('npm pack returned no artifact');
});
process.stdout.write(`${archive}\n`);
