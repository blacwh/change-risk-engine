import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import {
  parseChangeRiskConfig,
  type ChangeRiskConfig,
} from '@change-risk/config';

const DEFAULT_CONFIG_PATH = '.change-risk.json';

export async function loadRepositoryConfig(
  repositoryRoot: string,
  configPath: string | undefined,
): Promise<ChangeRiskConfig> {
  const root = await realpath(repositoryRoot).catch(() => {
    throw new Error('Repository root does not exist or cannot be read');
  });
  const relativePath = configPath ?? DEFAULT_CONFIG_PATH;
  if (relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new Error('Configuration path must be repository-relative');
  }
  const target = resolve(root, relativePath);
  const fromRoot = relative(root, target);
  if (
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new Error('Configuration path must remain inside the repository');
  }

  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (
      configPath === undefined &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return parseChangeRiskConfig({ schemaVersion: 1 });
    }
    throw new Error('Configuration file could not be opened', { cause: error });
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > 1_000_000) {
      throw new Error('Configuration file must be a regular file under 1 MB');
    }
    const source = await handle.readFile('utf8');
    let input: unknown;
    try {
      input = JSON.parse(source) as unknown;
    } catch {
      throw new Error('Configuration file is not valid JSON');
    }
    return parseChangeRiskConfig(input);
  } finally {
    await handle.close().catch(() => undefined);
  }
}
