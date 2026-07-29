export { GitCommandError } from './command.js';
export { readFileAtRevision, type ReadRevisionFileOptions } from './content.js';
export {
  collectChangedFiles,
  type CollectChangedFilesOptions,
  type GitChangedFile,
  type GitDiff,
} from './diff.js';
export {
  type ChangedLineRange,
  collectChangedLines,
  type CollectChangedLinesOptions,
  type GitChangedLineRelationship,
  type GitChangedLines,
} from './lines.js';
export { resolveRevision, type ResolveRevisionOptions } from './revision.js';
export { worktreeMatchesRevision } from './worktree.js';
