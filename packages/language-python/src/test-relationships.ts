import { posix } from 'node:path';

export type PythonTestRelationship = {
  sourcePath: string;
  testPaths: readonly string[];
};

const pythonTestPath =
  /(?:^|\/)tests\/[^]*\.py$|(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/u;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relationshipKey(path: string): string {
  const parts = path.replace(/\.pyi?$/u, '').split('/');
  const filename = parts.pop() ?? '';
  const normalizedFilename = filename
    .replace(/^test_/u, '')
    .replace(/_test$/u, '');
  return [
    ...parts.filter((part) => part !== 'src' && part !== 'tests'),
    normalizedFilename,
  ]
    .filter(Boolean)
    .join('/');
}

export function inferPythonTestRelationships(
  modulePaths: readonly string[],
): readonly PythonTestRelationship[] {
  if (modulePaths.length > 100_000) {
    throw new Error('Module path limit exceeded');
  }
  if (
    modulePaths.some(
      (path) =>
        path.length === 0 ||
        path.length > 4_096 ||
        path.includes('\\') ||
        path.includes('\0') ||
        posix.isAbsolute(path) ||
        path === '..' ||
        path.startsWith('../') ||
        posix.normalize(path) !== path ||
        !/\.pyi?$/u.test(path),
    )
  ) {
    throw new Error('Python module paths must be bounded repository paths');
  }
  if (new Set(modulePaths).size !== modulePaths.length) {
    throw new Error('Module paths must be unique');
  }

  const testsByKey = new Map<string, string[]>();
  for (const path of modulePaths.filter((candidate) =>
    pythonTestPath.test(candidate),
  )) {
    const key = relationshipKey(path);
    const tests = testsByKey.get(key) ?? [];
    tests.push(path);
    testsByKey.set(key, tests);
  }
  return modulePaths
    .filter((path) => !pythonTestPath.test(path))
    .sort(compareText)
    .map((sourcePath) => ({
      sourcePath,
      testPaths: [...(testsByKey.get(relationshipKey(sourcePath)) ?? [])].sort(
        compareText,
      ),
    }));
}
