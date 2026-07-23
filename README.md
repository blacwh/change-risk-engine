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
The TypeScript adapter now performs bounded source discovery and static import
indexing without loading target configuration or dependencies. Incomplete reads,
syntax errors, skipped symlinks, and reached limits are returned as explicit
issues. Repository module resolution covers relative paths, directory indexes,
TypeScript substitution for JavaScript extensions, and bounded root
`tsconfig.json` aliases. Missing internal references are explicit issues;
unmatched bare package imports remain external. The directed graph exposes
fan-in, fan-out, direct and bounded transitive
dependents, strongly connected components, cycles, and package-boundary
crossings. Phase 2 is complete; deterministic rules and transparent scoring are
the current phase. The rule engine now emits stable evidence and finding IDs,
supports per-rule enablement, options, and weight overrides, and includes the
large-change, multi-area, sensitive-path, dependency-manifest, migration, and
infrastructure policies. High-fan-in analysis consumes the bounded dependency
graph to expose direct and transitive blast radius, and public-export policy
consumes explicit public-surface comparison evidence. Public-surface comparison,
and test-relationship evidence feed two test-aware policies. Transparent scoring
groups every finding by rule, applies visible positive and mitigating weights,
caps the total at zero, and classifies it with configured thresholds. The Phase
3 rule/scoring layer is complete. Resolved-revision file reads now support
bounded public-surface comparison without checking out or executing target code,
and conventional source-to-test mapping supplies explicit relationship evidence.
Phase 3 is complete; end-to-end CLI composition is next.

The initial Phase 4 CLI now composes those capabilities through `change-risk
analyze`, with terminal or JSON output and an optional classification exit gate.
Release packaging, examples, and self-analysis automation remain before Phase 4
is complete.

## Usage

Build and analyze a repository between two revisions:

```bash
npm run build
node apps/cli/dist/run.js analyze --base main --head HEAD
```

Use `--format json` for the versioned machine-readable result. `--fail-on high`
returns exit code 2 for high or critical classifications; operational and input
errors return 1. Run `node apps/cli/dist/run.js --help` for all options.

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
