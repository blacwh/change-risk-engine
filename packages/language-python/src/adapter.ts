import type { LanguageAdapter } from '@change-risk/plugin-sdk';

import { resolvePythonProject } from './resolver.js';

export const pythonLanguageAdapter: LanguageAdapter = Object.freeze({
  id: 'python',
  canHandle: (path: string) => /\.pyi?$/u.test(path),
  indexRepository: (repositoryRoot, limits) =>
    resolvePythonProject(repositoryRoot, limits),
});
