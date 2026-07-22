# Missing related tests

- Stable ID: `missing-related-tests`
- Default weight: 20
- Severity: medium

## Evidence

The rule evaluates explicit source-to-test relationship records. For every
changed non-test source represented in those records, it reports the sorted
related test paths when none of those tests was added, modified, or renamed.
Deleted tests do not satisfy the rule.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options. Test relationships are bounded, require unique source paths, and
require unique bounded test paths per source. An empty test-path list explicitly
states that no related test is known; an absent source relationship states that
the mapper supplied no evidence and produces no finding.

## Remediation

Add or update a related test, or document why existing coverage is sufficient
for the change.

## Known limitations

Stale or overly broad relationship mappings can produce false positives.
Missing relationship records, indirect behavioral coverage, and tests outside
the supplied mapping can produce false negatives.
