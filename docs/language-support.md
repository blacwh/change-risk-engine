# Language Support

Language support is capability-specific. Seeing a changed path in Git evidence
does not mean that the analyzer can parse that language, build its dependency
graph, infer related tests, or compare its public surface.

## Current support

The stock CLI and GitHub Action use the built-in TypeScript adapter. They do not
currently expose a language selector or automatically detect a repository
language.

| Capability                                                                   | TypeScript/JavaScript                                                               | Python                                                                                                             | Other files                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Changed paths, status, renames, and line counts                              | Supported                                                                           | Supported                                                                                                          | Supported                                        |
| Configured sensitive-path and CODEOWNERS evidence                            | Language-neutral when a path matches                                                | Language-neutral when a path matches                                                                               | Language-neutral when a path matches             |
| Built-in infrastructure, migration, configuration, and dependency categories | Supported only for documented path/name patterns                                    | Python paths participate only when they match an existing pattern; Python package metadata is not recognized yet   | Supported only for documented path/name patterns |
| `source` classification                                                      | `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`, and `.svelte` | Not yet supported; `.py` and `.pyi` are currently `other` unless another category matches                          | Not generally supported                          |
| Supplied LCOV mapping                                                        | Supported for eligible classified sources                                           | Not yet eligible                                                                                                   | Not generally eligible                           |
| Module discovery and static imports                                          | Supported by the TypeScript adapter                                                 | Implemented by `@change-risk/language-python` for trusted programmatic selection; not selected by stock interfaces | Not implemented                                  |
| Dependency graph, fan-in/out, and blast radius                               | Supported from the TypeScript index                                                 | A trusted host can compose the Python index with graph operations; stock interfaces do not                         | Not implemented                                  |
| Conventional related-test mapping                                            | Supported for TypeScript/JavaScript paths                                           | Not implemented                                                                                                    | Not implemented                                  |
| Public-export comparison                                                     | Supported syntactically for selected TypeScript/JavaScript entry points             | Not implemented                                                                                                    | Not implemented                                  |

`.vue` and `.svelte` paths are classified as source, but the built-in language
adapter does not parse their component syntax. Classification eligibility must
not be read as graph support.

The built-in dependency category currently recognizes the documented
JavaScript ecosystem manifests and lockfiles. It does not recognize
`pyproject.toml`, Python requirement files, or Python lockfiles as dependency
evidence.

Coverage is also capability-specific. The LCOV reader itself is
language-neutral, but the stock mapper considers only changed paths classified
as non-test, non-generated source. Python files therefore do not enter coverage
relationships until Python classification support is implemented.

## Programmatic adapters

Plugin API version 1 lets a trusted embedding host explicitly supply one
`LanguageAdapter`. This replaces the default TypeScript index for that
programmatic analysis; it does not add an adapter to the stock CLI or GitHub
Action.

`@change-risk/language-python` now supplies the bounded `python` adapter for
such trusted hosts. It discovers `.py` and `.pyi`, parses static imports without
Python execution, and returns repository-only resolutions and explicit issues.

The current orchestrator still contains TypeScript/JavaScript-specific public
surface and conventional-test steps. A custom module index alone therefore does
not constitute complete stock support for another language. Hosts must describe
which evidence they provide and must not imply that unsupported signals were
evaluated.

API version 1 does not merge multiple language indexes. Automatic language
detection, mixed-language graph merging, target-repository plugin discovery,
and dependency installation are not supported.

## Python delivery status

The Python adapter foundation is implemented. Its security boundary, explicit
stock selection model, and remaining phased delivery are recorded in
[Python adapter plan](python-adapter.md) and
[ADR 0014](adr/0014-python-adapter-boundary.md).

Until the stock integration packet is complete and its public docs are updated:

- no `python` language configuration value, CLI flag, or Action input exists;
- `.py` and `.pyi` remain outside stock source classification;
- stock Python imports, tests, public surfaces, and blast radius are not
  analyzed;
- mixed TypeScript/JavaScript and Python graphs remain out of scope.
