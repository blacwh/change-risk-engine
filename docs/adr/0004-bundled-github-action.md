# ADR 0004: Bundled GitHub Action and Fork Write Boundary

## Status

Accepted

## Context

The GitHub integration must use the same analysis contracts as the CLI, work
without installing target dependencies, preserve complete machine-readable
evidence, and avoid repository writes for untrusted fork pull requests. A
source-only JavaScript Action cannot run until its workspace packages and
external dependencies are installed.

## Decision

Bundle the Action and runtime dependencies into a committed, minified Node 24
ESM entrypoint. Rebuild that entrypoint from workspace source and compare it
byte-for-byte during the quality gate.

Derive base, head, pull-request number, and repository identity from a bounded
event payload. Produce JSON, outputs, and job summary before any severity gate.
For same-repository pull requests only, create or update a marker-bearing comment
owned by `github-actions[bot]`. Never invoke the comments API for a fork pull
request. Keep artifact upload in the caller workflow so retention policy remains
under repository-owner control.

## Consequences

- `uses:` runs without npm installation or target-code execution;
- source and generated bundle must change together;
- the committed bundle is large because it includes the TypeScript parser;
- fork analysis remains useful but intentionally has no maintained comment;
- callers need `pull-requests: write` only when same-repository comments are on;
- JSON artifact retention and immutable Action pinning remain caller decisions.

