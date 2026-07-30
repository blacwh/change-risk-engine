# Changelog

All notable user-visible changes to Change Risk Engine are recorded here.
Versions follow Semantic Versioning.

## [Unreleased]

### Added

- composable built-in `strict-review` and `security-sensitive` policy packs
  with bounded selection, deterministic precedence, and shared CLI/Action
  behavior;
- a plugin-API-v1 Python adapter with bounded `.py`/`.pyi`
  discovery, non-executing static import parsing, repository-only resolution,
  and explicit ambiguity and incomplete-evidence issues;
- explicit `typescript` or `python` selection in configuration, CLI, and Action
  interfaces, with Python source classification, conventional test
  relationships, supplied-LCOV eligibility, graph reporting, and an explicit
  limitation in place of unsupported Python public-surface evidence;
- a documented decision to defer scored Python public-surface findings until a
  future explicitly configured, fail-closed declared-name evidence contract is
  separately selected;
- an accepted offline historical-evaluation contract with blinded labels,
  frozen temporal and repository holdouts, deterministic qualification gates,
  and no default scoring change.

## [0.1.0] - 2026-07-30

### Added

- deterministic exact-revision Git change evidence and file classification;
- bounded TypeScript/JavaScript indexing, dependency graphs, blast-radius
  analysis, public-export comparison, and related-test mapping;
- transparent evidence-backed rules, configurable scoring, and version 1 JSON,
  terminal, GitHub Markdown, and static HTML reports;
- standalone CLI packaging, GitHub Action integration, repository
  self-analysis, and a GitLab CI example;
- bounded CODEOWNERS mapping with missing-owner policy;
- caller-supplied LCOV whole-file, exact changed-line, and rename-aware baseline
  coverage evidence;
- trusted-host rule and language-adapter plugin API version 1.

### Security

- no analyzed repository code, tests, dependencies, plugins, diff drivers, or
  text conversion execute by default;
- repository reads, subprocess output, parsing, graph traversal, reports, and CI
  write permissions are explicitly bounded.

### Changed

- release creation now requires deterministic readiness preflight, exact
  package contents and version, license propagation, and checksum verification;
- ESLint and its configuration package were upgraded to the current Node
  20.19+/22.13+/24-compatible major, resolving the development dependency audit.

### Compatibility

- analysis result schema version 1;
- configuration schema version 1;
- blast-radius visualization companion schema version 1;
- trusted plugin API version 1;
- Node.js 20.19+, 22.13+, or 24+.

### License

- Apache License 2.0 for the source repository and standalone CLI package.

[Unreleased]: https://github.com/blacwh/change-risk-engine/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blacwh/change-risk-engine/releases/tag/v0.1.0
