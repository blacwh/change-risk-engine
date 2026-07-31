# Output Schema

`@change-risk/core` exports the version 1 runtime schema, inferred TypeScript
types, a parser, and a JSON Schema representation.

Every result records:

- exact base and head revisions;
- changed files, line statistics, binary status, and one or more categories;
- evidence with stable IDs and optional source paths;
- findings that reference existing evidence;
- visible score contributions that reference findings from the same rule;
- an aggregate score equal to the contribution total;
- a risk classification and explicit analysis limitations.

Ownership uses the existing evidence and finding records rather than adding a
top-level result field. A `missing-owner` finding cites `ownership` evidence
whose source paths and data identify the unowned changed paths. Parser or
worktree failures remain limitations, so result schema version 1 is unchanged.

Supplied coverage likewise uses existing records. An `insufficient-coverage`
finding cites `coverage` evidence containing sorted eligible changed-source
paths, raw line counts, percentages when measurable, and stable reasons.
Missing or invalid artifacts remain limitations and do not produce partial
coverage evidence, so schema version 1 remains unchanged.

When exact changed-line ranges are available, the same `coverage` evidence data
also carries raw total, instrumented, and hit changed-line counts, measurable
percentages, configured thresholds, and stable concern reasons. These remain
rule evidence rather than a new top-level result field. Git hunk failures become
limitations and omit only the changed-line refinement, so schema version 1 is
still unchanged.

Optional baseline comparison extends the same rule evidence with the base-side
path, raw baseline line counts, measurable baseline percentage and delta, the
configured drop allowance, and a stable regression reason. A baseline failure
is a limitation and leaves valid head coverage evidence intact. These flexible
evidence records do not change result schema version 1.

Evidence and finding IDs must be unique. Unknown fields, broken references,
unsupported versions, non-finite weights, and hidden score contributions are
rejected. Contribution rule IDs are unique, and every finding must be counted
exactly once by the contribution for its own rule. Mitigating contributions can
be capped at zero-score and therefore need not equal their finding's configured
weight; the effective contribution is the reported value. Volatile timestamps
and durations are intentionally excluded from the canonical result so identical
inputs can produce identical output.

The current category vocabulary is `source`, `test`, `documentation`,
`dependency`, `lockfile`, `generated`, `infrastructure`, `ci`, `migration`,
`configuration`, `asset`, and `other`. Reporters reject values outside this
versioned vocabulary.

Language selection is an analysis input, not a new result field. It changes
which paths receive `source` and `test`, which adapter produces graph evidence,
and whether public-surface comparison is applicable. Python omission of that
comparison appears in `limitations`; this is an accepted capability boundary,
not partial public evidence. Result schema version 1 remains unchanged.

The private historical evaluator uses separate version 1 input and aggregate
summary contracts over canonical results, closed unavailable states, and
blinded labels. Corpus splits, reviewer agreement, and aggregate evaluation
metrics are not analysis evidence and are not added to result schema version 1.
See [historical evaluation](history-evaluation.md) and the
[evaluation schema](evaluation-schema.md).

`@change-risk/reporters` provides validated JSON, plain-text terminal, and
bounded GitHub Markdown renderers. JSON and terminal output end with a newline
for predictable CLI and file output. Terminal and GitHub output show configured
finding weights and effective grouped score contributions, including mitigation
capped at a zero aggregate. The Markdown report also cites finding evidence IDs,
escapes repository-derived content, and links its maintained-comment identity to
a stable hidden marker. If comment-size bounds require a summary, the Action's
JSON artifact remains the complete canonical result.

The self-contained HTML renderer also consumes this exact schema. It presents
the complete result without adding derived claims or volatile fields, so it can
be regenerated deterministically from the canonical JSON value. It contains no
script or external assets; repository-derived values are escaped at the output
boundary.

Graph visualization is deliberately not added to analysis result version 1.
`@change-risk/core` instead exports a separately versioned and validated
`BlastRadiusVisualization` companion schema. It bounds nodes and edges, verifies
unique known endpoints, requires changed nodes to have distance zero, preserves
source graph/change counts, and makes omitted paths and truncation explicit. The
CLI supplies this companion only to HTML rendering; canonical JSON remains
backward compatible.
