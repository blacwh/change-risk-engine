# Release readiness

This document is the source of truth for deciding whether a Change Risk Engine
commit may be tagged and published. “Release-ready” means every mandatory gate
below has current evidence for one exact commit and version. It does not mean
the analyzer guarantees that a change is safe.

The first release is `v0.1.0`. Creating a tag, publishing a release,
or changing repository visibility requires explicit owner authorization after
the candidate commit has passed this standard.

## Required evidence

| Gate | Requirement | Evidence |
| --- | --- | --- |
| Candidate identity | One exact commit, a valid `v`-prefixed semantic version, clean tree, and no moved or reused tag. | Commit ID, version, `git status`, preflight output |
| Product scope | Product acceptance criteria and the candidate roadmap phase are complete; known limitations remain documented. | `PRODUCT.md`, `ROADMAP.md`, `BACKLOG.md` |
| Compatibility | Public schemas, CLI and Action behavior, plugin API, and packaging boundaries are reviewed; every intentional break is recorded. | Compatibility review below, changelog |
| Documentation | README, CLI, Action, configuration, security, output, rules, fixtures, ADRs, changelog, and release instructions match the candidate. | Documentation diff review |
| Legal | The owner-selected SPDX license is declared and its complete text ships in source and the CLI tarball. | `LICENSE`, package manifests, tarball inspection |
| Security | Trust boundaries remain intact, production audit is clear, and any accepted development-only finding is recorded. | `SECURITY.md`, audit output, PR review |
| Local verification | Clean install, quality matrix, CLI and Action packaging, package installation, preflight, checksum, and diff checks pass. | Command transcript |
| CI | Required PR checks pass on Node 20.19, 22.13, and 24; self-analysis passes; the merged candidate's default-branch checks pass. | GitHub check URLs |
| Distribution | The tarball reports the candidate version, runs JSON and HTML analysis from a fresh install, contains only intended files, and has a SHA-256 checksum. | Package verification and `SHA256SUMS` |
| Repository | Visibility is appropriate for the documented open-source release and the default branch contains the approved candidate. | Repository settings and default-branch commit |
| Approval | The owner approves the exact version, commit, notes, license, visibility, and known limitations. | Completed approval record |

Any failed, missing, stale, or ambiguous mandatory gate means **not ready**.
Warnings may be accepted only when they do not weaken a mandatory gate and the
owner records the rationale.

## Compatibility review for `v0.1.0`

The initial compatibility baseline is:

- analysis result schema version 1 and configuration schema version 1;
- blast-radius visualization companion schema version 1;
- trusted programmatic plugin API version 1;
- CLI command `change-risk analyze`, documented options, and exit codes 0
  (success), 1 (operational/input failure), and 2 (classification gate);
- GitHub Action running on Node 24 with documented inputs and outputs;
- standalone GitHub Release tarball as the supported CLI distribution boundary;
- private monorepo workspaces and no npm-registry publishing commitment;
- deterministic, evidence-backed scoring with no promise that default weights
  are statistically calibrated;
- TypeScript/JavaScript as the supported language implementation.

Before tagging, compare the candidate against this list and record additions,
removals, renamed flags or inputs, schema changes, scoring changes, Node support,
and security-boundary changes in the changelog. A pre-1.0 release may evolve,
but compatibility changes must never be silent.

Any future shipped default-weight or classification-threshold change also
requires the qualified evidence and frozen-holdout record defined by
[historical evaluation](history-evaluation.md). Passing that evaluation permits
maintainer review; it does not replace the release gates or owner approval.

## Verification commands

Run from a clean candidate checkout:

```bash
npm ci
npm run quality
npm run package:cli
npm run verify:package
npm run package:action
npm run verify:action
npm audit --omit=dev
RELEASE_VERSION=v0.1.0 npm run package:cli
npm run verify:package
npm run verify:release -- v0.1.0 --allow-untagged
sha256sum dist/*.tgz > dist/SHA256SUMS
sha256sum --check dist/SHA256SUMS
git diff --check
git status --short
```

