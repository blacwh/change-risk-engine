# ADR 0011: Caller-supplied baseline coverage

## Status

Accepted

## Context

Absolute coverage thresholds do not show whether a change reduced coverage from
an established baseline. Retrieving historical artifacts would introduce
network, provenance, retention, and CI-provider concerns, while running tests at
either revision would cross the default no-execution boundary. Renames also mean
that the same source may have different paths in the base and head artifacts.
A separate regression rule would double-score evidence already handled by the
whole-file and changed-line coverage policy.

## Decision

Accept one optional repository-relative baseline LCOV path only alongside the
existing head coverage path. Read both artifacts independently through the same
bounded, no-follow, all-or-nothing parser. The caller is responsible for
generating, retaining, selecting, and revision-aligning both artifacts.

Map each eligible current source to its Git base-side path for the baseline
lookup, using `previousPath` for renames and the current path otherwise. Report
the relationship under the current path while retaining the baseline path and
raw baseline `LF` and `LH` counts as evidence. Derive a percentage delta only
when both current and baseline records contain at least one measurable line.
Missing or zero-measurable baseline records make regression unavailable rather
than creating a risk claim.

Extend `insufficient-coverage` with `maxLinePercentDrop`, a finite 0–100 option
defaulting to 0. A drop greater than the configured allowance adds the stable
`coverage-regression` concern. The rule still emits at most one finding and one
configured contribution for all correlated coverage concerns.

If baseline reading or parsing fails, retain valid head whole-file and
changed-line relationships and add a source-free limitation. Continue to use
result schema version 1 evidence and findings.

## Consequences

- comparison remains deterministic, offline, bounded, and non-executing;
- renamed sources compare against their base-side LCOV path;
- raw counts, percentages, delta, thresholds, and reasons remain visible;
- a bad baseline cannot suppress valid head coverage policy;
- callers can tolerate expected fluctuation through `maxLinePercentDrop`;
- artifact provenance, freshness, revision alignment, test-suite equivalence,
  remote history, aggregate trends, and changed-line history remain outside the
  supported claim.
