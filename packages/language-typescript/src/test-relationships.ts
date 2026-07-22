import { posix } from 'node:path';

export type TestRelationship = {
  sourcePath: string;
  testPaths: readonly string[];
};

const testPath =
  /(?:^|\/)(?:__tests__|test|tests|spec)(?:\/|$)|\.(?:test|spec)\.[^/]+$/u;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relationshipKey(path: string): string {
  const withoutExtension = path.replace(/(?:\.d)?\.[cm]?[jt]sx?$/u, '');
  const withoutTestMarker = withoutExtension.replace(/\.(?:test|spec)$/u, '');
  return withoutTestMarker
    .split('/')
    .filter(
      (part) => !['__tests__', 'spec', 'src', 'test', 'tests'].includes(part),
    )
    .join('/');
}

export function inferConventionalTestRelationships(
  modulePaths: readonly string[],
): readonly TestRelationship[] {
  if (modulePaths.length > 100_000)
    throw new Error('Module path limit exceeded');
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
        posix.normalize(path) !== path,
    )
  ) {
    throw new Error('Module paths must be bounded repository paths');
  }
  if (new Set(modulePaths).size !== modulePaths.length) {
    throw new Error('Module paths must be unique');
  }
  const testsByKey = new Map<string, string[]>();
  for (const path of modulePaths.filter((candidate) =>
    testPath.test(candidate),
  )) {
    const key = relationshipKey(path);
    const tests = testsByKey.get(key) ?? [];
    tests.push(path);
    testsByKey.set(key, tests);
  }
  return modulePaths
    .filter((path) => !testPath.test(path))
    .sort(compareText)
    .map((sourcePath) => ({
      sourcePath,
      testPaths: [...(testsByKey.get(relationshipKey(sourcePath)) ?? [])].sort(
        compareText,
      ),
    }));
}
