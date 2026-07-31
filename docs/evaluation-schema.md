# Historical Evaluation Schema

`@change-risk/evaluation` is a private offline workspace. It exports version 1
runtime schemas, inferred TypeScript types, JSON Schema representations, parsers,
the deterministic metric engine, and newline-terminated stable JSON rendering.
It is not part of the analyzer, CLI, GitHub Action, or standalone release
package.

## Input contract

`HistoryEvaluationInput` contains:

- schema version `1`;
- the full analyzer commit plus SHA-256 corpus and label-manifest digests;
- explicit caller attestations for analyzer/configuration identity, profile
  conformance, sampling provenance, repository authorization, and independent
  reviewers;
- 1 through 10,000 cases and exactly one label record for every case.

A case records bounded stable case, repository, and duplicate-group IDs; a
repository-local sequence number; language; evaluation profile; built-in policy
packs; sampling stratum; split; effective-configuration digest; exact 40
character base/head object IDs; and either a canonical analysis result or one
closed unavailable reason.

`default-scoring` cases cannot select a built-in policy pack.
`repository-policy` cases may explicitly declare `strict-review`,
`security-sensitive`, or neither. Profile, policy-pack set, sampling stratum,
split, and effective-configuration digest are all summary dimensions, so
different settings are not silently pooled.

Cases with a complete result must use the exact manifest revisions. The
evaluator also bounds each result to 10,000 changed files, 10,000 findings, and
1,000 limitations of at most 4,096 characters and requires bounded stable rule
IDs. A corpus may contain at most 32 distinct rule IDs and 1,000 derived summary
segments, bounding quadratic rule co-occurrence and output growth. Unavailable
analysis uses only
`revision-unavailable`, `invalid-result`, `resource-limit`,
`operational-error`, or `other`; arbitrary errors and paths are rejected from
that record.

Duplicate case IDs, exact repository revision pairs, label IDs, repository
sequence numbers, or cross-split duplicate groups are invalid. An unseen
repository cannot occur in another split, and every forward-time sequence must
follow all development sequences for that repository. These checks validate
internal consistency; they cannot prove sampling provenance or detect
semantically duplicated changes that the caller failed to group.

## Label contract

Every case has exactly two primary labels with distinct bounded pseudonymous
reviewer IDs. A tier label uses `routine`, `focused`, `intensive`, or
`exceptional` plus unique reason codes from the closed rubric vocabulary.

A primary reviewer may instead mark insufficient context. Such a case has no
resolved tier or adjudicator and is excluded from classification metrics. Two
tier labels require a resolved tier. Matching labels retain that tier; a
one-tier disagreement resolves to one of the two primary tiers; and a larger
disagreement requires a distinct third adjudicator whose tier becomes the
resolved tier. Initial primary labels remain the source of reviewer-agreement
metrics.

## Summary contract

`HistoryEvaluationSummary` contains only aggregate, source-free data:

- schema and evaluator version `1`;
- analyzer commit, sorted configuration digests, corpus digest, and
  label-manifest digest;
- total case count;
- stable segments by profile, policy-pack set, configuration digest, sampling
  stratum, split, language, and derivable change-size band.

Each segment reports cases, analyzable rate, closed unavailable-analysis counts,
missing-context count, evaluated case count, closed limitation-category
prevalence, finding prevalence, rule co-occurrence, reviewer agreement,
quadratic-weighted kappa, a four by four confusion matrix, exact and
within-one-tier accuracy, per-tier precision/recall/F1, macro recall/F1,
high-tier recall, ordinal under/over triage, and Spearman rank association.
Every reported proportion includes its raw numerator, denominator, and
deterministic 95% Wilson interval. F1, kappa, and rank association are derived
statistics rather than proportions.

Segments with fewer than 40 evaluated cases are marked `insufficient`; their
counts remain visible and are never pooled to manufacture a sufficient
comparison. Change-size segments include only complete results because size is
derived from canonical changed-file evidence.

The limitation mapper emits only the closed categories `worktree`,
`language-index`, `public-surface`, `ownership`, `coverage`, `changed-lines`,
`baseline-coverage`, `graph`, `artifact-provenance`, and `other`. It never
copies the underlying limitation text.

Stable JSON excludes case IDs, repository IDs, duplicate groups, reviewer IDs,
source, diffs, paths, unavailable error text, and environment data. Hashing
sensitive content is not a supported substitute for omission.

## Execution boundary

The package accepts already supplied values in memory. It has no repository
discovery, filesystem, Git, network, target execution, dependency installation,
plugin loading, sampling, reviewer UI, telemetry, candidate search, or scoring
mutation behavior. Corpus acquisition, permission, retention, blinding, and
attestation accuracy remain caller responsibilities.
