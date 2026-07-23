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
7. receive explainable findings and classification;
8. use the result locally and in CI.

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
- coverage evidence when supplied;
- broad implementation changes with only snapshot updates.

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

Status: implemented through the Phase 5 GitHub Action milestone. Visualization
and additional ecosystem integrations remain post-MVP work.

## Boundaries

The tool is an aid, not a safety guarantee, security-scanner replacement, AI reviewer, or production-incident predictor.

## Future

Additional language adapters, coverage mapping, ownership, history-informed calibration, visualization, GitLab integration, plugin SDK, and optional local summaries constrained to deterministic findings.
