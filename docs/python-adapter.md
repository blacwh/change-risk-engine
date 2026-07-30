# Python Adapter Plan

Status: foundation and stock integration implemented; scored public-surface
evidence deliberately deferred by
[ADR 0015](adr/0015-defer-python-public-surface.md).

Python is the selected next built-in language direction. This plan defines its
bounded packets and prevents generic Git/path evidence from being mistaken for
stock Python-aware analysis. Current behavior remains documented in
[language support](language-support.md).

## Intended first capability

`@change-risk/language-python` discovers `.py` and `.pyi` files and produces the
existing plugin API version 1 language index:

- normalized repository-relative module paths;
- static import references classified as internal, external, or unresolved;
- deterministic ordering;
- explicit bounded discovery, read, parse, ambiguity, and resolution issues.

It recognizes static `import` and `from ... import ...` statements,
including aliases and explicit relative-import levels. Aliases do not change
the dependency target. Calls through `importlib`, `__import__`, computed module
names, runtime path mutation, and imports created by executed code will not be
guessed. Parsing uses the bundled JavaScript `@lezer/python` grammar; it never
invokes a Python interpreter.

Resolution operates only on the bounded discovered file set. Package
`__init__.py` or `__init__.pyi` files represent their package. A `.py`
implementation is preferred over a same-identity `.pyi` stub; the stub is used
when no implementation exists. Initial absolute-import roots are the repository
root and a root `src` directory when present. Conflicting module identities
produce explicit ambiguity instead of an arbitrary edge. Relative imports are
resolved from the importing module's package. The adapter does not read or
execute `pyproject.toml`, `setup.py`, environment activation, editable-install
metadata, namespace-package hooks, or target dependencies.

Each name in `import a, b` produces its own reference. `import a.b` targets the
deepest discovered `a.b` module or package. For `from a import b`, resolution
prefers a discovered `a.b` submodule and otherwise records the discovered `a`
module/package dependency; relative forms apply the same rule after resolving
their explicit level. A missing relative target, or a missing descendant of a
known repository top-level package, is unresolved. An unmatched absolute
top-level name is external because the adapter does not inspect the active
Python environment. Star imports reference the resolved module/package but do
not attempt to infer imported names.

These initial roots deliberately cover common repository-root and `src`
layouts. Configurable source roots, namespace packages without an
`__init__` file, monorepo environment composition, and installed-package
resolution require later evidence and design. Files without a supported module
identity remain indexed but produce `module-identity-unavailable`. Only UTF-8
Python source is parsed; another declared source encoding produces
`invalid-utf8` rather than silent replacement.

## Selection contract

Stock Python support is explicit, not inferred:

- a top-level configuration value `language` with the closed values
  `typescript` and `python`, defaulting to `typescript`;
- a CLI `--language` override;
- an Action `language` input override;
- documented precedence in which the invocation override wins over repository
  configuration.

Unknown values fail validation. One adapter is selected per analysis.
Automatic detection and a merged TypeScript/JavaScript-plus-Python graph are
out of scope. Trusted programmatic callers may continue to pass an explicit
adapter directly; that explicit object remains their selection authority.

The additive selection surface remains configuration schema version 1 and
defaults to the prior TypeScript behavior. For programmatic analysis, a supplied
adapter object controls indexing; the separate language value selects stock
classification, test, and public-surface behavior.

## Stock integration

The integration makes `.py` and `.pyi` eligible for `source` classification
when Python is selected and adds Python-specific conventional test
relationships:

- `test_*.py` and `*_test.py`;
- modules beneath a `tests` directory;
- matching module identities across repository-root or `src` source layouts and
  `tests` layouts.

Every eligible non-test Python module will receive an explicit relationship,
including an empty test list. This remains path evidence, not proof that a test
imports, executes, or adequately covers the module.

Once Python paths are classified as source, the existing caller-supplied LCOV
mapper can relate matching normalized paths to those files. It will still not
run tests, discover artifacts, or verify freshness or revision alignment.

Python public-surface comparison is deliberately deferred. While Python is
selected, the stock analyzer does not run the TypeScript public-export
comparison on Python paths or emit a public-export finding from absent Python
evidence.

The decision review rejected inferred names and syntactic signatures as scored
compatibility evidence. Python runtime namespaces can be populated dynamically,
`__all__` is not a direct-access enforcement boundary, typing stubs define a
separate interface, and decorators or metaclasses can replace the objects
described by syntax. A future proposal may compare added and removed names only
from a complete statically resolved `__all__` at explicitly configured entry
points. It must keep `.py` runtime and `.pyi` typing surfaces separate, fail
closed on dynamic composition, and begin without scoring. That proposal is not
a ready packet.

## Security and determinism

The foundation preserves the existing target-repository trust boundary:

- do not invoke a Python interpreter;
- do not import target modules or execute target configuration;
- do not install or inspect target dependencies;
- do not call package registries or other network services;
- skip symbolic links and keep canonical reads inside the repository;
- apply caller-provided entry, file-count, and file-byte bounds;
- use the bundled non-executing `@lezer/python` parser, bound source bytes, walk
  syntax trees iteratively, and cap retained parse issues per file;
- return stable issue kinds and locations without source excerpts or raw parser
  messages;
- resolve imports only against deterministic in-memory module identities.

Parse or resolution uncertainty must reduce confidence explicitly. It must not
silently become a claim that a module has no dependencies.

## Delivery packets

### P9a — Adapter foundation

Complete. `packages/language-python` provides bounded discovery, non-executing
parsing, module identity construction, static import extraction,
repository-only resolution, and focused fixtures/tests through the existing
adapter contract without changing stock CLI or Action behavior.

### P9b — Stock selection and evidence integration

Complete. Shared configuration, CLI, and Action interfaces validate explicit
selection; the analyzer selects one built-in adapter, applies conditional Python
source/test/coverage behavior, suppresses TypeScript-only public evidence, and
ships the same behavior in the standalone CLI and committed Action bundle.

### P9c — Python public surface

Complete. The semantics review defers scored Python public-surface findings and
defines the prerequisites for any future observational declared-name evidence.
No Python public-surface implementation packet is ready.

Each packet has its own acceptance criteria, tests, documentation update,
commit, review checkpoint, and phase publishing boundary. The packets must not
be collapsed merely to claim broad language support sooner.
