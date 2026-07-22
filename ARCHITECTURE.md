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
apps/web
packages/core
packages/git-adapter
packages/language-typescript
packages/dependency-graph
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
- `packages/dependency-graph` owns bounded graph operations;
- `packages/rules` evaluates deterministic rules;
- `packages/config` validates versioned configuration;
- `packages/reporters` renders shared results;
- `packages/fixtures` provides controlled integration-test repositories and helpers.

Workspace entry points are intentionally empty during the foundation milestone.
Contracts are introduced with the capability that needs them instead of being
guessed in advance.

## Pipeline

```text
resolve revisions
→ collect Git diff
→ classify files
→ index modules
→ build dependency graph
→ map changed nodes
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
  index(files: string[], context: IndexContext): Promise<ModuleIndex>;
  detectPublicApiChanges?(context: ChangeContext): Promise<PublicApiChange[]>;
  mapTests?(index: ModuleIndex): Promise<TestRelationship[]>;
}
```

Support TypeScript/JavaScript first.

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

Public-surface comparison operates on caller-selected TypeScript source
snapshots from resolved revisions. It compares exported declaration signatures,
re-exports, and export assignments without type checking or target execution.
Parse and source-size failures suppress inference for the affected path and are
returned as explicit issues. Function and public method bodies plus private
class members are excluded from signatures. Conventional test mapping compares
normalized module identities across colocated, `src`, `test`, `tests`, `spec`,
and `__tests__` layouts; every non-test module receives an explicit relationship,
including an empty one.

## Configuration

Version all config. Validate patterns, rules, weights, thresholds, and policy conditions.

Version 1 runtime schemas use Zod at trust boundaries and export inferred
TypeScript types plus JSON Schema representations. Result validation enforces
unique IDs, evidence/finding references, rule ownership of contributions, and a
score equal to the visible contribution total. Canonical results omit volatile
timestamps so deterministic inputs can remain byte-stable.

## Reporters

- terminal;
- JSON;
- GitHub Markdown;
- exit status;
- later HTML and visualization.

Terminal and JSON reporters validate the shared versioned result at their trust
boundary. JSON preserves the complete result. The terminal skeleton summarizes
classification, revisions, line totals, binary count, findings, visible weights,
and limitations without color-dependent semantics.

## Security

Read target files without executing project code, installing dependencies, or running tests by default.

## Testing

Use unit tests, fixture repositories, and golden JSON outputs. Fixtures should cover shared modules, public API breaks, auth changes, migrations, tests added, circular dependencies, parse failures, and monorepos.

## Performance

Cache parsed content by hash, support ignore patterns, bound traversal, and report incomplete analysis and duration.
