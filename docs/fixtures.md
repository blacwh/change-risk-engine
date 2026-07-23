# Fixture Strategy

`@change-risk/fixtures` creates isolated repositories beneath the operating
system temporary directory. Fixtures use argument-array Git subprocesses,
fixed local author identity, an explicit `main` branch, bounded commands, and an
explicit cleanup function. Failure during construction removes partial state.

Fixture file paths must be relative and remain inside the repository root. The
helper writes plain UTF-8 files only; it does not install dependencies or execute
fixture source code.

Each fixture should document:

- the capability or rule it exercises;
- the base and head revisions;
- expected evidence and findings;
- intentionally malformed or incomplete inputs;
- known false-positive and false-negative coverage.

Current integration coverage includes multi-commit revision resolution,
option-like revision input, invalid repositories, path traversal, cleanup,
added/modified/deleted files, exact renames, binary files, unusual paths, and
bounded file content at exact revisions. Unit fixtures cover shared modules,
public API changes, related-test conventions, cycles, and parse failures.
Broader authentication, migration, and monorepo scenarios remain for end-to-end
CLI goldens.

`examples/typescript-service` supplies a validated sensitive-area/rule
configuration and representative terminal output. Package verification adds a
fresh temporary npm installation and analyzes this repository through the
standalone executable, covering the release boundary as well as in-workspace
fixtures.
