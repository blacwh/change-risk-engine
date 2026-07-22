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

## Git

Use Git for revision resolution, name-status diff, numstat, content at revisions, and rename detection. Do not assume a clean working tree. Always state analyzed revisions.

Git subprocesses use argument arrays, a resolved repository working directory,
bounded output, and timeouts. Revision resolution places untrusted revision text
after `--end-of-options`, verifies that it names a commit, and returns only a
full object ID. Raw Git stderr is not exposed to callers.

Changed-file collection runs NUL-delimited `--name-status` and `--numstat`
queries between the resolved object IDs. It correlates both outputs by exact
path, retains the previous path for renames, maps type changes to modifications,
and represents binary line counts as zero with an explicit `binary` flag.
Unexpected statuses or mismatched Git outputs fail closed.

## Dependency graph

Required operations:

- direct dependents;
- bounded transitive dependents;
- fan-in and fan-out;
- strongly connected components;
- package boundaries;
- incomplete parse areas.

## Rule engine

```ts
interface RiskRule {
  id: string;
  description: string;
  evaluate(context: RuleContext): Finding[];
}
```

Rules are deterministic, evidence-backed, configurable, individually testable, and documented for false positives.

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

## Security

Read target files without executing project code, installing dependencies, or running tests by default.

## Testing

Use unit tests, fixture repositories, and golden JSON outputs. Fixtures should cover shared modules, public API breaks, auth changes, migrations, tests added, circular dependencies, parse failures, and monorepos.

## Performance

Cache parsed content by hash, support ignore patterns, bound traversal, and report incomplete analysis and duration.
