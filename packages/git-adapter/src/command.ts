import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'GitCommandError';
  }
}

export async function runGit(
  repositoryRoot: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<string> {
  const cwd = await realpath(repositoryRoot).catch(() => {
    throw new GitCommandError(
      'Repository root does not exist or cannot be read',
    );
  });

  try {
    const { stdout } = await execFileAsync('git', [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: timeoutMs,
      windowsHide: true,
    });
    return stdout;
  } catch {
    throw new GitCommandError(
      'Git could not collect the requested repository evidence',
    );
  }
}
