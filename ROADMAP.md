# Roadmap

Capability-based; no calendar or usage-limit assumptions.

## Phase 0 — Foundation

Project structure, strict TypeScript, quality tooling, CI, schemas, ADRs, fixture strategy.

Status: in progress. Project structure, strict TypeScript, quality tooling, CI,
versioned configuration and result schemas, and the initial fixture strategy are
complete. The deterministic fixture repository framework and revision resolution
are also complete. Changed-file evidence, line statistics, renames, and binary
handling are next.

## Phase 1 — Git evidence

Revision resolution, file changes, line statistics, renames, categories, terminal and JSON skeleton.

Status: in progress. Revision resolution, changed-file status, line statistics,
rename detection, and binary handling are complete. File classification and the
initial report skeleton remain.

## Phase 2 — TypeScript graph

Import indexing, resolution, dependency graph, direct/transitive dependents, fan-in/fan-out, package boundaries, incomplete parsing.

## Phase 3 — Rules and scoring

Pluggable rules, sensitive paths, public API, migrations, infrastructure, tests, transparent score breakdown.

## Phase 4 — CLI release

Installable CLI, terminal/JSON output, exit policy, examples, release workflow, self-analysis.

## Phase 5 — GitHub Action

PR analysis, maintained comment, severity gate, minimal permissions, JSON artifact, fork security.

## Phase 6 — Visualization and ecosystem

Dependency graph viewer, blast-radius highlighting, report viewer, adapters, plugins, additional CI systems.

## Later

Coverage, ownership, history-based calibration, policy packs, additional languages, constrained optional summaries.
