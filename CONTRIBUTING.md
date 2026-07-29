# Contributing

Open an issue before changing schemas, scoring semantics, security boundaries, language support, execution behavior, or plugin architecture. Use an ADR for significant decisions.

AI-assisted and autonomous contributions follow
[`docs/agent-workflow.md`](docs/agent-workflow.md). Its work-packet boundaries,
four-hour continuous-run ceiling, merge checkpoints, stop rules, and
verification matrix apply in addition to the contribution requirements below.
The timebox never permits skipping tests, review, or required checks.

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

CI examples must resolve exact revisions, preserve machine-readable evidence on
gate failure, avoid write tokens unless the integration requires them, and pin
and verify externally downloaded analyzer artifacts.

Plugin additions require an API version, stable IDs, deterministic output,
component bounds, collision tests, and an explicit trust model. Keep executable
extension loading out of CLI configuration and analyzed repositories.

Ownership changes must preserve fixed-path no-follow reads, conservative
all-or-nothing relationships, case-sensitive last-match ordering, bounded
iterative matching, and explicit limitations without CODEOWNERS source content.
Do not infer GitHub membership, permissions, reviewer assignment, or approval
from a syntactically valid owner string.

Coverage changes must preserve explicit caller selection, repository-contained
no-follow reads, conservative all-or-nothing relationships, bounded parsing,
source-free limitations, and the no-target-execution boundary. Do not infer
artifact freshness, revision alignment, test-suite completeness, or behavioral
adequacy from a valid LCOV tracefile.

Run `npm run quality` before opening a pull request. To validate the
distributable CLI boundary, also run:

```bash
npm run package:cli
npm run verify:package
npm run package:action
npm run verify:action
```

Documentation-only changes may use the narrower verification defined in the
agent workflow. Any documentation change that alters executable commands,
generated artifacts, package metadata, or verified technical claims must run
the corresponding code or packaging checks.

`action-dist/index.js` is generated and committed. Change Action source first,
rebuild the bundle, and include both in the same pull request; the quality gate
rejects stale generated output.

Maintainer releases use a semantic version tag such as `v0.1.0`. The tag
workflow reruns quality, injects the tag version, freshly installs and exercises
the standalone tarball, writes `SHA256SUMS`, and creates the GitHub release. Do
not create or move a release tag until its commit has passed CI.
