# Historical Evaluation and Default Tuning

Status: P10a evaluation schemas and deterministic metrics are implemented; real
corpus and reviewer work are not authorized or implemented.

## Purpose

The analyzer's score is a deterministic review-prioritization heuristic. It is
not a probability and does not predict incidents. Historical evaluation asks
whether its visible signals and ordinal classification align usefully with
independent reviewer judgment across repositories and time.

The process may recommend keeping the defaults. It must not hide findings,
learn repository code, or replace repository configuration and reviewer
judgment.

## Evaluation questions

The evaluation answers, in order:

1. Can the analyzer produce complete, comparable evidence for the sampled
   changes?
2. Which rules trigger, overlap, or remain unavailable across languages and
   repository strata?
3. Do independent reviewers agree on a change's required review-attention tier?
4. How often does the current classification materially under-triage or
   over-triage that assessment?
5. Does one simple predeclared candidate improve the frozen holdouts without
   weakening transparency or important strata?

It does not answer whether a change is safe, caused an incident, contains a
vulnerability, or was reviewed correctly.

## Unit and inputs

One case is an exact base/head commit pair in one locally available repository.
Inputs are caller-supplied and versioned:

- a corpus manifest with a stable case ID, pseudonymous repository ID, selected
  language, and full base/head object IDs;
- one canonical analyzer result for the exact pair and analyzer commit, or a
  closed source-free unavailable-analysis reason;
- blinded reviewer labels stored separately from analysis results;
- an optional outcome-proxy record, separate from the review label.

Repository roots are supplied locally at execution time and are not stored in a
portable manifest. A frozen corpus records the manifest digest, analyzer commit,
configuration digest, label-schema version, sampling frame, exclusions, and
split assignment.

The evaluator will reject duplicates, shortened or malformed object IDs, unknown
languages or tiers, missing cases, extra labels, non-finite values, inconsistent
analysis revisions, and configured bounds exceeded. Input ordering cannot affect
the output.

Analyzer commit, configuration digest, sampling provenance, reviewer
independence, and repository authorization are caller attestations. The offline
metric engine validates internal consistency but cannot prove those external
facts. Published summaries state that limitation.

The implemented field-level input, label, summary, bounds, and execution
contracts are documented in the
[evaluation schema](evaluation-schema.md).

## Evaluation profiles

Every result declares one profile:

- `default-scoring` uses shipped rule weights and classification thresholds,
  with no policy packs or explicit weight/threshold overrides; repositories may
  still supply explicit language, limits, ignore patterns, sensitive areas,
  rule enablement, and rule options as evidence policy;
- `repository-policy` may include packs or explicit weight/threshold overrides
  from an exact caller-approved repository configuration and is diagnostic only.

Only representative `default-scoring` cases can qualify default tuning.
`repository-policy`, built-in policy-pack, and signal-enriched results are
reported separately and cannot enter the tuning objective. Language selection
is explicit in either profile. The manifest records the complete effective
configuration digest so results from different profiles or settings cannot be
silently pooled.

## Review-attention rubric

Reviewers label the attention needed using change-time evidence, not the
analyzer result or later outcomes:

| Tier          | Meaning                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `routine`     | Localized change adequately handled by ordinary ownership and review.                                                |
| `focused`     | Targeted domain, compatibility, test, dependency, or coordination attention is warranted.                            |
| `intensive`   | Multiple specialists, explicit rollout/rollback thought, or broad compatibility and operational review is warranted. |
| `exceptional` | Exceptional change control, staged validation, or cross-team release coordination is warranted.                      |

Reviewers also select zero or more independent reason codes:

- `consumer-compatibility`;
- `data-state`;
- `deployment-runtime`;
- `security-access`;
- `dependency-supply`;
- `verification-gap`;
- `operational-impact`;
- `coordination-scope`;
- `other-documented`.

Reason codes describe reviewer rationale and do not mirror rule IDs. Reviewers
may record “insufficient context”; those cases are reported and excluded from
tuning rather than forced into a tier.

Exactly two primary reviewers independently label every non-fixture case while
blinded to analyzer scores, classifications, findings, and later outcomes.
Disagreements of more than one tier require a third adjudicator. The report
preserves primary-reviewer agreement metrics and never replaces them with
adjudicated agreement.

