# Repository Change-Risk Engine

An open-source, explainable engine for estimating the blast radius and delivery risk of a repository change.

It analyzes:

- Git diff;
- changed file categories;
- module dependency graph;
- fan-in and fan-out;
- public API changes;
- tests and coverage evidence;
- CODEOWNERS coverage for changed paths;
- migrations;
- infrastructure and CI changes;
- repository-specific policies.

The result is a transparent report. The tool must not present its risk classification as objective truth.

Licensed under the [Apache License 2.0](LICENSE).

## Project status

Phases 0 through 12 are complete. The engine safely collects exact Git evidence,
indexes TypeScript/JavaScript imports, builds a bounded dependency graph, applies
deterministic evidence-backed rules, and exposes every effective score
contribution. The installable CLI and bundled GitHub Action use the same core.
Release automation verifies fresh CLI installs, while repository self-analysis
exercises the Action and retains the complete versioned JSON report. Phase 6,
visualization and ecosystem integrations, is complete. The static HTML report
viewer includes a bounded dependency graph with changed modules and transitive
blast-radius distance highlighted. GitLab CI guidance and trusted-host rule and
language-adapter plugin contracts complete the initial ecosystem layer. Phase 7
adds bounded, last-match-wins `.github/CODEOWNERS` mapping and an
evidence-backed missing-owner rule. Phase 8 adds caller-supplied, bounded LCOV
line-coverage mapping and an insufficient-coverage rule. Invalid or unavailable
ownership and coverage inputs are reported as limitations instead of becoming
risk claims. Phase 9 intersects LCOV counters with bounded exact-revision
new-side Git ranges, preserving whole-file evidence when hunk refinement is
unavailable. Phase 10 optionally compares a second caller-supplied baseline LCOV
artifact, maps renamed sources through their base-side paths, and reports
whole-file regressions without adding a second coverage score.
Phase 11 adds the Apache-2.0 license, a `v0.1.0` changelog and compatibility
baseline, deterministic release preflight, licensed standalone-package
verification, and checksum gates. [`v0.1.0` is the first published
release](https://github.com/blacwh/change-risk-engine/releases/tag/v0.1.0).
Phase 12 adds composable built-in policy packs with deterministic
configuration precedence and no external loading boundary.
Phase 13 adds a bounded, non-executing Python adapter with explicit stock CLI,
Action, and configuration selection. Python analysis includes source
classification, static-import graph and blast-radius evidence, conventional
test relationships, and caller-supplied LCOV mapping. After a separate semantics
review, scored Python public-surface comparison remains deliberately
unsupported. See the
[language-support matrix](docs/language-support.md) for the exact boundary and
the [Python adapter plan](docs/python-adapter.md) for the phased contract.
Phase 14 is design-complete and implementation-planned: it evaluates the
existing transparent heuristics against a bounded, blinded historical corpus
before any default tuning. No scoring default has changed. See
[historical evaluation](docs/history-evaluation.md).

## Usage

Build and analyze a repository between two revisions:

```bash
npm run build
node apps/cli/dist/run.js analyze --base main --head HEAD
```

Use `--format json` for the versioned machine-readable result. `--fail-on high`
returns exit code 2 for high or critical classifications; operational and input
errors return 1. Run `node apps/cli/dist/run.js --help` for all options.

Select Python explicitly for a Python repository:

```bash
change-risk analyze --base main --head HEAD --language python
```

TypeScript remains the default. The analyzer selects one language per run and
does not infer or merge repository languages.

Write a self-contained report that opens directly in a browser:

```bash
change-risk analyze --base main --head HEAD --format html > change-risk-report.html
```

The HTML viewer has no JavaScript or external assets and displays the complete
validated result. When the clean worktree matches the analyzed head, it also
shows a bounded SVG dependency graph and an accessible module-impact table. See
[CLI usage](docs/cli.md) for details.

Release tarballs install without the monorepo:

```bash
npm install --global ./change-risk-engine-0.1.0.tgz
change-risk --version
```

See [`examples/typescript-service`](examples/typescript-service) for a complete
configuration and representative terminal output.

Select bounded built-in policy defaults in `.change-risk.json`:

```json
{
  "schemaVersion": 1,
  "policyPacks": ["strict-review", "security-sensitive"]
}
```

See [built-in policy packs](docs/policy-packs.md) for exact settings,
composition precedence, and heuristic limitations.

When a clean worktree matches the analyzed head, the analyzer can map changed
paths through a bounded `.github/CODEOWNERS` file and report unowned changes.
See [ownership evidence](docs/ownership.md) for supported syntax, security
bounds, and limitations.

Supply an existing LCOV artifact without running target tests:

```bash
change-risk analyze --base main --head HEAD --coverage coverage/lcov.info
```

The analyzer maps all eligible changed sources, including missing and
zero-measurable records. It also evaluates instrumented new-side changed lines
without executing external diff drivers or target code, and always states that
artifact freshness and revision alignment are caller responsibilities. See
[supplied coverage evidence](docs/coverage.md).

Compare the head artifact with a caller-retained baseline:

```bash
change-risk analyze --base main --head HEAD \
  --coverage coverage/head.lcov.info \
  --baseline-coverage coverage/base.lcov.info
```

Both artifacts remain caller-supplied and revision alignment is not inferred.

Analyze pull requests with the GitHub Action:

```yaml
- uses: blacwh/change-risk-engine@v0.1.0
  env:
    GITHUB_TOKEN: ${{ github.token }}
  with:
    fail-on: high
```

See [GitHub Action usage](docs/github-action.md) for complete permissions,
artifact upload, immutable pinning, and fork behavior.

GitLab mirrors can use the exact-revision, artifact-preserving job in
[GitLab CI usage](docs/gitlab-ci.md). It requires no GitLab API token.

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

Contributors using an AI agent should follow the
[continuous agent work protocol](docs/agent-workflow.md). It defines bounded
work packets, a four-hour run ceiling, autonomous merge checkpoints, verification
by change type, and exact handoff requirements.

Maintainers preparing a version must satisfy the
[release-ready standard](docs/release-readiness.md) for one exact commit before
requesting authorization to tag or publish it.

## Current language scope

The stock CLI and GitHub Action provide explicitly selected
TypeScript/JavaScript or Python indexing, graph, conventional-test, and coverage
eligibility. TypeScript/JavaScript additionally provides syntactic
public-surface evidence; Python deliberately does not. Generic Git, path-policy,
and ownership evidence can observe other files, but that does not imply parser
or graph support. See [language support](docs/language-support.md) and the
[Python public-surface decision](docs/adr/0015-defer-python-public-surface.md).

## Interfaces

- core library;
- CLI;
- GitHub Action;
- JSON output;
- static HTML report;
- programmatic rule/language plugin SDK;
- dependency/blast-radius visualizer.

## Non-goals

- replacing code review;
- predicting production incidents;
- generic AI review;
- executing target code by default;
- broad or automatically inferred multi-language support.
