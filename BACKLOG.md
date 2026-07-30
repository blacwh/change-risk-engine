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

## P4 — Supplied coverage evidence

- [x] Deterministic, bounded LCOV parsing from an explicit repository path
- [x] Changed-source line-coverage mapping with explicit missing records
- [x] Evidence-backed insufficient-coverage rule with configurable threshold
- [x] CLI and GitHub Action coverage input integration
- [x] Positive, negative, malformed, limit, symlink, integration, and determinism tests

Acceptance criteria:

- the CLI accepts `--coverage <repository-relative-path>` and the Action accepts
  the equivalent optional `coverage` input; neither interface runs target tests
  or discovers coverage files automatically;
- the reader canonicalizes the repository and artifact parent, rejects absolute
  or escaping paths and symbolic-link traversal, opens the final file without
  following links, requires a bounded regular UTF-8 file, and exposes no LCOV
  source content in limitations;
- LCOV records are parsed deterministically with bounded bytes, lines, line
  length, record count, source-path length, data-line count, and issue count;
  malformed, inconsistent, duplicate, unsupported, or over-limit input yields
  explicit issues and no partial relationship set;
- every changed, non-deleted, non-test, non-generated source path receives one
  explicit relationship when trustworthy coverage evidence is available,
  including missing-record and zero-measurable-line states;
- a built-in `insufficient-coverage` rule emits one evidence-backed finding for
  missing, unmeasurable, or below-threshold line coverage, supports a
  `minLinePercent` option and normal weight/enablement configuration, and
  documents false-positive and false-negative risks;
- reports state that supplied coverage freshness and revision alignment are not
  verified, while CLI, Action, terminal, JSON, Markdown, and HTML paths continue
  to use the shared result schema version 1;
- focused positive, negative, malformed, limit, symlink, ordering, integration,
  and repeat-run determinism tests pass together with `npm run quality`,
  distributable CLI verification, Action packaging verification, and
  `git diff --check`.

Affected contracts: LCOV reader/parser and mapper, rule context and built-in
rule registry, CLI options, Action inputs, trusted programmatic rule hosts,
configuration documentation, fixtures, security boundary, architecture,
packaging, and bundled Action output.

Non-goals: executing target tests or build tools, automatic artifact discovery,
fetching remote artifacts, accepting paths outside the repository, branch or
function coverage scoring, changed-line coverage, merging multiple artifacts,
coverage-delta history, non-LCOV formats, declaring adequate testing, and result
schema version 2.

## P5 — Changed-line coverage evidence

- [x] Bounded new-side changed-line ranges from exact resolved revisions
- [x] LCOV `DA` intersection with explicit changed-line measurement states
- [x] Combined whole-file and changed-line coverage policy without double scoring
- [x] Shared CLI, GitHub Action, and programmatic-host integration
- [x] Positive, negative, malformed, limit, integration, and determinism tests

Acceptance criteria:

- changed lines are the new-side line numbers in zero-context Git hunks between
  the exact resolved base and head commits; additions and replacement lines are
  included, while context, deleted-side lines, binary changes, and unchanged
  renames are not;
- Git collection uses argument arrays, disables external diff and textconv
  execution, returns and reports no source lines, bounds command output, file
  count, range count, and total changed lines, and returns stable source-free
  failures;
- a valid supplied LCOV artifact intersects each eligible changed source's `DA`
  records with its changed-line ranges and reports the total new-side changed
  lines, instrumented changed lines, and hit instrumented changed lines;
- missing LCOV source records, changed sources with no instrumented changed
  lines, pure deletion hunks, and unavailable Git hunk evidence remain distinct;
  failure to collect changed-line ranges preserves valid whole-file coverage
  evidence and adds an explicit limitation;
- the existing `insufficient-coverage` rule emits at most one aggregate finding
  and one configured weight for correlated whole-file and changed-line concerns,
  supports `minChangedLinePercent` as a finite 0–100 option defaulting to 80,
  and exposes stable reasons and raw counts;
- the existing CLI `--coverage` option and Action `coverage` input require no
  new artifact or target-code execution; CLI, Action, terminal, JSON, Markdown,
  and HTML reporting continue through shared result schema version 1;
- focused Git hunk, LCOV intersection, missing/unmeasurable/pure-deletion,
  malformed, limit, ordering, CLI, Action, and repeat-run determinism tests pass
  with `npm run quality`, distributable CLI verification, Action packaging
  verification, clean install, and `git diff --check`.

Affected contracts: resolved-revision Git diff evidence, coverage relationships,
LCOV mapper, rule context and `insufficient-coverage` evidence, configuration
documentation, CLI/Action composition, trusted programmatic hosts, fixtures,
security boundary, architecture, packaging, and bundled Action output.

Non-goals: running target tests or builds, automatic or remote artifact
discovery, baseline/delta history, deleted-line coverage, treating
non-instrumented lines as uncovered, branch/function coverage, multiple
artifacts, non-LCOV formats, source-line content in reports, declaring adequate
testing, and result schema version 2.

## P6 — Historical coverage comparison

- [x] Explicit caller-supplied baseline LCOV input for CLI and GitHub Action
- [x] Rename-aware baseline mapping for eligible changed source paths
- [x] Evidence-backed whole-file coverage regression policy without double scoring
- [x] Conservative current-coverage fallback when baseline evidence is unavailable
- [x] Positive, negative, malformed, limit, integration, and determinism tests

Acceptance criteria:

- baseline comparison is enabled only when the caller supplies both the existing
  head coverage artifact and one repository-relative baseline LCOV artifact;
  neither interface discovers artifacts, retrieves history, or runs target code,
  tests, or build tools;
