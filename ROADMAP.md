# Roadmap

Capability-based; no calendar or usage-limit assumptions.

## Phase 0 — Foundation

Project structure, strict TypeScript, quality tooling, CI, schemas, ADRs, fixture strategy.

Status: complete. Project structure, strict TypeScript, quality tooling, CI,
versioned configuration and result schemas, and the initial fixture strategy are
complete, including the deterministic fixture repository framework.

## Phase 1 — Git evidence

Revision resolution, file changes, line statistics, renames, categories, terminal and JSON skeleton.

Status: complete. Revision resolution, changed-file status, line statistics,
rename detection, binary handling, deterministic file classification, and the
initial validated terminal/JSON report skeleton are complete.

## Phase 2 — TypeScript graph

Import indexing, resolution, dependency graph, direct/transitive dependents, fan-in/fan-out, package boundaries, incomplete parsing.

Status: complete. Bounded TypeScript/JavaScript discovery and static import
indexing are complete with explicit syntax, symlink, read, size, and traversal
issues. Repository-only relative, index, extension-substitution, `baseUrl`, and
`paths` resolution are complete with unresolved-import evidence. Directed graph
analysis is complete, including fan-in/fan-out, bounded dependents, iterative
cycle detection, and caller-supplied package-boundary crossings.

## Phase 3 — Rules and scoring

Pluggable rules, sensitive paths, public API, migrations, infrastructure, tests, transparent score breakdown.

Status: complete. The deterministic rule engine and its stable evidence
linking are complete. Large-change, multi-area, sensitive-path,
dependency-manifest, migration, and infrastructure policies are implemented and
documented. High-fan-in blast-radius and public-export evidence policies are
also implemented. Explicit test-relationship policy, related-tests mitigation,
and nonnegative transparent score aggregation are complete. The Phase 3 rule
and scoring layer is complete. Resolved-revision source reads, bounded syntactic
public-export comparison, and conventional test-relationship evidence complete
the inputs required for CLI composition.

## Phase 4 — CLI release

Installable CLI, terminal/JSON output, exit policy, examples, release workflow, self-analysis.

Status: complete. The installable `change-risk analyze` command composes
configuration, exact Git diff/public-surface evidence, safe head-worktree graph
and test evidence, all default rules, transparent scoring, terminal/JSON output,
and classification-based exit policy. Standalone bundled tarballs are verified
through a fresh install, tag versions are injected into the executable, examples
are documented, CI uploads repository self-analysis JSON, and tag pushes create
checksummed GitHub releases.

## Phase 5 — GitHub Action

PR analysis, maintained comment, severity gate, minimal permissions, JSON artifact, fork security.

Status: complete. The bundled Node 24 Action analyzes pull-request and push event
revisions through the same core as the CLI, writes the complete validated JSON
result, publishes outputs and a job summary, maintains one bot-owned comment for
same-repository pull requests, and applies the configured classification gate
after reporting. Fork pull requests never invoke the comments API. The
self-analysis workflow exercises the committed bundle with non-persistent
checkout credentials and uploads its JSON artifact.

## Phase 6 — Visualization and ecosystem

Dependency graph viewer, blast-radius highlighting, report viewer, adapters, plugins, additional CI systems.

Status: in progress. A self-contained, no-script HTML viewer now renders the
complete versioned analysis result from the CLI. Dependency-graph and
blast-radius visualization are the next visualization milestone.

## Later

Coverage, ownership, history-based calibration, policy packs, additional languages, constrained optional summaries.
