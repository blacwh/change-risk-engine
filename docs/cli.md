# Command-line interface

Build the workspace, then run:

```bash
node apps/cli/dist/run.js analyze --base main --head HEAD
```

The command defaults to the current directory, `HEAD~1..HEAD`, terminal output,
the optional root `.change-risk.json`, and no exit gate.

## Options

- `--repo <path>` selects the repository.
- `--base <revision>` and `--head <revision>` select the comparison.
- `--config <path>` requires a repository-relative JSON configuration file.
- `--format terminal|json` selects human or versioned machine output.
- `--fail-on none|low|moderate|high|critical` sets the classification gate.

Exit code 0 means analysis completed and did not meet the configured gate. Exit
code 2 means analysis completed and met or exceeded it. Exit code 1 indicates an
invalid command, configuration error, Git failure, or analysis failure.

Graph and conventional test mapping use the filesystem only when its clean state
matches the analyzed head commit before and after indexing. Otherwise the report
still contains exact Git and public-surface evidence, omits those two inputs, and
states the limitation. The CLI never installs dependencies, loads target
plugins, or executes target source or tests.
