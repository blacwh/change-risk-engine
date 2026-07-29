# Prioritized Backlog

## P0

- [x] Package structure and CI
- [x] Strict TypeScript and quality commands
- [x] Versioned result schema
- [x] Versioned configuration schema
- [x] Fixture repository framework
- [x] Git revision resolution
- [x] Name-status and numstat
- [x] Rename and binary handling
- [x] File classification
- [x] TypeScript/JavaScript discovery
- [x] Static import parsing
- [x] Relative and tsconfig alias resolution
- [x] Unresolved import reporting
- [x] Directed dependency graph
- [x] Fan-in, fan-out, direct and transitive dependents

## P1

- [x] Large-change rule
- [x] Multi-area rule
- [x] High-fan-in rule
- [x] Sensitive-path rule
- [x] Public-export rule
- [x] Dependency-manifest rule
- [x] Migration rule
- [x] Infrastructure rule
- [x] Missing-related-tests rule
- [x] Tests-added mitigation
- [x] Transparent score breakdown
- [x] Terminal and JSON reporters
- [x] CLI commands and exit policy

## P2

- [x] GitHub Action
- [x] PR Markdown reporter
- [x] Comment update behavior
- [x] JSON artifact
- [x] Fork security
- [x] Static HTML report viewer
- [x] Dependency graph and blast-radius visualization
- [x] Visualization
- [x] GitLab CI integration example
- [x] Adapter and plugin extension contracts
- [x] Release automation

## P3 — Ownership evidence

- [x] Deterministic, bounded root `.github/CODEOWNERS` parsing
- [x] Last-match-wins ownership mapping for changed paths
- [x] Evidence-backed missing-owner rule with configurable weight
- [x] CLI and GitHub Action ownership integration
- [x] Positive, negative, malformed, limit, symlink, ordering, and determinism tests

Acceptance criteria:

- the analyzer reads only a root `.github/CODEOWNERS` file from the analyzed
  head worktree, without following symlinks or executing repository code;
- parser input, rule count, line length, pattern length, and owner count are
  bounded, malformed or unsupported lines produce explicit issues, and no
  source content is exposed in limitations;
- supported patterns are matched deterministically in file order with the last
  matching rule taking precedence, and every changed path receives an explicit
  owned or unowned relationship when trustworthy ownership evidence is
  available;
- a built-in `missing-owner` rule emits evidence-backed findings only for
  changed paths with no matched owners, supports normal rule configuration, and
  documents purpose, evidence, default weight, remediation, and false-positive
  and false-negative risks;
- CLI, GitHub Action, terminal, JSON, Markdown, and HTML paths continue to use
  the shared version 1 result without a schema change;
- focused positive, negative, malformed, limit, symlink, ordering, integration,
  and repeat-run determinism tests pass together with `npm run quality`,
  distributable CLI verification, Action packaging verification, and
  `git diff --check`.

Affected contracts: ownership parser and matcher, rule context and built-in rule
registry, CLI orchestration, trusted programmatic rule hosts, configuration
documentation, fixture coverage, security boundary, and architecture.

Non-goals: GitHub team membership lookup, owner availability or approval
verification, ownership scoring based on team size, non-GitHub ownership file
formats, fetching CODEOWNERS from a different revision, automatic reviewer
assignment, and result schema version 2.

## Next planning cycle

The ownership-evidence packet is complete. Before starting another implementation
run, add a prioritized item with acceptance criteria, affected contracts,
explicit non-goals, documentation impact, and verification. Size it as a work
packet using [`docs/agent-workflow.md`](docs/agent-workflow.md); do not treat
unprioritized directions in `ROADMAP.md` as implementation authorization.