The pre-tag mode permits the candidate tag to be absent. The release workflow
runs tagged mode, which requires the exact tag to point at `HEAD` and rejects an
`Unreleased` changelog date.

## Approval record

Copy this block into the release tracking issue or pull request:

```text
Version:
Commit:
PR:
Release notes reviewed:
Compatibility review:
License:
Repository visibility:
Production audit:
PR checks:
Default-branch checks:
Dry-run artifact:
SHA-256:
Known limitations accepted:
Approved by:
Approved at:
```

## Stop conditions

Stop without tagging or publishing when:

- the candidate tree is dirty or differs from the reviewed commit;
- a required local, PR, or default-branch check fails or is missing;
- package contents, executable version, checksum, or generated Action bundle do
  not match the candidate;
- license, visibility, release notes, compatibility impact, vulnerability
  disposition, or owner approval is unresolved;
- credentials, permissions, or GitHub availability prevent evidence collection;
- the release workflow would require bypassing protection or weakening a gate.

## Rollback and correction

Before publication, fix the candidate on a new commit and repeat every affected
gate. Never move or reuse a published tag. If a release is published with a
defect, mark it clearly, preserve the evidence needed to understand the issue,
and publish a new corrective version after the full standard passes. Security
issues follow the private-advisory process in `SECURITY.md`.

## Current `v0.1.0` audit

Status: **released** on 2026-07-30.

Release identity:

- version and tag: [`v0.1.0`][release];
- exact approved commit:
  `8f653adb5691ae98598eab3fe4ce896e3855e5d2`;
- changelog date: 2026-07-30;
- source and standalone-package license: Apache-2.0;
- repository visibility: public;
- distribution boundary: standalone GitHub Release tarball, with no npm-registry
  publication commitment.

Approval record:

- [changelog-finalization PR #26][pr] supplied the exact merged candidate;
- the owner reviewed and approved the version, commit, release notes,
  compatibility baseline, Apache-2.0 license, public visibility, and documented
  limitations on 2026-07-30 before tag creation;
- the owner separately authorized creation and publication of `v0.1.0`;
- the immutable annotated tag points at the approved commit.

Verification evidence:

- all [PR checks][pr] passed on Node 20.19, 22.13, and 24, including
  self-analysis;
- the exact merged commit's [default-branch CI][default-ci] and
  [self-analysis][default-analysis] passed;
- local clean-install verification passed formatting, lint, strict type
  checking, 153 tests in 30 files, all builds, Action bundle verification,
  standalone-package installation and JSON/HTML exercise, and the tagged
  readiness preflight;
- the production dependency audit reported zero known vulnerabilities;
- the [release workflow][release-run] passed quality, tagged readiness,
  packaging, fresh-install, and checksum verification before publication;
- the published [`change-risk-engine-0.1.0.tgz`][artifact] contains exactly
  `LICENSE`, `README.md`, `change-risk.js`, and `package.json`, reports version
  `0.1.0`, and has SHA-256
  `3593d9c885cd65eb392b337fc3f8042568d43f50efc5b6b61ff798d9d41ba118`;
- the published [`SHA256SUMS`][checksums] was downloaded with the tarball and
  independently verified.

The local verification host used Node 20.17 and emitted the expected engine
warning below the supported 20.19 floor. The successful PR and default-branch
matrices on supported Node versions are the authoritative runtime evidence.
All `v0.1.0` release gates are closed; corrections must use a new version and
must not move the published tag.

[artifact]: https://github.com/blacwh/change-risk-engine/releases/download/v0.1.0/change-risk-engine-0.1.0.tgz
[checksums]: https://github.com/blacwh/change-risk-engine/releases/download/v0.1.0/SHA256SUMS
[default-analysis]: https://github.com/blacwh/change-risk-engine/actions/runs/30504743937
[default-ci]: https://github.com/blacwh/change-risk-engine/actions/runs/30504743916
[pr]: https://github.com/blacwh/change-risk-engine/pull/26
[release]: https://github.com/blacwh/change-risk-engine/releases/tag/v0.1.0
[release-run]: https://github.com/blacwh/change-risk-engine/actions/runs/30505149649
