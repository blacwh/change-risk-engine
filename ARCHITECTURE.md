# Technical Architecture

## Goals

- deterministic analysis;
- evidence preservation;
- no target-code execution by default;
- language adapters;
- reusable core;
- bounded graph analysis;
- versioned configuration and output.

## Suggested structure

```text
apps/cli
apps/github-action
packages/core
packages/git-adapter
packages/language-typescript
packages/language-python (planned)
packages/dependency-graph
packages/coverage
packages/ownership
packages/plugin-sdk
packages/rules
packages/config
packages/reporters
packages/fixtures
docs/adr
docs/rules
```

## Workspace boundaries

The foundation uses private npm workspaces so package boundaries can mature
before publishing decisions are made:

- `apps/cli` composes the local command-line interface;
- `apps/github-action` composes the later CI integration;
- `packages/core` owns orchestration and shared domain contracts;
- `packages/git-adapter` collects repository evidence without executing target code;
- `packages/language-typescript` indexes TypeScript and JavaScript;
- `packages/language-python` is the planned bounded Python adapter and does not
  exist in the current workspace;
- `packages/dependency-graph` owns bounded graph operations;
- `packages/coverage` reads and maps bounded caller-supplied LCOV line evidence;
- `packages/ownership` reads and maps bounded root CODEOWNERS policy;
- `packages/plugin-sdk` owns trusted-host extension contracts and registries;
- `packages/rules` evaluates deterministic rules;
- `packages/config` validates versioned configuration;
- `packages/reporters` renders shared results;
- `packages/fixtures` provides controlled integration-test repositories and helpers.

Workspace entry points expose only implemented contracts; private package
boundaries can mature before independent publishing decisions are made.

## Pipeline

```text
resolve revisions
→ collect Git diff
→ classify files
→ collect bounded new-side changed-line ranges when requested
→ map supplied line coverage
→ optionally map supplied baseline coverage by base-side path
→ index modules
→ build dependency graph
→ map changed nodes
→ map changed-path ownership
→ collect test/policy evidence
→ run rules
→ aggregate transparent classification
→ render reports
```

## Core types

```ts
type ChangedFile = {
  path: string;
  previousPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  binary: boolean;
  categories: string[];
};

type Evidence = {
  id: string;
  kind: string;
  summary: string;
  data: Record<string, unknown>;
  sourcePaths?: string[];
};

type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  explanation: string;
  evidenceIds: string[];
  affectedPaths: string[];
  remediation?: string;
};
```

## Language adapters

```ts
interface LanguageAdapter {
  id: string;
  canHandle(path: string): boolean;
  indexRepository(
    repositoryRoot: string,
    limits: LanguageAdapterLimits,
  ): Promise<LanguageAdapterIndex>;
}
```

The stock CLI and GitHub Action currently support TypeScript/JavaScript
language-aware analysis. The exact capability boundary is documented in
[language support](docs/language-support.md).

The built-in TypeScript implementation conforms to plugin API version 1's
language-adapter contract: ID and path selection plus a bounded repository index
that returns normalized modules, references, and explicit issues. Programmatic
orchestration accepts one explicitly selected adapter; it does not discover or
load adapters from the target repository.

The initial adapter discovers TypeScript/JavaScript files with deterministic
ordering and bounded entries, file count, and file size. It skips symlinks,
canonicalizes every file beneath the repository root, parses with the TypeScript
compiler API, and extracts static ESM, CommonJS, dynamic-literal, re-export, and
import-equals references. Syntax and access failures remain explicit index issues;
source text and parser messages are not included in those issues.

Resolution is a pure pass over indexed module paths. Relative references support
directory indexes and TypeScript extension substitution. A bounded, no-follow
read of the root `tsconfig.json` supplies optional `baseUrl` and `paths`; inherited
configuration is not followed and produces an explicit issue. Matched aliases
and relative references that miss the index are unresolved evidence. Unmatched
bare specifiers are external and do not trigger package probing or installation.

