# Configuration

Configuration is validated by `@change-risk/config`. Version 1 rejects unknown
keys and unsupported schema versions.

The CLI loads `.change-risk.json` from the repository root when present. Use
`--config <repository-relative-path>` to require another file. Configuration is
read without following symlinks, must remain inside the repository, and is
limited to 1 MB.

```json
{
  "schemaVersion": 1,
  "ignorePatterns": ["dist/**"],
  "analysis": {
    "maxEntries": 100000,
    "maxFileBytes": 1000000,
    "maxFiles": 10000,
    "maxGraphEdges": 1000000,
    "maxTraversalDepth": 20
  },
  "thresholds": {
    "moderate": 20,
    "high": 50,
    "critical": 80
  },
  "sensitiveAreas": [
    { "id": "authentication", "patterns": ["src/auth/**"] }
  ],
  "rules": {
    "large-change": {
      "enabled": true,
      "weight": 15,
      "options": { "maxFiles": 25, "maxLines": 750 }
    }
  }
}
```

Omitted sections receive deterministic defaults. Thresholds must increase from
moderate to high to critical. Directory-entry, file-count, file-size, graph-edge,
and graph-depth limits are positive and bounded.

`ignorePatterns` accepts at most 1,000 patterns of at most 1,000 characters.
Ignored changed files do not enter findings, and ignored modules are removed
from graph and test-relationship evidence.

Sensitive-area IDs must be unique and contain 1–200 characters. Each area has
1–100 glob patterns, each containing 1–1,000 characters. The supported glob
syntax is deterministic: `*` matches within one path segment, `**` can cross
segments, and `?` matches one non-separator character.

Each entry in `rules` may set `enabled` (default `true`), an optional finite
`weight` override, and a rule-specific `options` object (default `{}`). Unknown
keys in a rule setting are rejected. The available options and defaults are
documented under [rules](rules/README.md); invalid options fail analysis instead
of silently falling back.

The `high-fan-in` rule accepts `minFanIn` (default 5) and
`maxTraversalDepth` (default 20). Public-export policy has no rule-specific
options because its public-entry-point selection and surface comparison are
explicit upstream evidence. The `missing-owner` rule likewise has no
rule-specific options because parsing, bounds, and last-match-wins ownership
mapping are upstream evidence contracts.
The `insufficient-coverage` rule accepts `minLinePercent`, a finite number from
0 through 100 that defaults to 80. Artifact selection is an explicit CLI or
Action input rather than configuration, and the rule emits nothing when complete
coverage relationships are unavailable.

Rule weights may be positive, zero, or negative. Negative values are intended
for evidence-backed mitigations such as `tests-added`; aggregation caps their
effective contribution so the total score remains nonnegative. Classification
is `low` below `thresholds.moderate`, `moderate` below `thresholds.high`, `high`
below `thresholds.critical`, and `critical` at or above the critical threshold.

Programmatic hosts may register additional rule IDs through the plugin SDK and
pass the complete rule registry to analysis. Settings for those IDs use this same
validated configuration shape. The stock CLI and GitHub Action use only built-in
rules and never interpret configuration as a module or plugin path.
