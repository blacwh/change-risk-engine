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

## Project status

Phases 0 through 7 are complete. The engine safely collects exact Git evidence,
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
evidence-backed missing-owner rule. Invalid or unavailable ownership input is
reported as a limitation instead of becoming a risk claim.

## Usage

Build and analyze a repository between two revisions:

```bash
npm run build
node apps/cli/dist/run.js analyze --base main --head HEAD
```

Use `--format json` for the versioned machine-readable result. `--fail-on high`
returns exit code 2 for high or critical classifications; operational and input
errors return 1. Run `node apps/cli/dist/run.js --help` for all options.

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

When a clean worktree matches the analyzed head, the analyzer can map changed
paths through a bounded `.github/CODEOWNERS` file and report unowned changes.
See [ownership evidence](docs/ownership.md) for supported syntax, security
bounds, and limitations.

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

## Initial scope

TypeScript and JavaScript repositories.

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
- supporting every language in the first release.
