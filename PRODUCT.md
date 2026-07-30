# Product Specification

## Problem

Pull requests are often reviewed as changed lines, while risk depends on repository context: dependency reach, public interfaces, sensitive areas, tests, migrations, and infrastructure. Existing tools usually cover only one category.

This project combines repository evidence into an explainable heuristic report without requiring an LLM.

## Users

- open-source maintainers;
- backend and platform teams;
- pull-request reviewers;
- teams using coding agents;
- individual developers seeking stronger CI feedback.

## Core jobs

Users can:

1. compare base and head revisions;
2. classify changed files;
3. inspect direct and transitive dependents;
4. identify sensitive or central modules;
5. examine test evidence;
6. apply repository policies;
7. identify changed paths without a declared code owner;
8. relate caller-supplied line coverage to changed source files;
9. receive explainable findings and classification;
10. use the result locally and in CI.

## MVP command

```bash
change-risk analyze --base main --head HEAD
```

## Initial signals

### Change shape

- changed files and lines;
- multiple top-level areas;
- code/test/docs ratio;
- generated and lockfile changes;
- rename and deletion patterns.

### Dependency impact

- fan-in;
- direct and transitive dependents;
- shared modules;
- public export changes;
- package-boundary crossing.

### Sensitive areas

Configurable patterns for authentication, authorization, infrastructure, migrations, public API, CI/CD, and shared configuration.

### Test evidence

- related tests changed;
- no tests for affected central modules;
- bounded caller-supplied LCOV line evidence;
- explicit missing, zero-measurable, and below-threshold changed sources;
- exact-revision new-side changed-line coverage when measurable;
- broad implementation changes with only snapshot updates.

### Ownership evidence

- bounded `.github/CODEOWNERS` policy;
- deterministic last-match-wins changed-path owners;
- explicit unowned changed paths;
- limitations instead of findings when ownership input is incomplete.

### Policies

Examples:

- migrations require rollback notes;
- public API changes require changelog;
- infrastructure changes require approval;
- auth changes require integration tests;
- dependencies require review.

## Explainable scoring

All positive and mitigating contributions are visible. Weights and thresholds are configurable. Findings remain visible even when the aggregate classification is low.

## Outputs

- terminal;
- JSON;
- self-contained HTML report;
- GitHub pull-request comment;
- configurable exit code;
- optional SARIF-like output when semantically appropriate.

## Acceptance criteria

The first release can analyze a TypeScript repository between revisions, build an import graph, calculate blast radius, apply at least eight deterministic rules, explain every contribution, load configuration, output terminal/JSON reports, run in GitHub Actions, and analyze its own repository.

Status: implemented. Phases 0 through 12 are complete, including the GitHub
Action, static and graph visualization, GitLab CI usage, and trusted-host
extension contracts. Phase 7 adds conservative changed-path ownership evidence.
Phase 8 adds conservative supplied LCOV line evidence without changing result
schema version 1 or the default no-execution boundary. Phase 9 refines that
evidence with bounded exact-revision changed-line ranges and one combined
coverage contribution. Phase 10 adds an optional caller-supplied baseline LCOV
comparison with rename-aware mapping and preserves the same combined coverage
contribution. Phase 11 defines and automates first-release readiness, licensing,
compatibility review, and standalone-artifact verification. The accepted
baseline was published as
[`v0.1.0`](https://github.com/blacwh/change-risk-engine/releases/tag/v0.1.0) on
2026-07-30. Phase 12 adds explicit, composable built-in policy defaults without
external loading or a result schema change.

Phase 13 is planned, not implemented. It adds Python through a bounded,
non-executing adapter and explicit single-language selection in separate
foundation and stock-integration packets. Current capability-by-language
details are the source of truth in
[language support](docs/language-support.md).

## Boundaries

The tool is an aid, not a safety guarantee, security-scanner replacement, AI reviewer, or production-incident predictor.

## Future

Python is the selected next adapter direction. Languages beyond Python,
history-informed calibration, interactive hosted visualization, isolated
third-party plugin hosting, and optional local summaries constrained to
deterministic findings remain future candidates.
