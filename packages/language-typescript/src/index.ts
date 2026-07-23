export { typeScriptLanguageAdapter } from './adapter.js';
export {
  discoverTypeScriptFiles,
  type DiscoveryIssue,
  type DiscoveryOptions,
  type DiscoveryResult,
} from './discovery.js';
export {
  indexTypeScriptProject,
  type ImportKind,
  type ImportReference,
  type IndexIssue,
  type IndexOptions,
  type ModuleIndex,
  type ModuleRecord,
} from './indexer.js';
export {
  loadTypeScriptResolutionConfig,
  resolveModuleIndex,
  resolveTypeScriptProject,
  type ResolvedImportReference,
  type ResolvedModuleIndex,
  type ResolvedModuleRecord,
  type ResolutionConfig,
  type ResolutionIssue,
} from './resolver.js';
export {
  comparePublicExportSurfaces,
  type PublicApiComparison,
  type PublicApiIssue,
  type PublicExportChange,
  type PublicExportRecord,
  type SourceSnapshot,
} from './public-api.js';
export {
  inferConventionalTestRelationships,
  type TestRelationship,
} from './test-relationships.js';
