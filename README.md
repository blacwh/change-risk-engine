# Repository Change-Risk Engine

An open-source, explainable engine for estimating the blast radius and delivery risk of a repository change.

It analyzes:

- Git diff;
- changed file categories;
- module dependency graph;
- fan-in and fan-out;
- public API changes;
- tests and coverage evidence;
- migrations;
- infrastructure and CI changes;
- repository-specific policies.

The result is a transparent report. The tool must not present its risk classification as objective truth.

## Project status

The repository foundation is complete. Package boundaries, strict TypeScript,
formatting, linting, tests, builds, and CI are configured. Versioned configuration
and result schemas are available. The Git adapter can safely resolve commit
revisions, and controlled temporary repository fixtures support integration
testing. Changed-file collection includes line statistics, renames, binary files,
and exact analyzed commit IDs. Deterministic file classification plus validated
terminal and JSON report skeletons complete the initial Git-evidence phase.
TypeScript discovery and dependency analysis are next.

## Development

Prerequisites:

- Node.js 20.19+, 22.13+, or 24+;
- npm 11.

Install dependencies and run the complete local quality gate:

```bash
npm ci
npm run quality
```

Individual commands are available for formatting, linting, type checking,
testing, and building:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The repository uses npm workspaces. Applications live in `apps/`, reusable
analysis components live in `packages/`, and repository-level tests live in
`tests/`.

## Initial scope

TypeScript and JavaScript repositories.

## Interfaces

- core library;
- CLI;
- GitHub Action;
- JSON output;
- optional dependency/blast-radius visualizer.

## Non-goals

- replacing code review;
- predicting production incidents;
- generic AI review;
- executing target code by default;
- supporting every language in the first release.
