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

`@change-risk/reporters` provides validated JSON and plain-text terminal
renderers. Both end with a newline for predictable CLI and file output.
