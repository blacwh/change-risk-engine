export const FILE_CATEGORIES = [
  'source',
  'test',
  'documentation',
  'dependency',
  'lockfile',
  'generated',
  'infrastructure',
  'ci',
  'migration',
  'configuration',
  'asset',
  'other',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];
export type ClassifiableFile = { path: string };
export type ClassifiedFile<T extends ClassifiableFile> = T & {
  categories: readonly FileCategory[];
};

export type ClassificationLanguage = 'python' | 'typescript';
export type ClassificationOptions = {
  language?: ClassificationLanguage;
};

const typeScriptSourceExtension = /\.(?:[cm]?[jt]sx?|vue|svelte)$/u;
const typeScriptTestPath =
  /(?:^|\/)(?:__tests__|test|tests|spec)(?:\/|$)|\.(?:test|spec)\.[^/]+$/u;
const pythonSourceExtension = /\.pyi?$/u;
const pythonTestPath =
  /(?:^|\/)tests\/[^]*\.py$|(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/u;
const documentationPath =
  /(?:^|\/)docs?(?:\/|$)|(?:^|\/)(?:readme|changelog|contributing|license)(?:\.[^/]*)?$|\.mdx?$/u;
const generatedPath =
  /(?:^|\/)(?:dist|build|coverage|generated|vendor)(?:\/|$)|\.generated\.[^/]+$/u;
const infrastructurePath =
  /(?:^|\/)(?:dockerfile(?:\.[^/]*)?|compose\.ya?ml|k8s|kubernetes|terraform)(?:\/|$)|\.tf(?:vars)?$/u;
const ciPath =
  /(?:^|\/)(?:\.github\/workflows|\.circleci)(?:\/|$)|(?:^|\/)(?:\.gitlab-ci|azure-pipelines)\.ya?ml$/u;
const migrationPath = /(?:^|\/)(?:migrations?|prisma\/migrations)(?:\/|$)/u;
const assetExtension =
  /\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|mp3|mp4|wav)$/u;
const configPath =
  /(?:^|\/)(?:tsconfig(?:\.[^/]*)?\.json|eslint\.config\.[^/]+|vite\.config\.[^/]+|vitest\.config\.[^/]+|\.editorconfig|\.prettierrc(?:\.[^/]+)?|[^/]+\.config\.[^/]+)$/u;

export function classifyFile(
  path: string,
  options: ClassificationOptions = {},
): readonly FileCategory[] {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf('/') + 1);
  const categories = new Set<FileCategory>();
  const language = options.language ?? 'typescript';

  if (
    (language === 'python'
      ? pythonSourceExtension
      : typeScriptSourceExtension
    ).test(normalized)
  ) {
    categories.add('source');
  }
  if (
    (language === 'python' ? pythonTestPath : typeScriptTestPath).test(
      normalized,
    )
  ) {
    categories.add('test');
  }
  if (documentationPath.test(normalized)) categories.add('documentation');
  if (
    ['package.json', 'deno.json', 'deno.jsonc', 'bun.lock'].includes(basename)
  ) {
    categories.add('dependency');
  }
  if (
    /^(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/u.test(
      basename,
    )
  ) {
    categories.add('dependency');
    categories.add('lockfile');
  }
  if (generatedPath.test(normalized)) categories.add('generated');
  if (infrastructurePath.test(normalized)) categories.add('infrastructure');
  if (ciPath.test(normalized)) categories.add('ci');
  if (migrationPath.test(normalized)) categories.add('migration');
  if (configPath.test(normalized)) categories.add('configuration');
  if (assetExtension.test(normalized)) categories.add('asset');
  if (categories.size === 0) categories.add('other');

  return FILE_CATEGORIES.filter((category) => categories.has(category));
}

export function classifyChangedFiles<T extends ClassifiableFile>(
  files: readonly T[],
  options: ClassificationOptions = {},
): readonly ClassifiedFile<T>[] {
  return files.map((file) => ({
    ...file,
    categories: classifyFile(file.path, options),
  }));
}
