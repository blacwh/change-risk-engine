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
Ownership coverage adds last-match ordering, ownerless overrides, supported
wildcards, malformed and over-limit input, linked files and directories, exact
changed-path mapping, CLI findings, and repeat-run JSON determinism. Broader
authentication, migration, and monorepo scenarios remain for end-to-end CLI
goldens.
Coverage fixtures add repository-relative and absolute in-root source records,
explicit missing and zero-measurable relationships, inconsistent and duplicate
records, every parser bound, linked artifacts and parents, invalid UTF-8,
deterministic CLI results, source-free failure limitations, and Action input
composition.
Changed-line fixtures add exact additions, replacements, deleted-only hunks,
unchanged renames, unusual NUL-delimited paths, malformed patch structure,
file/range/line limits, LCOV intersection, unmeasurable instrumentation,
bounded-output fallback, combined rule weighting, and repeat determinism.
Historical-coverage fixtures add rename-aware base-path mapping, improvement and
regression percentages, missing baseline records, invalid-baseline fallback,
combined scoring, Action composition, and repeat determinism.

`examples/typescript-service` supplies a validated sensitive-area/rule
configuration and representative terminal output. Package verification adds a
fresh temporary npm installation and analyzes this repository through the
standalone executable, covering the release boundary as well as in-workspace
fixtures.

Extension coverage registers a trusted example rule alongside the built-in
TypeScript adapter, runs it against exact fixture revisions, and verifies its
finding and score contribution. Adapter contract tests use fixture modules with
a resolved internal import; fixture repositories never supply executable plugin
code.

Python adapter fixtures cover deterministic `.py`/`.pyi` discovery, ignored and
linked paths, traversal/file/byte limits, invalid UTF-8, bounded source-free
parse errors, aliases, relative and star imports, repository-root and root-`src`
identities, implementation-over-stub preference, ambiguity, unsupported
namespace layouts, internal/external/unresolved references, and repeat-run
equality. They never invoke Python or install fixture dependencies.
