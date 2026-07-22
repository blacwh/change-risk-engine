# Infrastructure

- Stable ID: `infrastructure`
- Default weight: 25
- Severity: high

## Evidence

The rule records the infrastructure and CI categories, matching file count, and
sorted paths. It emits one finding when a changed file is classified as
`infrastructure` or `ci`.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options.

## Remediation

Require infrastructure-aware review and verify deployment and rollback plans.

## Known limitations

Examples or non-deploying files in recognized directories can cause false
positives. Custom infrastructure locations that classification does not
recognize can be missed.
