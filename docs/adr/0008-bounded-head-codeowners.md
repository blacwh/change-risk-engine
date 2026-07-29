# ADR 0008: Bounded head-worktree CODEOWNERS evidence

## Status

Accepted

## Context

Changed-path ownership can identify review gaps, but CODEOWNERS is
repository-controlled input with wildcard semantics, identity strings, ordering,
and location choices. Treating a partial or misparsed file as complete would
create false missing-owner findings. Querying GitHub membership or approvals
would add network, credential, platform, and nondeterminism concerns. Adding
ownership as a top-level result field would also force a schema version change
when the existing evidence model can represent the rule input and finding.

## Decision

Read only `.github/CODEOWNERS` from a clean worktree that matches the analyzed
head before and after indexing. Canonicalize the fixed directory, reject linked
directories and files, require a regular file, reject invalid UTF-8, and bound
all input and matching dimensions.

Implement the documented CODEOWNERS wildcard subset with iterative matching,
case sensitivity, ownerless overrides, and last-match-wins ordering. Reject
unsupported or malformed syntax. If any reader or parser issue occurs, expose
only an issue-kind limitation and omit ownership relationships entirely.

When parsing succeeds, provide exactly one owned or unowned relationship per
changed path. Feed that complete set through `RuleContext`; aggregate unowned
paths in the built-in `missing-owner` rule and represent its output with existing
version 1 evidence, finding, and score-contribution records.

## Consequences

- ownership analysis remains deterministic, bounded, offline, and
  non-executing;
- incomplete policy cannot become a missing-owner claim;
- result schema version 1 and every existing reporter remain compatible;
- stock CLI and Action behavior is limited to `.github/CODEOWNERS` in the
  matching head tree and is not GitHub base-branch reviewer emulation;
- root and `docs/` fallback files, identity/access validation, approval status,
  escaped whitespace, and historical base ownership are not supported;
- programmatic hosts must omit ownership evidence or provide complete
  changed-path relationships.
