# Programmatic plugins and language adapters

`@change-risk/plugin-sdk` defines API version 1 for trusted embedding hosts. A
plugin can contribute deterministic `RiskRule` objects and repository language
adapters. The SDK is programmatic: the CLI and GitHub Action do not search the
analyzed repository, import configuration modules, install packages, or load
plugin paths.

## Registry

```ts
import { analyzeRepository } from '@change-risk/cli';
import { typeScriptLanguageAdapter } from '@change-risk/language-typescript';
import { createPluginRegistry } from '@change-risk/plugin-sdk';
import { DEFAULT_RULES } from '@change-risk/rules';

const registry = createPluginRegistry({
  builtInRules: DEFAULT_RULES,
  builtInLanguageAdapters: [typeScriptLanguageAdapter],
  plugins: [trustedPlugin],
});

const result = await analyzeRepository({
  repositoryRoot,
  base,
  head,
  rules: registry.rules,
  languageAdapter: registry.languageAdapter('typescript'),
});
```

Definitions use `apiVersion: 1` and stable lowercase kebab-case IDs. The registry
sorts plugins and components, rejects duplicate IDs across built-ins and plugins,
bounds plugin/component counts and rule weights, and freezes copied component
metadata. It validates function presence without calling rule or adapter code.
Callers constructing a full rule registry should include `DEFAULT_RULES` so
ordinary configuration entries remain known to the rule engine.

Programmatic rules receive ownership relationships only when the stock
orchestrator obtained a complete, bounded mapping from the matching head
worktree. Hosts calling the rule engine directly must either omit ownership
evidence or provide exactly one validated relationship for every changed path;
partial maps are rejected because they could turn missing input into a finding.

Programmatic rules receive coverage relationships only when the stock
orchestrator parsed a complete supplied artifact. Hosts calling the rule engine
directly must omit coverage evidence or provide exactly one validated
relationship for every eligible changed non-test, non-generated source. Missing
LCOV records use paired `null` counts; partial or ineligible maps are rejected.
Optional changed-line fields must be supplied as a complete group:
`changedLineCount`, `changedLinesFound`, and `changedLinesHit`. Counts must be
internally consistent, and paired `null` measurement counts are valid only when
the whole-file LCOV source record is also missing.
Optional baseline fields must be supplied together as `baselinePath`,
`baselineLinesFound`, and `baselineLinesHit`. Paired `null` counts mean that a
complete baseline artifact had no matching source record. The stock orchestrator
maps renames through their base-side path and discards only the baseline fields
when baseline input is invalid.

## Language adapter contract

A language adapter declares an ID, a path predicate, and an asynchronous bounded
repository index operation. It returns normalized module paths, resolved,
unresolved, or external references, and explicit issues. The TypeScript adapter
is the implementation selected by stock interfaces.

`@change-risk/language-python` supplies a second bounded implementation for
trusted programmatic hosts. Hosts must import and select it explicitly; its
presence in the workspace does not make Python a stock CLI or Action option.

The orchestration API accepts one explicitly selected adapter. Multi-language
index merging, dependency installation, target configuration plugins, and
automatic adapter discovery are not part of API version 1. An adapter is
responsible for honoring the supplied entry, file, and byte limits and must not
execute target code by default.

Supplying a custom adapter changes the programmatic module index only. It does
not install that adapter into the stock CLI or GitHub Action, change the current
path classifier, or automatically replace the orchestrator's
TypeScript/JavaScript-specific public-surface and conventional-test logic.
Embedding hosts must document which signals they compose and suppress any
language-specific step that is not valid for their adapter. That may require
lower-level composition instead of the stock `analyzeRepository` orchestration.
A custom index alone must not be described as complete language support.

The proposed built-in Python integration and the current capability matrix are
documented separately in [Python adapter plan](python-adapter.md) and
[language support](language-support.md).

## Trust boundary

Plugin functions are executable host code. Registration itself does not invoke
them, but analysis invokes selected adapters and rules. Only an embedding host
may supply plugins it already trusts. Never construct a plugin from pull-request
files or an analyzed repository. Use process/container isolation if a host must
support third-party executable extensions; that is outside this SDK's default
boundary.
