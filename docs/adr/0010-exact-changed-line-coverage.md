# ADR 0010: Exact-revision changed-line coverage

## Status

Accepted

## Context

Whole-file line percentage can hide uncovered lines introduced by the analyzed
change. LCOV supplies per-line execution counts, but it does not identify which
lines changed. The changed-line set must come from exact Git revisions without
executing repository diff drivers or text conversion. Patch output can contain
untrusted paths and source text, can be large, and cannot safely become report
evidence. A separate changed-line rule would also double-score a signal strongly
correlated with the existing whole-file coverage rule.

## Decision

Collect zero-context patches between the already resolved base and head commits
with argument-array Git execution. Disable external diff and textconv, bound
command output, file count, hunk-range count, and total new-side changed lines,
and parse raw NUL-delimited final paths separately from textual hunk headers.
Fix the diff algorithm and indent-heuristic behavior. Return only final paths and
numeric new-side ranges. Additions and replacement lines are included;
deleted-side lines, context, binary changes, and unchanged renames produce no
ranges.

When Git range collection succeeds, intersect each eligible changed source's
ranges with the valid supplied LCOV `DA` map. Record the total new-side changed
lines, the subset instrumented by LCOV, and the instrumented subset with a
non-zero execution count. A positive changed-line count with zero instrumented
lines is explicitly unmeasurable. A zero changed-line count is not subject to a
changed-line threshold. Non-instrumented lines are not assumed uncovered.

Extend the existing `insufficient-coverage` rule with a
`minChangedLinePercent` option instead of adding another weighted rule. Emit at
most one aggregate finding and one configured contribution for correlated
whole-file and changed-line concerns. When Git hunk evidence is unavailable,
state a source-free limitation and preserve valid whole-file coverage evidence.
Use existing version 1 evidence and finding records.

## Consequences

- changed-line evidence is exact-revision, deterministic, bounded, offline, and
  does not depend on the worktree;
- Git patch source is processed transiently but is never returned or copied into
  evidence, findings, or limitations;
- whole-file and changed-line concerns remain distinguishable without adding
  correlated score weights;
- pure deletions and unchanged renames do not create unmeasurable changed-line
  findings;
- LCOV instrumentation controls the denominator, so comments, braces, and other
  non-instrumented changed lines are not treated as missed execution;
- artifact freshness, revision alignment, test-suite completeness, deleted-line
  coverage, baseline deltas, branch/function coverage, and behavioral adequacy
  remain outside the supported claim.
