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

Any future build/test execution must be opt-in, isolated, and clearly unsafe for untrusted code.

Report vulnerabilities through private security advisories.