Python is the selected next adapter, with a Proposed boundary in
[ADR 0014](docs/adr/0014-python-adapter-boundary.md). Its foundation is planned
to index static `.py`/`.pyi` imports without invoking an interpreter, importing
target modules, reading executable project configuration, installing
dependencies, or using the network. Stock integration will select exactly one
adapter explicitly; automatic detection and mixed-language graph merging remain
out of scope. The reviewed delivery contract is in
[Python adapter plan](docs/python-adapter.md), and none of those Python-aware
behaviors are implemented yet.

## Git

Use Git for revision resolution, name-status diff, numstat, content at revisions, and rename detection. Do not assume a clean working tree. Always state analyzed revisions.

Git subprocesses use argument arrays, a resolved repository working directory,
bounded output, and timeouts. Revision resolution places untrusted revision text
after `--end-of-options`, verifies that it names a commit, and returns only a
full object ID. Raw Git stderr is not exposed to callers.

Revision content reads accept only full resolved object IDs and normalized
repository paths. They query the blob size before reading it with `git cat-file`
and enforce caller-bounded bytes and timeouts. This avoids checkout mutation,
shell parsing, text conversion, and target filters.

Changed-file collection runs NUL-delimited `--name-status` and `--numstat`
queries between the resolved object IDs. It correlates both outputs by exact
path, retains the previous path for renames, maps type changes to modifications,
and represents binary line counts as zero with an explicit `binary` flag.
Unexpected statuses or mismatched Git outputs fail closed.

## File classification

Classification is a pure path-based core operation with a closed, stable-order
category set. Categories may intentionally overlap: tests can also be source,
lockfiles are dependencies, and generated JavaScript remains source. Unmatched
paths receive `other`, so every changed file has at least one category.
The current source-extension set covers TypeScript/JavaScript plus `.vue` and
`.svelte`; Python files remain `other` unless another category matches.

## Dependency graph

Required operations:

- direct dependents;
- bounded transitive dependents;
- fan-in and fan-out;
- strongly connected components;
- package boundaries;
- incomplete parse areas.

The graph uses importer-to-dependency edges, deduplicated and sorted at
construction. Fan-in counts direct dependents; fan-out counts direct dependencies.
Reverse breadth-first traversal reports dependent distance and whether the
configured depth truncated the result. Strongly connected components use an
iterative algorithm to avoid call-stack growth. Construction bounds nodes and
edges, and package crossings use the longest caller-supplied package-root match.

## Rule engine

```ts
interface RiskRule {
  id: string;
  defaultWeight: number;
  evaluate(
    context: RuleContext,
    options: Readonly<Record<string, unknown>>,
  ): RuleMatch[];
}
```

Rules are deterministic, evidence-backed, configurable, individually testable, and documented for false positives.

The rule engine evaluates rules in stable ID order. It validates unique rule and
sensitive-area IDs, applies per-rule enablement, options, and optional weight
overrides, and assigns stable IDs to every emitted finding and its evidence.
Affected and source paths are deduplicated and sorted. A rule returns evidence
and finding content together, so the engine cannot create an unlinked finding.

Initial rules:

- large change;
- multi-area change;
- high-fan-in module;
- public API change;
- sensitive path;
- migration;
- infrastructure;
- dependency change;
- missing related tests;
- mitigating tests added.

The first policy slice implements large-change, multi-area, sensitive-path,
dependency-manifest, migration, and infrastructure rules. Graph-aware and
public-export rules consume explicit dependency-graph and public-surface
evidence through the same context. Public entry-point selection and comparison
remain an adapter/orchestration responsibility; rules never load or execute
target configuration.

Test-aware policy consumes explicit source-to-test relationships. Missing-test
findings distinguish an explicit empty relationship from absent evidence, and
the tests-added mitigation only recognizes new tests related to source changed
in the same analysis. Scoring groups findings by stable rule ID. Positive
weights establish the available score before negative mitigations are applied;
mitigation is capped at zero and its effective contribution remains visible.
The result schema requires every finding to appear in exactly one uniquely
identified rule contribution.

