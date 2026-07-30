# Built-in policy packs

Policy packs are bounded, version-controlled defaults for existing Change Risk
Engine configuration. Select them in `.change-risk.json`; the CLI and GitHub
Action resolve the same configuration.

```json
{
  "schemaVersion": 1,
  "policyPacks": ["strict-review", "security-sensitive"]
}
```

Only built-in IDs are accepted. The ordered list is limited to the number of
available packs and may not contain duplicates. A pack never loads repository
code, another configuration file, a package, or a network resource. Selection
is explicit; the analyzer does not infer a pack from repository contents.

## Composition and precedence

Packs compose from left to right. A later pack replaces an earlier pack's
classification thresholds, sensitive area with the same ID, or individual rule
field; rule option objects merge by key.

The repository configuration is then applied:

- explicit `thresholds` replace packed thresholds;
- explicit `sensitiveAreas` replace all packed sensitive areas;
- explicit rule `enabled` and `weight` fields override packed fields;
- explicit rule option keys override packed option keys.

Omitting `policyPacks` preserves the original schema version 1 defaults.
Resolved settings use the existing rule engine and output schema, so findings,
evidence, weights, and effective score contributions remain visible.

## `strict-review`

`strict-review` is an intentionally conservative review posture:

| Setting                        | Packed value | Default without a pack |
| ------------------------------ | -----------: | ---------------------: |
| Moderate classification        |           15 |                     20 |
| High classification            |           40 |                     50 |
| Critical classification        |           70 |                     80 |
| Large-change files             |           10 |                     20 |
| Large-change lines             |          250 |                    500 |
| Multi-area count               |            2 |                      3 |
| High fan-in                    |            3 |                      5 |
| Supplied whole-file coverage   |          90% |                    80% |
| Supplied changed-line coverage |          90% |                    80% |
| Allowed supplied coverage drop |           0% |                     0% |

These are explicit heuristics, not statistically calibrated risk estimates.
The coverage settings apply only when the caller supplies valid coverage
evidence; the pack does not discover artifacts or run tests.
Policy-pack values do not change during the evaluation foundation or pilot.
Any future proposal must report pack behavior separately under the
[historical evaluation contract](history-evaluation.md).

## `security-sensitive`

`security-sensitive` supplies common path patterns for four sensitive areas:

| Area                      | Basenames matched at the root or below it                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `authentication`          | `auth.*`, `auth/**`, `authentication.*`, `authentication/**`                                  |
| `authorization`           | `authorization.*`, `authorization/**`, `permissions.*`, `permissions/**`, `rbac.*`, `rbac/**` |
| `cryptography`            | `crypto.*`, `crypto/**`, `cryptography.*`, `cryptography/**`                                  |
| `credentials-and-secrets` | `credentials.*`, `credentials/**`, `secrets.*`, `secrets/**`                                  |

Each basename also has an explicit `**/` form so the deterministic glob matcher
applies it below arbitrary repository directories.

A path match produces the existing `sensitive-path` evidence and finding. It
does not prove a vulnerability, establish ownership, or confirm that an
unmatched path is safe. Repository naming conventions vary, so false positives
and false negatives are expected. Replace `sensitiveAreas` explicitly when
project-specific patterns are more appropriate.
