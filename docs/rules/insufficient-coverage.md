# Insufficient coverage

- Stable ID: `insufficient-coverage`
- Default weight: 20
- Severity: medium

## Evidence

The rule evaluates the complete supplied line-coverage relationship set for
eligible changed source files. It emits at most one aggregate finding and one
configured weight for paths with:

- no matching LCOV source record;
- a valid record with zero measurable lines;
- whole-file line coverage below its configured threshold;
- new-side changed lines with no instrumented LCOV lines;
- instrumented changed-line coverage below its configured threshold;
- whole-file coverage that dropped beyond the configured baseline allowance.

Evidence records each sorted path, raw whole-file and available changed-line
counts, optional base-side path and baseline counts, percentages and delta
rounded to two decimal places when measurable, and all stable concern reasons.
The existing singular `reason` remains the first concern for compatibility,
while `reasons` exposes every applicable concern. A zero changed-line count is
not a concern. A missing or zero-measurable baseline does not create a
regression claim. The rule emits nothing when head coverage evidence is
unavailable or when all eligible paths meet the applicable thresholds.
Combining all dimensions in this rule avoids double-scoring correlated coverage
signals.

## Configuration

The shared `enabled` and `weight` settings apply.
`options.minLinePercent` is a finite number from 0 through 100 and defaults to
80. `options.minChangedLinePercent` has the same bounds and default.
`options.maxLinePercentDrop` is a finite number from 0 through 100 and defaults
to 0.

```json
{
  "rules": {
    "insufficient-coverage": {
      "enabled": true,
      "weight": 20,
      "options": {
        "minLinePercent": 85,
        "minChangedLinePercent": 90,
        "maxLinePercentDrop": 2
      }
    }
  }
}
```

Relationship input must contain exactly one valid entry for every eligible
changed source path. Changed-line fields are either absent as a group or form a
complete, internally consistent count set. Incomplete or malformed LCOV input
is omitted upstream instead of being interpreted as missing coverage. A Git hunk
failure omits only changed-line fields and preserves valid whole-file fields.
Baseline path and counts are likewise absent or supplied as one complete group.
An invalid baseline omits that group and preserves the head relationship.

## Remediation

Add or update tests, regenerate the LCOV tracefile for the analyzed head, or
document why the repository's configured threshold is not appropriate.

## Known limitations

Stale, revision-mismatched, filtered, incomparable, or incomplete
caller-supplied artifacts can produce false positives or false negatives because
the analyzer does not verify artifact provenance. LCOV instrumentation defines
which changed lines are measurable, so missing instrumentation can hide
executable changed lines or correctly exclude comments and other non-executable
lines. Deleted lines have no head-side execution count. Passing a threshold or
avoiding regression is evidence only; it is not proof of behavioral adequacy.
