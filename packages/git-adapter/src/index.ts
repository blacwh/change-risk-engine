export { GitCommandError } from './command.js';
export { readFileAtRevision, type ReadRevisionFileOptions } from './content.js';
export {
  collectChangedFiles,
  type CollectChangedFilesOptions,
  type GitChangedFile,
  type GitDiff,
} from './diff.js';
export { resolveRevision, type ResolveRevisionOptions } from './revision.js';
export { worktreeMatchesRevision } from './worktree.js';