Ownership policy consumes an exact relationship for every changed path or no
relationship set at all. The stock mapper reads only `.github/CODEOWNERS` from a
clean worktree matching the analyzed head, applies supported patterns in file
order, and assigns the last matching rule. Missing, linked, malformed, or
over-limit input suppresses ownership findings and becomes an explicit
limitation. The `missing-owner` rule aggregates paths with no owners into one
evidence-backed finding; it does not query identity, access, approval, or team
membership.

Coverage policy consumes an exact relationship for every eligible changed
non-test, non-generated source or no relationship set at all. The stock mapper
reads one explicitly selected repository-relative LCOV artifact with bounded
no-follow semantics, validates line records and summaries, and assigns raw
counts or an explicit missing record. Any reader or parser issue suppresses the
complete relationship set and becomes a source-free limitation. The
`insufficient-coverage` rule aggregates missing, zero-measurable, and
below-threshold paths into one evidence-backed finding. It does not run tests,
discover artifacts, or assert freshness, revision alignment, suite completeness,
or behavioral adequacy.

When coverage is requested, the Git adapter also derives new-side ranges from
zero-context hunks between the resolved commits. It disables executable diff
extensions, parses NUL-delimited raw paths separately from hunk text, and returns
only bounded numeric ranges. The coverage mapper intersects those ranges with
LCOV `DA` records to distinguish total changed lines, instrumented changed lines,
and hit instrumented changed lines. The existing coverage rule combines
whole-file and changed-line concerns into one finding and contribution so
correlated evidence is not double-scored. Git hunk failure omits this refinement
without discarding valid whole-file coverage.

Optional historical comparison reads one explicitly supplied baseline LCOV
artifact through the same bounded no-follow parser. Eligible renamed sources use
their base-side path for lookup; relationships remain keyed by the current path
and carry raw baseline counts. The combined coverage rule derives a whole-file
percentage delta only from two measurable records. Baseline failure adds a
limitation and cannot discard valid head whole-file or changed-line evidence.

Trusted embedding hosts may compose built-in and plugin rules through the
versioned plugin registry. Registration validates stable IDs, weights, required
functions, counts, and collisions, then sorts and freezes copied component
metadata without executing it. The CLI and CI compositions never load plugins
from an analyzed repository.

The stock public-surface comparison operates on caller-selected TypeScript source
snapshots from resolved revisions. It compares exported declaration signatures,
re-exports, and export assignments without type checking or target execution.
Parse and source-size failures suppress inference for the affected path and are
returned as explicit issues. Function and public method bodies plus private
class members are excluded from signatures. Conventional test mapping compares
TypeScript/JavaScript normalized module identities across colocated, `src`,
`test`, `tests`, `spec`, and `__tests__` layouts; every non-test module receives
an explicit relationship, including an empty one.

## Configuration

Version all config. Validate patterns, rules, weights, thresholds, and policy conditions.

Version 1 runtime schemas use Zod at trust boundaries and export inferred
TypeScript types plus JSON Schema representations. Result validation enforces
unique IDs, evidence/finding references, rule ownership of contributions, and a
score equal to the visible contribution total. Canonical results omit volatile
timestamps so deterministic inputs can remain byte-stable.

Configuration may select an ordered, duplicate-free list of bounded built-in
policy packs. Pack definitions ship inside `@change-risk/config` and compose
only existing thresholds, sensitive areas, and rule settings before explicit
repository values are applied. The CLI and Action share this resolver. No pack
loads repository modules, files beyond the selected JSON configuration,
dependencies, or network resources.

## Reporters

- terminal;
- JSON;
- GitHub Markdown;
- self-contained HTML;
- exit status;
- later dependency-graph visualization.

Terminal and JSON reporters validate the shared versioned result at their trust
boundary. JSON preserves the complete result. The terminal skeleton summarizes
classification, revisions, line totals, binary count, findings, visible weights,
effective score contributions, and limitations without color-dependent
semantics.

