import type { LanguageAdapter } from '@change-risk/plugin-sdk';

import { resolveTypeScriptProject } from './resolver.js';

export const typeScriptLanguageAdapter: LanguageAdapter = Object.freeze({
  id: 'typescript',
  canHandle: (path: string) => /\.(?:(?:d\.)?[cm]?[jt]sx?)$/iu.test(path),
  indexRepository: (repositoryRoot, limits) =>
    resolveTypeScriptProject(repositoryRoot, limits),
});
