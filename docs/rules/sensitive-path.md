# Sensitive path

- Stable ID: `sensitive-path`
- Default weight: 25
- Severity: high

## Evidence

The rule emits one finding per matching sensitive area. Evidence includes the
area ID, its sorted glob patterns, and the matching changed paths.

## Configuration

Define unique `sensitiveAreas` entries in configuration. `*` matches within one
path segment, `**` can cross segments, and `?` matches one non-separator
character. The shared rule `enabled` and `weight` settings apply; there are no
rule-specific options.

## Remediation

Apply the review, validation, and rollout policy appropriate to the named area.

## Known limitations

Patterns that are too broad can produce false positives. Missing, overly narrow,
or stale patterns can miss genuinely sensitive paths.
