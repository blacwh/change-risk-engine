# Migration

- Stable ID: `migration`
- Default weight: 25
- Severity: high

## Evidence

The rule records the migration file category, count, and sorted paths. It emits
one finding when any changed file is classified as `migration`.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options.

## Remediation

Document rollout ordering, compatibility, backup, and rollback behavior.

## Known limitations

Documentation or helper scripts stored in migration directories can cause false
positives. Custom migration locations that classification does not recognize can
be missed.
