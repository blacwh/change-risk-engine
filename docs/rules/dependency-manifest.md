# Dependency manifest

- Stable ID: `dependency-manifest`
- Default weight: 15
- Severity: medium

## Evidence

The rule records the dependency file category, count, and sorted paths. It emits
one finding when any changed file is classified as `dependency`.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options.

## Remediation

Review dependency intent, provenance, version changes, and generated lockfile
differences.

## Known limitations

Lockfile regeneration without a semantic dependency change can be a false
positive. Custom manifests that file classification does not recognize can be
missed.
