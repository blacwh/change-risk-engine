# Contributing

Open an issue before changing schemas, scoring semantics, security boundaries, language support, execution behavior, or plugin architecture. Use an ADR for significant decisions.

Pull requests should include:

- problem and scope;
- affected contracts;
- tests and fixtures;
- example report changes;
- performance and security impact;
- known false positives and negatives.

A new rule requires a stable ID, purpose, evidence, default weight, configuration, positive and negative fixtures, false-positive discussion, and remediation guidance.

Never add default behavior that executes analyzed repository code.

Visualization changes must preserve a machine-validated source model, explicit
bounds and truncation, escaped repository-derived content, and a non-visual
equivalent such as a table. Do not infer graph structure from finding prose or
silently extend an existing schema version.

Run `npm run quality` before opening a pull request. To validate the
distributable CLI boundary, also run:

```bash
npm run package:cli
npm run verify:package
npm run package:action
npm run verify:action
```

`action-dist/index.js` is generated and committed. Change Action source first,
rebuild the bundle, and include both in the same pull request; the quality gate
rejects stale generated output.

Maintainer releases use a semantic version tag such as `v0.1.0`. The tag
workflow reruns quality, injects the tag version, freshly installs and exercises
the standalone tarball, writes `SHA256SUMS`, and creates the GitHub release. Do
not create or move a release tag until its commit has passed CI.
