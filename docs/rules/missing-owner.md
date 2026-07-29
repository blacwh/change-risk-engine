# Missing owner

- Stable ID: `missing-owner`
- Default weight: 15
- Severity: medium

## Evidence

The rule evaluates a complete changed-path ownership relationship set produced
from a valid, bounded `.github/CODEOWNERS` file. It emits one finding containing
the sorted paths whose last matching rule has no owners, or which match no rule.
The evidence records the unowned path count and exact paths.

The rule emits nothing when ownership evidence is unavailable or incomplete. It
also emits nothing when every changed path has at least one syntactically valid
owner.

## Configuration

The shared `enabled` and `weight` settings apply. This rule has no specific
options. Relationship input is bounded, requires unique paths and owners, may
refer only to changed paths, and must cover every changed path exactly once.

## Remediation

Add a matching CODEOWNERS rule or document who is responsible for reviewing the
reported paths.

## Known limitations

A deliberately ownerless path may be valid repository policy, producing a false
positive unless the rule is disabled or its weight is adjusted. Owner strings
are not checked against GitHub membership or permissions, so stale or
unauthorized owners can produce false negatives. The stock analyzer supports
only `.github/CODEOWNERS` from the matching head worktree and suppresses the
rule for any parser issue; valid ownership in GitHub's root or `docs/` fallback
locations therefore produces no finding rather than a claim.
