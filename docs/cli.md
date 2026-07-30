# Command-line interface

Build the workspace, then run:

```bash
node apps/cli/dist/run.js analyze --base main --head HEAD
```

The command defaults to the current directory, `HEAD~1..HEAD`, terminal output,
the optional root `.change-risk.json`, and no exit gate.

The same configuration may select bounded
[built-in policy packs](policy-packs.md). Packs resolve before explicit
repository settings and require no additional command-line option.

The current CLI has no language option. Its module graph, blast radius,
conventional test mapping, and public-surface evidence use the built-in
TypeScript/JavaScript implementation. Python paths still appear in generic Git
and path-policy evidence but are not Python-aware source, graph, test,
public-surface, or LCOV evidence. See [language support](language-support.md).

## Installation

Each version-tagged GitHub release contains a standalone npm-compatible tarball
and `SHA256SUMS`. After verifying the checksum:

```bash
npm install --global ./change-risk-engine-0.1.0.tgz
change-risk analyze --base main --head HEAD
```

The artifact bundles runtime dependencies and does not require a clone of this
monorepo. The release pipeline proves this by installing into an empty temporary
prefix and capturing both version and JSON analysis output. The package also
contains the same license declaration and complete `LICENSE` text as the source
repository.

## Options

- `--repo <path>` selects the repository.
- `--base <revision>` and `--head <revision>` select the comparison.
- `--config <path>` requires a repository-relative JSON configuration file.
- `--coverage <path>` reads one repository-relative LCOV tracefile without
  discovering artifacts or running tests.
- `--baseline-coverage <path>` optionally compares one repository-relative
  baseline LCOV tracefile and requires `--coverage`.
- `--format terminal|json|html` selects concise text, versioned machine output,
  or a self-contained static report.
- `--fail-on none|low|moderate|high|critical` sets the classification gate.

`--language` is not an available option in the current release. It is part of
the reviewed Python integration plan and will be documented here only when
implemented.

Exit code 0 means analysis completed and did not meet the configured gate. Exit
code 2 means analysis completed and met or exceeded it. Exit code 1 indicates an
invalid command, configuration error, Git failure, or analysis failure.

Graph, conventional test mapping, and `.github/CODEOWNERS` ownership mapping use
the filesystem only when its clean state matches the analyzed head commit before
and after indexing. Otherwise the report still contains exact Git and
public-surface evidence, omits those inputs, and states the limitation. A
missing, linked, unreadable, malformed, unsupported, or over-limit CODEOWNERS
file also produces a limitation and suppresses missing-owner inference. See
[ownership evidence](ownership.md). The CLI never installs dependencies, loads
target plugins, or executes target source or tests.

A supplied coverage artifact is read through a bounded no-follow path inside
the repository. A complete valid tracefile maps every eligible changed source;
malformed, missing, linked, or over-limit input produces a source-free
limitation and suppresses coverage inference. The report always states that
artifact freshness and revision alignment are not verified. See
[supplied coverage evidence](coverage.md).

When coverage is supplied, the CLI also collects bounded zero-context hunks
between the exact resolved revisions and intersects their new-side ranges with
LCOV line records. External diff and textconv execution are disabled. Failure to
collect hunks adds a limitation and falls back to whole-file coverage instead of
failing or discarding the valid artifact.

When baseline coverage is supplied, renamed sources use their base-side path
and other sources use their current path. A valid comparison can add a
whole-file coverage-regression concern to the existing combined coverage
finding. Invalid baseline evidence becomes a source-free limitation and does
not discard valid head coverage.

Generate a report that can be opened directly in a browser:

```bash
change-risk analyze --base main --head HEAD --format html > change-risk-report.html
```

The HTML contains no JavaScript, network requests, or external assets. It uses a
restrictive content security policy and escapes repository-derived text. The
report includes all findings, effective score contributions, changed files,
evidence records, and limitations from the validated version 1 result.

When graph evidence is eligible, the same report includes a focused SVG and
accessible table for changed source modules and their transitive dependents.
Impact distance zero identifies a changed module; increasing distance follows
reverse dependency reach. Arrows retain the underlying importer-to-dependency
direction. The report states when traversal or display bounds truncate the view
and lists changed source paths that were not indexed. Graph evidence is omitted
when the clean worktree does not match the analyzed head.
