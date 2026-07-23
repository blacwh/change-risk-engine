# Command-line interface

Build the workspace, then run:

```bash
node apps/cli/dist/run.js analyze --base main --head HEAD
```

The command defaults to the current directory, `HEAD~1..HEAD`, terminal output,
the optional root `.change-risk.json`, and no exit gate.

## Installation

Each version-tagged GitHub release contains a standalone npm-compatible tarball
and `SHA256SUMS`. After verifying the checksum:

```bash
npm install --global ./change-risk-engine-0.1.0.tgz
change-risk analyze --base main --head HEAD
```

The artifact bundles runtime dependencies and does not require a clone of this
monorepo. The release pipeline proves this by installing into an empty temporary
prefix and capturing both version and JSON analysis output.

## Options

- `--repo <path>` selects the repository.
- `--base <revision>` and `--head <revision>` select the comparison.
- `--config <path>` requires a repository-relative JSON configuration file.
- `--format terminal|json|html` selects concise text, versioned machine output,
  or a self-contained static report.
- `--fail-on none|low|moderate|high|critical` sets the classification gate.

Exit code 0 means analysis completed and did not meet the configured gate. Exit
code 2 means analysis completed and met or exceeded it. Exit code 1 indicates an
invalid command, configuration error, Git failure, or analysis failure.

Graph and conventional test mapping use the filesystem only when its clean state
matches the analyzed head commit before and after indexing. Otherwise the report
still contains exact Git and public-surface evidence, omits those two inputs, and
states the limitation. The CLI never installs dependencies, loads target
plugins, or executes target source or tests.

Generate a report that can be opened directly in a browser:

```bash
change-risk analyze --base main --head HEAD --format html > change-risk-report.html
```

The HTML contains no JavaScript, network requests, or external assets. It uses a
restrictive content security policy and escapes repository-derived text. The
report includes all findings, effective score contributions, changed files,
evidence records, and limitations from the validated version 1 result.
