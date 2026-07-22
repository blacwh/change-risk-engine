import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type FixtureCommit = {
  message: string;
  files: Readonly<Record<string, string | Uint8Array | null>>;
};

export type FixtureRepository = {
  path: string;
  revisions: readonly string[];
  cleanup(): Promise<void>;
};

async function git(
  root: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = {},
): Promise<string> {
  const { stdout } = await execFileAsync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
    windowsHide: true,
  });
  return stdout.trim();
}

function fixturePath(root: string, path: string): string {
  if (path.length === 0 || path.includes('\0') || isAbsolute(path)) {
    throw new Error(`Invalid fixture path: ${path}`);
  }
  const target = resolve(root, normalize(path));
  const fromRoot = relative(root, target);
  if (
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new Error(`Fixture path escapes repository root: ${path}`);
  }
  return target;
}

export async function createFixtureRepository(
  commits: readonly FixtureCommit[],
): Promise<FixtureRepository> {
  if (commits.length === 0)
    throw new Error('A fixture requires at least one commit');
  const root = await mkdtemp(join(tmpdir(), 'change-risk-fixture-'));

  try {
    await git(root, ['init', '--initial-branch=main']);
    await git(root, ['config', 'user.name', 'Change Risk Fixture']);
    await git(root, ['config', 'user.email', 'fixture@example.invalid']);
    const revisions: string[] = [];

    for (const commit of commits) {
      if (commit.message.length === 0)
        throw new Error('Fixture commit messages cannot be empty');
      for (const [path, contents] of Object.entries(commit.files)) {
        const target = fixturePath(root, path);
        if (contents === null) await rm(target, { force: true });
        else {
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, contents, 'utf8');
        }
      }
      await git(root, ['add', '--all']);
      await git(root, ['commit', '--message', commit.message, '--quiet'], {
        GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
        GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
      });
      revisions.push(await git(root, ['rev-parse', 'HEAD']));
    }

    return {
      path: root,
      revisions,
      cleanup: () => rm(root, { force: true, recursive: true }),
    };
  } catch (error) {
    await rm(root, { force: true, recursive: true });
    throw error;
  }
}
