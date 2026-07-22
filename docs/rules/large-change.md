# Large change

- Stable ID: `large-change`
- Default weight: 20
- Severity: medium; high when either limit is exceeded by more than 2×

## Evidence

The rule records the number of changed files, total added plus deleted lines,
both configured limits, and all affected paths. It emits a finding when either
count is greater than its limit.

## Configuration

`options.maxFiles` defaults to 20 and accepts 1–100,000. `options.maxLines`
defaults to 500 and accepts 1–10,000,000. The shared `enabled` and `weight`
settings also apply.

## Remediation

Split unrelated work where practical, or document why the change must be
reviewed as one unit and plan review coverage accordingly.

## Known limitations

Generated files and broad mechanical refactors can cause false positives. A
small change in a central or sensitive component can be risky without crossing
either threshold.
