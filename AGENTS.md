# AI Agent Instructions

## Mission

Build a deterministic, explainable Repository Change-Risk Engine. Do not turn it into an AI reviewer, opaque scoring service, or tool that executes untrusted repository code by default.

## Read first

1. `PRODUCT.md`
2. `ARCHITECTURE.md`
3. `ROADMAP.md`
4. `BACKLOG.md`
5. `docs/agent-workflow.md` for continuous or autonomous work
6. relevant ADRs, rules, fixtures, and source

Before coding, inspect current capabilities, gaps, task scope, risks, affected contracts, and verification commands.

## Invariants

- every finding cites evidence;
- every score contribution is visible;
- same revisions and config yield the same result;
- target code is not executed by default;
- TypeScript/JavaScript comes first;
- CLI and CI use the same core;
- parse failures reduce confidence explicitly;
- the tool assists review and never declares safety;
- no AI API is required.

## Engineering rules

- strict TypeScript;
- separate Git, parsing, graph, rules, and reporting;
- validate configuration;
- small testable rules;
- fixture repositories for integration tests;
- safe subprocess argument handling;
- no secrets or unnecessary source content in reports;
- bounded graph traversal;
- versioned machine-readable output;
- document false-positive and false-negative risks.

## Workflow

1. Restate acceptance criteria.
2. Inspect implementation and fixtures.
3. Identify affected contracts.
4. Define one bounded work packet and its verification plan.
5. Add unit and fixture tests.
6. Run format, lint, type check, tests, and builds.
7. Review the diff.
8. Update documentation.
9. Commit, open a pull request, wait for required checks, and merge only when
   the user has authorized repository publishing.
10. Synchronize the default branch and summarize changes, evidence, tests,
    limitations, and follow-ups.

For continuous work, follow the four-hour run protocol, packet limits, merge
checkpoints, stop rules, and verification matrix in
`docs/agent-workflow.md`. Do not start work merely because it appears in
`ROADMAP.md` or `BACKLOG.md`; select only a packet that is ready and fits the
remaining run budget.

## Required docs

Maintain `README.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `BACKLOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/agent-workflow.md`, `docs/adr`, `docs/configuration.md`, `docs/rules`, `docs/output-schema.md`, and `docs/fixtures.md`.

## Completed initial sequence

The initial capability sequence below is historical context, not an active work
queue. Before another continuous run, define a ready packet in `BACKLOG.md` with
acceptance criteria as described in `docs/agent-workflow.md`.

1. foundation and CI;
2. config and output schemas;
3. Git diff evidence;
4. file classification;
5. TypeScript imports;
6. dependency graph;
7. blast radius;
8. deterministic rules;
9. terminal and JSON reports;
10. CLI;
11. GitHub Action;
12. self-analysis;
13. optional visualization.

## Prohibited shortcuts

- random or LLM-generated scores;
- unexplained thresholds;
- silent parse failures;
- unsafe shell interpolation;
- dependency installation in target repositories;
- GitHub integration before a credible CLI/core;
- broad language support before the first adapter is reliable.
