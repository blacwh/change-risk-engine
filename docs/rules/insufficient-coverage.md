# Insufficient coverage

- Stable ID: `insufficient-coverage`
- Default weight: 20
- Severity: medium

## Evidence

The rule evaluates the complete supplied line-coverage relationship set for
eligible changed source files. It emits one aggregate finding for paths with:

- no matching LCOV source record;
- a valid record with zero measurable lines; or
- line coverage below the configured threshold.

Evidence records each sorted path, raw `linesFound` and `linesHit` values, the
line percentage rounded to two decimal places when measurable, and a stable
reason. The rule emits nothing when coverage evidence is unavailable or when
all eligible paths meet the threshold.

## Configuration

The shared `enabled` and `weight` settings apply.
`options.minLinePercent` is a finite number from 0 through 100 and defaults to
80.

```json
{
  "rules": {
    "insufficient-coverage": {
      "enabled": true,
      "weight": 20,
      "options": { "minLinePercent": 85 }
    }
  }
}
```

Relationship input must contain exactly one valid entry for every eligible
changed source path. Incomplete or malformed LCOV input is omitted upstream
instead of being interpreted as missing coverage.

## Remediation

Add or update tests, regenerate the LCOV tracefile for the analyzed head, or
document why the repository's configured threshold is not appropriate.

## Known limitations

Stale, revision-mismatched, filtered, or incomplete caller-supplied artifacts
can produce false positives or false negatives because the analyzer does not
verify artifact provenance. Whole-file line percentage can hide uncovered
changed lines, while generated or non-instrumentable source can reasonably have
no measurable lines. Passing the threshold is evidence only; it is not proof of
behavioral adequacy.
