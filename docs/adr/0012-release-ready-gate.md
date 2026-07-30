# ADR 0012: Release-ready gate

## Status

Accepted

## Context

The repository can build a checksummed standalone CLI and create a GitHub
Release from a tag, but a technically successful workflow is not sufficient
release approval. Legal metadata, compatibility review, documentation, exact
candidate identity, CI evidence, and owner approval must be decided before a tag
triggers publication. A mutable or implicit checklist would make it easy for a
release to omit evidence or diverge from the reviewed commit.

## Decision

Define `docs/release-readiness.md` as the canonical mandatory standard. Use
`v0.1.0` as the first candidate and keep the standalone GitHub Release tarball
as the supported distribution boundary.

Add a deterministic repository preflight with pre-tag and tagged modes. Both
modes check required documents, changelog entry, SPDX package metadata, release
workflow integration, committed Action assets, clean Git state, and tag reuse.
Tagged mode additionally requires the exact tag at `HEAD` and a final changelog
date. The tag workflow runs this preflight before packaging.

Require the owner-selected root license declaration and complete `LICENSE` text
in the generated CLI package. Fresh-install verification compares both with the
repository, checks the exact package file set and executable version, and still
runs JSON and HTML analysis. Generate and immediately verify the artifact
checksum before release creation.

Tagging, publication, license choice, and repository visibility remain owner
actions. Automation may prove that gates pass but cannot grant approval.

## Consequences

- a pushed release tag fails closed when readiness evidence is incomplete;
- pre-tag dry runs can validate the same static gates without creating a tag;
- source and standalone artifacts cannot silently differ in license or version;
- released tags are immutable; corrections use a new version;
- GitHub Release tarballs remain the only supported publication boundary for
  `v0.1.0`; npm-registry publishing remains out of scope;
- the first release remained blocked until the owner selected Apache-2.0,
  confirmed public visibility, and approved the exact merged candidate; those
  gates were satisfied before `v0.1.0` was published.
