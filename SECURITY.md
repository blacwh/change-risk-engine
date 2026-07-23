# Security

The analyzer may process untrusted repositories and pull requests.

Threats include malicious paths, command injection, symlink traversal, oversized files, pathological graphs, crafted source, secret exposure, and unsafe CI permissions.

Requirements:

- pass subprocess arguments safely;
- never execute target code by default;
- never install target dependencies automatically;
- restrict access to the repository root;
- validate paths and configuration;
- bound file size and traversal;
- redact likely secrets;
- use minimal GitHub permissions;
- document fork behavior.

The Git adapter never invokes a shell. It passes fixed command arguments to Git,
uses `--end-of-options` before untrusted revision text, bounds command duration
and output, and exposes stable errors rather than raw subprocess stderr.
Diff commands place resolved object IDs before a terminating `--` and use
NUL-delimited output so spaces, tabs, and newlines in paths are data rather than
command or record delimiters.

Revision file reads accept only full hexadecimal object IDs and normalized
repository-relative paths. They use `git cat-file`, query blob size before
content, and enforce byte and timeout bounds. They do not check out revisions,
invoke a shell, apply text conversion, or expose raw Git errors.

The TypeScript adapter skips discovered symlinks and canonicalizes each file
inside the repository root before opening it with no-follow semantics. Directory
entries, source-file count, and source bytes are bounded. Parsing uses the
compiler API only and never loads target configuration, plugins, dependencies,
or executable modules. Issues omit source text and raw parser messages.

Module resolution compares specifiers only with the bounded in-memory module
set. The adapter reads at most the root `tsconfig.json` with no-follow semantics,
rejects configuration paths outside the repository, and does not follow
`extends`, inspect `node_modules`, evaluate package exports, or invoke TypeScript
plugins. Unresolved issues include paths and specifiers but no source excerpts.

Graph construction validates normalized nodes and known edge endpoints, caps
nodes and edges, deduplicates input, and performs cycle analysis iteratively.
Transitive dependent traversal requires a depth from 1 through 100 and explicitly
reports truncation rather than implying a complete blast radius.

Public-surface comparison parses caller-selected source snapshots with the
TypeScript compiler API. It bounds snapshot count and bytes, reports parse and
size issues without source excerpts, and does not resolve imports, load package
metadata, or execute target code. Conventional test mapping is path-only and
does not run tests or inspect coverage.

The CLI loads bounded JSON configuration through a no-follow file descriptor
inside the canonical repository root. Graph and conventional test evidence use
filesystem contents only when the worktree is clean and matches the analyzed
head before and after indexing. If that invariant fails, the CLI omits those
signals and reports a limitation rather than mixing worktree and revision state.

The GitHub Action uses `contents: read` and needs `pull-requests: write` only when
maintained comments are enabled. It validates same-repository identity from the
event before reading `GITHUB_TOKEN` or calling the comments API; fork pull
requests still receive JSON, outputs, and a job summary without a write attempt.
Only a marker-bearing comment owned by `github-actions[bot]` can be updated.
Event and API responses are bounded, API failures omit response bodies, report
paths remain inside the canonical workspace, and symbolic-link report targets
are rejected. JSON is written before comment or severity-gate failures.

Self-analysis checks out the exact event head with credentials persistence
disabled. Its token expression is empty for forks, while GitHub also downgrades
fork workflow permissions. Do not run this Action with `pull_request_target`
after checking out untrusted pull-request code; that event can expose privileged
credentials to attacker-controlled files. The tag-only release workflow has
content-write permission solely to create release assets after quality,
package-install, version, and analysis verification. Release archives include a
SHA-256 checksum. The bundled analyzer preserves the same no-execution and
bounded-input behavior as the workspace CLI.

The static HTML reporter emits no JavaScript or external resources. A restrictive
content security policy blocks network and script loading, and all
repository-derived strings are HTML-escaped before rendering. Generated numeric
anchors prevent evidence IDs from becoming attribute injection surfaces. The
document is a local representation of already-validated report data; it does not
read files or execute analyzer behavior when opened.

The SVG blast-radius view is generated from a separately validated bounded
model. Repository paths are escaped in SVG titles, labels, and the accessible
table; untrusted paths never become element IDs, selectors, coordinates, or URL
targets. Layout coordinates derive only from validated integer distances and
deterministic array positions.

The GitLab CI example requests full history but no API token or write permission.
It rejects a missing or all-zero push base rather than substituting an ambiguous
revision, disables npm lifecycle scripts while installing this repository's
locked analyzer dependencies, and retains JSON when a classification gate
fails. External repositories should use a pinned release tarball only after
verifying `SHA256SUMS`; unpinned branch archives are not a supported install
boundary.

Any future build/test execution must be opt-in, isolated, and clearly unsafe for untrusted code.

Report vulnerabilities through private security advisories.
