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

Any future build/test execution must be opt-in, isolated, and clearly unsafe for untrusted code.

Report vulnerabilities through private security advisories.
