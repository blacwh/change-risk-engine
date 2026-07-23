# ADR 0003: Standalone CLI Release Artifact

## Status

Accepted

## Context

The CLI composes private workspace packages that are not independently
published. Packing only `apps/cli` would create an artifact whose internal
dependencies cannot be installed outside this monorepo. Publishing every
workspace would expand the public package/versioning surface before those
boundaries are ready.

## Decision

Bundle the CLI and all runtime dependencies into a single Node.js ESM entrypoint
with esbuild. Provide a `createRequire`/filename prelude for the TypeScript
compiler's CommonJS internals. Inject the validated semantic version from the
release tag, package the entrypoint as an npm-compatible tarball, publish it as a
checksummed GitHub release asset, and do not publish internal workspaces.

Every release build must install the tarball into a fresh temporary prefix,
capture the installed version through a pipe, and produce a valid JSON analysis
before release creation.

## Consequences

- users can install one portable JavaScript tarball without the monorepo;
- internal packages remain private implementation details;
- release tags and executable versions cannot silently diverge;
- the TypeScript compiler makes the artifact larger than the workspace CLI;
- bundle compatibility and piped output are explicit release gates;
- npm registry publishing can be considered later without blocking releases.
