# Output Schema

`@change-risk/core` exports the version 1 runtime schema, inferred TypeScript
types, a parser, and a JSON Schema representation.

Every result records:

- exact base and head revisions;
- changed files and their line statistics;
- evidence with stable IDs and optional source paths;
- findings that reference existing evidence;
- visible score contributions that reference findings from the same rule;
- an aggregate score equal to the contribution total;
- a risk classification and explicit analysis limitations.

Evidence and finding IDs must be unique. Unknown fields, broken references,
unsupported versions, non-finite weights, and hidden score contributions are
rejected. Volatile timestamps and durations are intentionally excluded from the
canonical result so identical inputs can produce identical output.