## Corpus and leakage controls

The sampling frame is declared before cases are selected. It records repository
eligibility, time window, merged-change definition, bot treatment, unavailable
revision handling, and exclusions. Ordinary tuning samples use change-time
metadata rather than analyzer findings. A separately identified signal-enriched
diagnostic sample may cover rare rules, but its aggregate rates cannot be mixed
with the representative sample.

Cherry-picks, backports, and substantially duplicate changes share one duplicate
group and cannot cross splits. Cases from the same pull request or change series
remain together.

Before labels or analyzer results are examined:

- at least 20% of repositories are frozen as an unseen-repository holdout;
- within development repositories, the latest at least 20% of eligible cases
  are frozen as a forward-time holdout;
- all remaining cases form the development set;
- neither holdout participates in rule selection, candidate search, threshold
  selection, rubric repair, or exclusions added after results are known.

Results are reported separately for the development set, forward-time holdout,
and unseen-repository holdout. TypeScript and Python results remain separate
unless both meet the qualification minimums.

## Qualification gates

Fixtures prove evaluator behavior only and never count as corpus evidence.

A blinded pilot requires:

- at least 100 representative cases from at least 5 repositories;
- at least 25 eligible cases for each language reported;
- two independent labels per case;
- quadratic-weighted Cohen's kappa of at least 0.60;
- at least 85% initial agreement within one tier;
- documented sampling, exclusions, limitations, and missing-context rate.

The pilot validates the contract and cannot change defaults.

A default-tuning decision requires:

- at least 500 representative cases from at least 10 repositories;
- at least 100 eligible cases for each language whose defaults are evaluated;
- at least 40 adjudicated cases in each review tier;
- the pilot agreement gates on the qualified corpus;
- both frozen holdouts populated after duplicate grouping;
- no material analyzer version, rule, rubric, sampling, or exclusion change
  after holdout evaluation begins.

Failure to meet any gate yields “insufficient evidence”; it does not justify
relaxing the gate after results are seen.

These minimums are versioned project governance choices, not universal
statistical guarantees. A future revision may strengthen them prospectively,
but cannot weaken or replace them after inspecting the corpus it governs.

## Metrics

Every report includes raw counts and denominators, not only percentages:

- analyzable-case rate and limitation prevalence by closed source-free evaluator
  category;
- finding prevalence, rule co-occurrence, and unavailable-evidence rates;
- reviewer raw agreement, within-one-tier agreement, and quadratic-weighted
  Cohen's kappa before adjudication;
- a four-by-four classification confusion matrix;
- exact-tier and within-one-tier accuracy;
- per-tier precision and recall, macro recall, and macro F1;
- under-triage and over-triage by one tier and by two or more tiers;
- Spearman rank association between visible score and adjudicated tier;
- the same metrics by language, change-size band, and declared sampling
  stratum when denominators are sufficient.

Proportions include deterministic 95% Wilson intervals. Segments with fewer
than 40 evaluated cases are shown as counts and marked insufficient rather than
silently pooled. Metrics describe association with the rubric, not causal
impact or incident probability.

Metric mechanics are fixed:

- tiers map in order to integers 0 through 3;
- analyzer classifications map `low`, `moderate`, `high`, and `critical` to the
  same tier integers;
- confusion rows are adjudicated tiers and columns are analyzer
  classifications;
- precision or recall with a zero denominator is 0, and macro values average all
  four tier values;
- combined high-tier recall is the share of `intensive` or `exceptional` cases
  classified as `intensive` or `exceptional`;
- quadratic-weighted Cohen's kappa uses disagreement weight
  `(left - right)² / 9`; if expected disagreement is zero, agreement is
  unavailable and qualification fails;
- Spearman association uses average ranks for ties and is unavailable when
  either input is constant;
- Wilson intervals use the two-sided 95% normal quantile
  `1.959963984540054`.

Change-size bands derive only from canonical changed-file and line counts:

- `small`: at most 5 changed files and at most 100 added-plus-deleted lines;
- `medium`: not small, with at most 20 files and at most 500 lines;
- `large`: every larger change.

