# ADR 0016: Historical evaluation before default tuning

## Status

Accepted

## Context

The analyzer exposes deterministic findings, configurable rule weights, a
visible additive score, and configurable classification thresholds. The current
defaults and built-in policy packs are documented heuristics. They have not been
qualified against a historical corpus, and the score is not a probability of an
incident, defect, failed deployment, or any other outcome.

Changing defaults without a frozen evaluation contract would invite circular
labels, repository leakage, retrospective outcome bias, and repeated tuning on
the same test cases. Optimizing only for reverts or fix-forward commits would
also confuse incomplete historical proxies with reviewer-visible delivery risk.

The project needs evidence about signal usefulness without turning the analyzer
into an opaque trained model or collecting target-repository data implicitly.

## Decision

Adopt the offline, design-first evaluation contract in
[history evaluation](../history-evaluation.md) before considering any default
rule-weight or classification-threshold change.

The evaluation target is a blinded human assessment of required review
attention for an exact base/head change. It is not incident prediction. Outcome
proxies such as explicit reverts may be reported separately but cannot be the
sole label or tuning objective.

Evaluation proceeds in bounded packets:

1. implement versioned local schemas and deterministic metrics over
   caller-supplied canonical analysis results and labels;
2. run a blinded pilot to validate the rubric, sampling, reviewer agreement,
   limitations, and language/repository strata without tuning defaults;
3. only after the qualification gates are met, select at most one transparent
   candidate from a predeclared bounded search and evaluate it once on frozen
   temporal and unseen-repository holdouts.

The runner will not fetch repositories, call hosting APIs, execute target code,
install target dependencies, upload telemetry, or discover private data.
Repository acquisition, permission, retention, and reviewer access remain
caller responsibilities. Committed evidence contains aggregate metrics and
provenance hashes, not source, diffs, paths, reviewer identities, or private
repository names.

No default change is automatic. A candidate must retain visible findings and
contributions, pass the documented non-regression gates, receive compatibility
review, and ship in a separate authorized packet. An inconclusive or adverse
evaluation keeps the existing defaults.

## Consequences

- “Calibration” means transparent historical evaluation and bounded default
  tuning, not probability calibration;
- evaluation artifacts use a separate versioned contract and do not alter
  analysis result schema version 1;
- fixture and pilot results cannot justify a default change;
- label quality and repository/language coverage can block tuning;
- private repositories can participate locally without their content entering
  the project;
- score changes remain behavioral compatibility changes requiring changelog,
  documentation, release, and CI evidence;
- the first implementation packet can build reusable evaluation mechanics
  without collecting a real-world corpus or changing analyzer behavior.
