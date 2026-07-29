# ADR 0009: Bounded caller-supplied LCOV evidence

## Status

Accepted

## Context

Line coverage can reveal changed source with missing or weak test execution, but
running repository tests would cross the project's default no-execution
boundary. Coverage artifacts are untrusted, potentially large, path-bearing
input and may be stale or describe a different revision. Treating a partial or
malformed artifact as complete would create unsupported risk claims. Adding
coverage as a top-level result field would also require a schema change when the
existing evidence model can represent the rule output.

## Decision

Accept one explicit repository-relative LCOV artifact path from the CLI or
GitHub Action. Do not discover artifacts or run test/build commands.
Canonicalize the repository and artifact parent, reject linked paths, open the
final file without following links, require a regular file, validate UTF-8, and
bound bytes and every parser dimension.

Parse only the LCOV structure required to validate line coverage while
recognizing ancillary function, branch, and version records. Normalize source
paths inside the repository. Reject duplicate, inconsistent, unsupported,
escaping, unterminated, or over-limit input. If any issue occurs, expose only an
issue-kind limitation and omit the entire relationship set.

When parsing succeeds, provide exactly one relationship for every eligible
changed non-test, non-generated source, including explicit missing and
zero-measurable records. Feed the complete set through `RuleContext`; aggregate
missing, unmeasurable, and below-threshold paths in the built-in
`insufficient-coverage` rule. Represent its output with existing version 1
evidence, finding, and score-contribution records. Always state that freshness
and revision alignment are not verified.

## Consequences

- coverage analysis remains deterministic, bounded, offline, and non-executing;
- malformed or partial artifacts cannot become coverage findings;
- result schema version 1 and existing reporters remain compatible;
- the CLI and Action share identical coverage semantics;
- callers are responsible for generating and aligning the artifact;
- branch/function coverage, changed-line coverage, multiple artifacts, merging,
  remote retrieval, provenance verification, and non-LCOV formats are not
  supported.
