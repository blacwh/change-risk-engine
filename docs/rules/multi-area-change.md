# Multi-area change

- Stable ID: `multi-area-change`
- Default weight: 15
- Severity: medium

## Evidence

The rule records the sorted set of top-level repository areas, the configured
minimum, and all affected paths. Root files form the `(root)` area. It emits a
finding when the number of areas reaches the minimum.

## Configuration

`options.minAreas` defaults to 3 and accepts 2–1,000. The shared `enabled` and
`weight` settings also apply.

## Remediation

Confirm the cross-area coupling is intentional and include reviewers who
understand each affected area.

## Known limitations

Repositories with many shallow top-level directories can produce false
positives. Cross-cutting changes contained beneath one top-level directory can
avoid the signal.
