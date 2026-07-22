# File Classification

Classification is deterministic and based only on the repository-relative path.
It does not read or execute file content. Paths are compared case-insensitively
with forward-slash separators.

A file can have multiple categories. This preserves useful distinctions without
forcing a hidden precedence rule: test source counts as both test and source,
generated source remains visible as source, and lockfiles count as dependency
changes and lockfiles. Categories are emitted in the stable order defined by the
v1 result schema, regardless of which pattern matched first.

Defaults recognize common TypeScript/JavaScript source and tests, documentation,
dependency manifests and lockfiles, generated directories, infrastructure, CI,
migrations, tool configuration, and static assets. An unmatched path receives
`other`, ensuring that classification never silently drops a changed file.

Content-aware public API, test relationship, and sensitive-path analysis remain
separate later capabilities. Repository-specific sensitive patterns belong to
versioned configuration rather than this generic classifier.
