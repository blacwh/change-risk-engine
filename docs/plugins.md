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

## Language adapter contract

A language adapter declares an ID, a path predicate, and an asynchronous bounded
repository index operation. It returns normalized module paths, resolved,
unresolved, or external references, and explicit issues. The TypeScript adapter
is the first built-in implementation.

The orchestration API accepts one explicitly selected adapter. Multi-language
index merging, dependency installation, target configuration plugins, and
automatic adapter discovery are not part of API version 1. An adapter is
responsible for honoring the supplied entry, file, and byte limits and must not
execute target code by default.

## Trust boundary

Plugin functions are executable host code. Registration itself does not invoke
them, but analysis invokes selected adapters and rules. Only an embedding host
may supply plugins it already trusts. Never construct a plugin from pull-request
files or an analyzed repository. Use process/container isolation if a host must
support third-party executable extensions; that is outside this SDK's default
boundary.