The evaluator will map limitation strings to the closed categories `worktree`,
`language-index`, `public-surface`, `ownership`, `coverage`, `changed-lines`,
`baseline-coverage`, `graph`, `artifact-provenance`, and `other` using a
versioned fixed prefix table. It emits category counts only and never copies a
limitation string or path into the aggregate summary. Unknown text is `other`.

## Candidate selection and acceptance

Any tuning search is declared before it runs. It may adjust only existing
default rule weights and classification thresholds. It cannot add rules, hide
findings, change evidence, vary behavior by repository identity, or introduce a
learned or remote model.

The search is finite and deterministic:

- at most 100,000 unique candidates;
- finite predeclared values and stable candidate ordering;
- positive rules remain nonnegative and mitigation rules remain nonpositive;
- thresholds remain finite, nonnegative, and strictly increasing;
- a lexicographic objective first minimizes two-or-more-tier under-triage, then
  maximizes macro F1, then minimizes two-or-more-tier over-triage, then selects
  the smallest absolute departure from current defaults.

Exactly one candidate may leave the development process. It is evaluated once
on both frozen holdouts. A default-change proposal requires, on each holdout:

- no increase in two-or-more-tier under-triage count;
- no decrease greater than 0.02 in combined recall for `intensive` and
  `exceptional`;
- either macro-F1 improvement of at least 0.03 or a relative reduction of at
  least 20% in two-or-more-tier over-triage;
- no contrary language or change-size stratum with at least 40 cases;
- complete reproducibility from the recorded inputs and analyzer commit.

When baseline two-or-more-tier over-triage is zero, only the macro-F1 branch can
satisfy the improvement gate. A contrary qualified stratum is one where severe
under-triage increases or combined high-tier recall falls by more than 0.02.

Passing these numeric gates permits a review; it does not compel a change.
Maintainers must inspect rule-level tradeoffs, confidence intervals,
limitations, and compatibility impact. A changed default ships separately with
the old and candidate values, evidence record, changelog, documentation, and
release verification.

## Outcome proxies

Explicit reverts, linked fix-forward changes, or emergency-release markers may
be reported as secondary historical proxies when their extraction rule and time
window are versioned. Commit-message similarity, temporal proximity, or an
ordinary follow-up is not enough to assert causality.

Outcome proxies are never shown to blinded labelers and cannot alone select
weights or thresholds. Missing hosting metadata means unavailable evidence, not
a negative outcome.

## Privacy, security, and retention

The evaluator will be local and offline. It will not clone or fetch repositories,
call hosting APIs, execute target code or tests, install target dependencies,
load target plugins, or upload telemetry.

Corpus owners authorize repositories, reviewers, retention, and any external
artifact access. Private source, diffs, paths, repository names, reviewer
identities, and per-case reports are not committed. A publishable evaluation
record contains:

- schema and evaluator versions;
- analyzer commit and configuration digest;
- corpus and label-manifest digests;
- pseudonymous aggregate strata and case counts;
- aggregate metrics, candidate values, exclusions, and limitations;
- no raw source or credentials.

Hashing does not anonymize sensitive content, so prohibited fields are omitted
rather than hashed into a public record.

## Delivery packets

### P10a — Evaluation schema and metric engine

Complete. The private offline evaluation package provides versioned bounded
input and aggregate-summary schemas, deterministic agreement and classification
metrics, stable source-free JSON, split and leakage validation, and positive,
invalid-input, limit, ordering, and repeat-run tests. It accepts
caller-supplied canonical results or closed unavailable states plus blinded
labels. It does not collect a real corpus, tune defaults, change analyzer
output, or add telemetry.

### P10b — Blinded pilot

Not ready. It requires an authorized corpus, sampling frame, at least two
reviewers, retention decisions, and a merged P10a evaluator. The pilot validates
the rubric and reports baseline behavior; it cannot tune defaults.

### P10c — Qualified tuning decision

Not ready. It requires a successful pilot, the full qualification corpus, frozen
holdouts, and separate authorization. It may recommend one candidate or keeping
the defaults. Any adopted scoring change is another compatibility-reviewed
packet.
