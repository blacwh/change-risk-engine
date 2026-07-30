# Public export

- Stable ID: `public-export`
- Default weight: 25
- Severity: medium for additions only; high for any modification or removal

## Evidence

The rule currently consumes TypeScript public-surface evidence and records a
sorted list of public export changes. Each entry identifies
its repository path, export name, and whether it was added, modified, or
removed. The evidence must come from a caller-selected public-surface comparison;
the rule does not infer public entry points.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options. Public export evidence is bounded to 100,000 unique entries with
non-empty bounded paths and names.

## Remediation

Review consumer compatibility and update release notes, migration guidance, or
versioning as required.

## Known limitations

Incorrectly selected entry points can create false positives. Runtime exports,
generated declarations, or surfaces omitted by the upstream comparison can be
missed. The engine intentionally does not execute package configuration or
target code to discover exports.

Python analysis does not supply this rule. Scored Python public-surface
inference is deliberately deferred by
[ADR 0015](../adr/0015-defer-python-public-surface.md).