The HTML reporter is a static document renderer over the same validated result.
It includes no script or external resource, applies a restrictive content
security policy, escapes every repository-derived string, and uses generated
numeric anchors rather than untrusted IDs in HTML attributes. It presents the
complete result as summary metrics, proportional contribution bars, findings,
changed files, evidence records, and limitations.

Graph visualization uses a separately versioned companion schema so result
version 1 remains stable. A bounded multi-source reverse traversal assigns
minimum impact distance from changed modules, then carries those nodes, their
in-scope importer-to-dependency edges, fan-in/fan-out, source graph counts,
unindexed changed paths, and explicit truncation into the HTML reporter. The
report renders deterministic SVG plus an accessible table. This artifact is
created only under the same clean head-worktree invariant as graph rule evidence.

## CLI composition

`change-risk analyze` resolves and compares the requested Git revisions, applies
classification and ignore patterns, compares changed conventional public index
modules at the exact object IDs, and then evaluates rules and scoring. Graph,
test-relationship, and ownership evidence may use the filesystem only when the
worktree is clean and matches the analyzed head both before and after indexing.
Ownership reads the fixed `.github/CODEOWNERS` file through its bounded
no-follow reader. Otherwise this evidence is omitted with an explicit
limitation. This prevents a dirty or moving worktree from being presented as
revision evidence.

The CLI reads only bounded no-follow JSON configuration from inside the
repository. Terminal, JSON, and HTML formats share the same validated result. Exit 0
means analysis completed without triggering the configured gate, exit 2 means
the risk classification met that gate, and exit 1 means input or analysis failed.

## Distribution and self-analysis

The release build bundles the CLI and all runtime dependencies into one ESM
entrypoint. Its prelude provides Node's CommonJS bridge required by the
TypeScript compiler dependency, while the command itself remains ESM. The tag's
validated semantic version is injected at build time. `npm pack` creates a
standalone tarball, and verification installs that tarball into a new temporary
prefix, captures its version through a pipe, and runs an analysis outside the
workspace dependency graph. Packaging requires the root SPDX license declaration
and complete `LICENSE` text, copies both into the standalone package, and
verification compares the installed copies with the repository.

The self-analysis workflow checks out the exact pull-request head (or pushed
master head), runs the bundled Action against the event's base/head object IDs,
and uploads the validated JSON result. The release workflow reruns all quality
gates, packages and freshly installs the CLI, writes a SHA-256 checksum, and
creates a GitHub release only for an existing version tag.

## GitHub Action composition

The JavaScript Action reads a bounded, no-follow GitHub event payload and derives
the exact base and head object IDs for pull-request or push events. It calls the
exported CLI analysis composition directly, then writes the shared JSON and
GitHub Markdown reporters. The JSON path is constrained beneath the canonical
workspace and rejects symbolic-link traversal.

Reporting precedes the classification gate: JSON, step outputs, job summary, and
an eligible pull-request comment are written before exit code 2 is returned. A
same-repository pull request may create or update one marker-bearing comment
owned by `github-actions[bot]`; a fork pull request never calls the comments API.
API response sizes and comment pagination are bounded, and API errors expose
status only. The checked-in Node 24 bundle is reproduced and compared during the
quality gate so `uses:` requires no target dependency installation.

## Additional CI systems

Non-GitHub CI consumes the standalone CLI rather than duplicating orchestration.
The GitLab template maps merge-request or push variables to exact base/head
commits, requests full history, retains canonical JSON on gate failure, and does
not require an API token. External repositories must use a pinned, checksummed
release artifact; source-build examples are scoped to mirrors of this repository.

## Security

Read target files without executing project code, installing dependencies, or running tests by default.

## Testing

Use unit tests, fixture repositories, and golden JSON outputs. Fixtures should cover shared modules, public API breaks, auth changes, migrations, tests added, circular dependencies, parse failures, and monorepos.

## Performance

Cache parsed content by hash, support ignore patterns, bound traversal, and report incomplete analysis and duration.
