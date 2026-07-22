# High fan-in

- Stable ID: `high-fan-in`
- Default weight: 25
- Severity: medium; high when the transitive dependent count is at least 2× the fan-in threshold

## Evidence

For each changed graph node at or above the fan-in threshold, the rule records
fan-in, fan-out, sorted direct dependents, distance-ordered transitive
dependents, the traversal limit, and whether that limit truncated the result.
Affected paths include the changed module and every reported dependent.

## Configuration

`options.minFanIn` defaults to 5 and accepts 1–100,000.
`options.maxTraversalDepth` defaults to 20 and accepts 1–100. The shared
`enabled` and `weight` settings also apply.

## Remediation

Review compatibility for direct and transitive consumers and target tests at
the reported blast radius.

## Known limitations

Generated imports or architectural aggregation modules can create false
positives. Dynamic references, unresolved imports, deleted modules absent from
the supplied graph, and traversal beyond the configured depth can reduce the
reported impact. No graph evidence produces no finding.
