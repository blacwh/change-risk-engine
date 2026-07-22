# Tests added

- Stable ID: `tests-added`
- Default weight: -10
- Severity: info

## Evidence

The mitigation records new test files that are explicitly related to non-test
source files changed in the same analysis. It also records the related source
paths. Added but unrelated tests do not qualify.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options. A negative configured weight is a mitigation; transparent aggregation
caps mitigation so the total score never falls below zero.

## Remediation

Review that the new tests exercise the changed behavior and relevant failure
modes. The finding is evidence of testing effort, not proof of correctness.

## Known limitations

Relationship mappings do not establish test quality, so superficial tests can
create a false sense of mitigation. Existing tests that were substantially
improved are intentionally not counted by this added-tests-only rule.
