# Language Support

Language support is capability-specific. Seeing a changed path in Git evidence
does not mean that the analyzer can parse that language, build its dependency
graph, infer related tests, or compare its public surface.

## Current support

The stock CLI and GitHub Action explicitly select one built-in language.
Configuration accepts `typescript` or `python` and defaults to `typescript`; an
explicit CLI `--language` or Action `language` input takes precedence. There is
no automatic detection or mixed-language graph.

| Capability                                                                   | TypeScript/JavaScript                                                   | Python                                                                                                 | Other files                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Changed paths, status, renames, and line counts                              | Supported                                                               | Supported                                                                                              | Supported                                        |
| Configured sensitive-path and CODEOWNERS evidence                            | Language-neutral when a path matches                                    | Language-neutral when a path matches                                                                   | Language-neutral when a path matches             |
| Built-in infrastructure, migration, configuration, and dependency categories | Supported only for documented path/name patterns                        | Python paths participate only when an existing pattern matches; package metadata is not recognized yet | Supported only for documented path/name patterns |
| `source` classification                                                      | Supported for documented TS/JS and component extensions when selected   | `.py` and `.pyi` when selected                                                                         | Not generally supported                          |
| Supplied LCOV mapping                                                        | Supported for eligible classified sources                               | Supported for eligible classified `.py`/`.pyi` sources when selected                                   | Not generally eligible                           |
| Module discovery and static imports                                          | Supported by the TypeScript adapter                                     | Supported by the Python adapter when selected                                                          | Not implemented                                  |
| Dependency graph, fan-in/out, and blast radius                               | Supported from the TypeScript index                                     | Supported from the Python index when selected                                                          | Not implemented                                  |
| Conventional related-test mapping                                            | Supported for documented TypeScript/JavaScript conventions              | Supported for `test_*.py`, `*_test.py`, and `.py` below `tests`                                        | Not implemented                                  |
| Public-export comparison                                                     | Supported syntactically for selected TypeScript/JavaScript entry points | Not implemented; omitted with an explicit limitation                                                   | Not implemented                                  |

`.vue` and `.svelte` paths are classified as source for TypeScript selection,
but the built-in adapter does not parse their component syntax. Classification
eligibility must not be read as graph support.

The dependency category recognizes documented JavaScript ecosystem manifests
and lockfiles. It does not yet recognize `pyproject.toml`, Python requirement
files, or Python lockfiles as dependency evidence.

The LCOV reader is language-neutral, but the mapper considers only changed paths
classified as non-test, non-generated source for the selected language. It does
not run tests, discover artifacts, or verify artifact revision alignment.

## Programmatic adapters

Plugin API version 1 lets a trusted embedding host explicitly supply one
`LanguageAdapter`. The supplied adapter object remains the indexing authority.
The separate `language` option controls stock classification, test conventions,
and public-surface behavior and defaults to `typescript`, preserving callers
that previously supplied only a custom adapter.

`@change-risk/language-python` supplies the bounded `python` adapter. It
discovers `.py` and `.pyi`, parses static imports without Python execution, and
returns repository-only resolutions and explicit issues.

API version 1 does not merge multiple language indexes. Automatic language
detection, mixed-language graph merging, target-repository plugin discovery,
and dependency installation are not supported.

## Python limitations

Python analysis is bounded to repository-root and conventional root-`src`
module identities. It does not execute Python, inspect installed packages,
interpret dynamic imports, compose namespace-package environments, or infer
configurable source roots. Conventional test mapping is path evidence, not
proof that a test imports or exercises a source.

Python public-surface comparison is deferred. A Python run does not invoke the
TypeScript comparison and cannot emit a `public-export` finding from absent
Python evidence; it records the omission as an explicit limitation. The
separate decision is tracked in [Python adapter plan](python-adapter.md) and
[ADR 0014](adr/0014-python-adapter-boundary.md).