- the baseline artifact uses the same bounded, repository-contained, no-follow,
  all-or-nothing LCOV reader as head coverage and maps a renamed changed source
  through its base-side path while reporting the relationship under its current
  path;
- every eligible changed source retains the head artifact's whole-file and
  changed-line counts and, when baseline evidence is trustworthy, gains explicit
  baseline whole-file counts; percentage change is derived only when both
  artifacts contain measurable records;
- the existing `insufficient-coverage` rule accepts a finite
  `maxLinePercentDrop` option from 0 through 100, defaults it to 0, and emits at
  most one aggregate finding and one configured weight for correlated missing,
  unmeasurable, below-threshold, changed-line, and regression concerns;
- an invalid, missing, linked, malformed, unsupported, or over-limit baseline
  artifact adds an explicit source-free limitation and preserves valid head
  whole-file and changed-line evidence instead of suppressing it;
- reports state that both supplied artifacts' freshness and revision alignment
  are caller responsibilities; CLI, Action, terminal, JSON, Markdown, and HTML
  reporting continue through shared result schema version 1;
- focused mapping, rename, missing/unmeasurable, improvement/regression,
  malformed, limit, ordering, CLI, Action, and repeat-run determinism tests pass
  with `npm run quality`, distributable CLI verification, Action packaging
  verification, clean install, and `git diff --check`.

Affected contracts: LCOV relationships, rule context and
`insufficient-coverage` evidence, configuration documentation, CLI options,
Action inputs, trusted programmatic hosts, fixtures, security boundary,
architecture, packaging, and bundled Action output.

Non-goals: executing target tests or builds, automatic or remote artifact
discovery, reading coverage from Git objects, verifying artifact provenance or
revision alignment, multiple baselines, aggregate repository-wide trends,
changed-line history, branch/function coverage deltas, non-LCOV formats,
declaring adequate testing, and result schema version 2.

## P7 — First-release readiness

- [x] Canonical release-ready standard and evidence record
- [x] Versioned changelog and compatibility review for candidate `v0.1.0`
- [x] Automated preflight with pre-tag dry-run and exact-tag enforcement
- [x] Declared license propagated into the standalone CLI artifact
- [x] Full quality, packaging, production audit, and release dry run

Acceptance criteria:

- `docs/release-readiness.md` defines mandatory product, compatibility,
  documentation, security, CI, packaging, legal, approval, stop, and rollback
  gates, plus the evidence that proves each gate;
- the first candidate is `v0.1.0`, has explicit release notes in `CHANGELOG.md`,
  preserves analysis result schema version 1, graph companion schema version 1,
  plugin API version 1, existing CLI exit semantics, and documented Action
  inputs, and records any intentional compatibility exception;
- `npm run verify:release -- v0.1.0 --allow-untagged` performs a deterministic
  pre-tag check of the clean candidate tree, required documentation, package
  metadata, changelog entry, Action bundle, and release workflow; tagged mode
  additionally requires the exact version tag to point at `HEAD`;
- the owner-selected SPDX license is declared in repository/package metadata,
  the complete license text is present at the root, and both the license metadata
  and text are included in the standalone CLI tarball;
- a dry run uses `RELEASE_VERSION=v0.1.0` to build and freshly install the
  standalone CLI, proves its version and JSON/HTML analysis, reproduces the
  committed Action bundle, and produces a SHA-256 checksum without creating a
  tag or GitHub release;
- required PR and default-branch CI pass on Node 20.19, 22.13, and 24; the
  production dependency audit has no known vulnerabilities, and any accepted
  development-only audit finding is recorded without weakening a gate;
- before tagging, the owner records approval of the exact commit and confirms
  repository visibility is appropriate for the documented open-source release;
  tag creation, repository visibility changes, and release publication remain
  separately authorized operations.

Affected contracts: release governance, root and generated package metadata,
standalone tarball contents, release workflow, changelog, public compatibility
commitments, security guidance, roadmap, and contributor workflow.

Non-goals: creating or moving a tag, publishing a GitHub or npm release,
changing repository visibility or settings, choosing a license without owner
approval, changing schemas or scoring, adding product features, supporting an
npm-registry publication boundary, or promising long-term stability before
1.0.

## First-release closeout

- [x] Verify the exact final candidate and required/default-branch checks
- [x] Record owner approval of the version, commit, notes, compatibility,
      license, visibility, and known limitations
- [x] Create immutable tag `v0.1.0` from the approved commit
- [x] Publish and independently verify the GitHub Release artifact and checksum
- [x] Reconcile release status across the source-of-truth documentation

Outcome: [`v0.1.0`](https://github.com/blacwh/change-risk-engine/releases/tag/v0.1.0)
was published on 2026-07-30 from commit
`8f653adb5691ae98598eab3fe4ce896e3855e5d2`. The release workflow passed its
tagged readiness, quality, packaging, fresh-install, and checksum gates. The
published tarball has SHA-256
`3593d9c885cd65eb392b337fc3f8042568d43f50efc5b6b61ff798d9d41ba118`.

Affected contracts: release governance and evidence records, product and
roadmap status, changelog continuity, and public project documentation.

Non-goals: changing product behavior, schemas, scoring, security boundaries,
package contents, the immutable `v0.1.0` tag, or selecting an unprioritized
future product direction.

## Next planning cycle

No additional implementation packet is prioritized. The first release is
complete; select and define one bounded direction from `ROADMAP.md`, with
acceptance criteria and non-goals here, before starting more feature work.
