import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repositoryRoot, 'action-dist/index.js');
const result = await build({
  alias: Object.fromEntries(
    [
      ['cli', 'apps/cli'],
      ['config', 'packages/config'],
      ['core', 'packages/core'],
      ['dependency-graph', 'packages/dependency-graph'],
      ['git-adapter', 'packages/git-adapter'],
      ['language-typescript', 'packages/language-typescript'],
      ['plugin-sdk', 'packages/plugin-sdk'],
      ['reporters', 'packages/reporters'],
      ['rules', 'packages/rules'],
    ].map(([name, path]) => [
      `@change-risk/${name}`,
      join(repositoryRoot, path, 'src/index.ts'),
    ]),
  ),
  entryPoints: [join(repositoryRoot, 'apps/github-action/src/run.ts')],
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; import { fileURLToPath as __fileURLToPath } from "node:url"; import { dirname as __pathDirname } from "node:path"; const require = __createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __pathDirname(__filename);',
  },
  bundle: true,
  format: 'esm',
  legalComments: 'none',
  minify: true,
  platform: 'node',
  target: ['node24'],
  write: false,
});
const bundled = result.outputFiles?.[0]?.contents;
if (bundled === undefined)
  throw new Error('Action bundling returned no output');

if (process.argv.includes('--check')) {
  const committed = await readFile(outputPath).catch(() => undefined);
  if (committed === undefined || !committed.equals(bundled)) {
    throw new Error(
      'action-dist/index.js is stale; run npm run package:action',
    );
  }
  process.stdout.write('verified action-dist/index.js\n');
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bundled);
  process.stdout.write(`${outputPath}\n`);
}
