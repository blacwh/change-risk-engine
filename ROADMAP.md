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

Status: complete. A self-contained, no-script HTML viewer renders the
complete versioned analysis result from the CLI. A separate validated companion
model now adds a bounded dependency graph, changed-module seeds, transitive
impact distance, fan-in/fan-out, unindexed paths, and explicit truncation to the
HTML viewer without changing result schema version 1. A GitLab CI template
supplies exact merge-request/push revisions, classification gating, and
always-retained JSON without an API token.
The trusted-host plugin SDK provides versioned, bounded, collision-safe rule and
language-adapter registries without target-repository loading. The built-in
TypeScript indexer implements the adapter contract, and programmatic analysis
accepts explicit rule and adapter selections. Phase 6 is complete.

## Phase 7 — Ownership evidence

Bounded CODEOWNERS parsing, changed-path ownership mapping, missing-owner policy,
and shared CLI/CI reporting.

Status: complete. The analyzer reads the fixed `.github/CODEOWNERS` file only
from a clean head-matching worktree, rejects linked, malformed, unsupported, and
over-limit input, applies supported case-sensitive patterns in file order, and
maps every changed path through the last matching rule. The built-in
`missing-owner` rule emits one transparent evidence-backed finding for unowned
paths and is suppressed when ownership input is incomplete. CLI and GitHub
Action reporting preserve result schema version 1.

## Phase 8 — Supplied coverage evidence

Bounded LCOV parsing, eligible changed-source mapping, insufficient-coverage
policy, and shared CLI/CI reporting.

Status: complete. The analyzer accepts one explicit repository-relative LCOV
artifact, rejects linked, malformed, inconsistent, unsupported, and over-limit
input, and maps every eligible changed source to raw line counts or an explicit
missing record. The configurable `insufficient-coverage` rule aggregates
missing, zero-measurable, and below-threshold paths. CLI and GitHub Action
reporting preserve result schema version 1, do not run target tests, and state
that freshness and revision alignment are not verified.

## Phase 9 — Changed-line coverage evidence

Exact-revision new-side hunk ranges, LCOV line intersection, combined coverage
policy, and conservative fallback.

Status: complete. When coverage is supplied, the analyzer collects bounded
zero-context Git hunks with external diff and textconv disabled, returns only
numeric new-side ranges, and intersects them with LCOV `DA` counters. Reports
distinguish total, instrumented, hit, unmeasurable, pure-deletion, and unavailable
changed-line states. The existing `insufficient-coverage` rule combines
whole-file and changed-line concerns into at most one finding and contribution.
Hunk failure preserves whole-file coverage, and result schema version 1 remains
unchanged.

## Phase 10 — Historical coverage comparison

Caller-supplied baseline LCOV, rename-aware changed-source mapping, combined
coverage regression policy, and conservative fallback.

Status: complete. The CLI and GitHub Action accept one explicit baseline LCOV
artifact alongside head coverage. Eligible renames map through their base-side
paths, and the existing combined coverage rule reports measurable whole-file
regressions without a second score contribution. Baseline failure preserves
valid head whole-file and changed-line evidence. Result schema version 1 and the
offline, no-target-execution boundary remain unchanged.

## Phase 11 — First-release readiness

Release-ready standard, candidate changelog, compatibility and security review,
automated preflight, licensed package contents, and a non-publishing `v0.1.0`
dry run.

Status: complete. The canonical standard and approval record, `v0.1.0`
changelog, pre-tag/tagged preflight, Apache-2.0 source and package licensing,
exact standalone-package verification, checksum verification, and clean
dependency audit are implemented. The release workflow fails closed on missing
readiness evidence. After its exact merged commit passed required and
default-branch checks, the owner approved the public Apache-2.0 release and
[`v0.1.0`](https://github.com/blacwh/change-risk-engine/releases/tag/v0.1.0)
was published on 2026-07-30 with a verified standalone artifact and checksum.

## Phase 12 — Built-in policy packs

Composable, version-controlled built-in policy defaults for common review
postures, with deterministic precedence and shared CLI/CI behavior.

Status: complete. Configuration schema version 1 accepts ordered,
duplicate-free `strict-review` and `security-sensitive` selections. Packs
compose only existing thresholds, sensitive areas, and built-in rule settings
before explicit repository configuration. CLI and Action behavior share the
same resolver and result schema version 1. No pack loads code, files,
dependencies, or network resources.

## Phase 13 — Python adapter

Bounded static Python import indexing, explicit single-language selection, stock
CLI/Action integration, and Python-aware source/test evidence without target
execution.

Status: complete. The private Python adapter implements bounded `.py`/`.pyi`
discovery, non-executing static import parsing, repository-only module
identities, and explicit resolution issues through plugin API version 1.
Configuration, CLI, and Action interfaces explicitly select one stock language;
Python selection adds conditional source classification, conventional test
relationships, graph evidence, and supplied-LCOV eligibility. TypeScript remains
the default, automatic detection and mixed-language graphs remain out of scope,
and scored Python public-surface comparison is deliberately deferred by
[ADR 0015](docs/adr/0015-defer-python-public-surface.md).

## Phase 14 — Historical evaluation and transparent tuning

Versioned offline evaluation contracts, blinded reviewer-attention labels,
repository and temporal holdouts, deterministic aggregate metrics, and an
explicit compatibility gate before any default change.

Status: foundation complete. P10a provides private bounded evaluation input and
summary schemas, deterministic aggregate metrics, stable source-free JSON, and
split/leakage validation over caller-supplied canonical results and blinded
labels. It does not collect repositories, tune defaults, change analyzer
behavior, or add telemetry. The next packet is the authorization-gated blinded
pilot; any qualified tuning decision remains separate. See
[historical evaluation](docs/history-evaluation.md) and
[ADR 0016](docs/adr/0016-history-evaluation-before-default-tuning.md).

## Later

Languages beyond Python, constrained optional summaries, additional policy
packs justified by concrete review needs, and a possible observational Python
declared-name mode with explicit entry points.

These are candidate directions, not a prioritized implementation queue. P10b is
not ready until corpus, sampling, reviewer, retention, and access decisions are
authorized. Select and define any other direction before implementation using
the [continuous agent work protocol](docs/agent-workflow.md).
