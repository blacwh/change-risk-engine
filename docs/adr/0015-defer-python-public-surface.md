# ADR 0015: Defer scored Python public-surface evidence

## Status

Accepted

## Context

The stock Python adapter now provides bounded source classification, static
imports, dependency graphs, conventional test relationships, and supplied-LCOV
eligibility. Python analysis deliberately omits the TypeScript public-surface
comparison and records that omission as a limitation.

Python does not expose one repository-independent static export boundary
equivalent to an explicit TypeScript export:

- the language reference defines module public names for wildcard import through
  `__all__`, or otherwise through the runtime module namespace and the
  underscore convention;
- `__all__` does not prevent direct attribute access or a named import;
- module-level `__getattr__`, `__dir__`, module subclassing, executed imports,
  assignments, and control flow can add or expose attributes dynamically;
- the typing specification defines a separate library-interface convention,
  import re-export rules, stub precedence, partial stubs, and additional
  statically supported `__all__` mutations;
- decorators, metaclasses, descriptors, and arbitrary annotations mean a
  declaration's source syntax is not necessarily the callable or class surface
  available to consumers.

Authoritative semantics:

- [Python import statement and `__all__`](https://docs.python.org/3/reference/simple_stmts.html#the-import-statement);
- [Python typing library-interface and re-export rules](https://typing.python.org/en/latest/spec/distributing.html#library-interface-public-and-private-symbols);
- [PEP 562 module `__getattr__` and `__dir__`](https://peps.python.org/pep-0562/);
- [Python function, decorator, class, and annotation semantics](https://docs.python.org/3/reference/compound_stmts.html).

The analyzer also lacks an explicit Python public-entry-point contract. Treating
every non-underscore module or every `__init__.py` as public would confuse
importability with a supported consumer API. Reading or executing packaging
configuration to infer distributions would violate the current trust boundary
and still would not establish maintainer intent.

## Decision

Do not implement scored Python `public-export` findings from inferred names or
syntactic signatures.

Python analysis continues to:

- skip the TypeScript public-surface comparison;
- emit no `public-export` finding from absent Python evidence;
- record one explicit limitation stating that Python public-surface comparison
  is not implemented;
- preserve result schema version 1 and the existing rule weight.

A future proposal may add **declared Python public-name evidence**, but it is not
a ready implementation packet. It must be separately selected and must satisfy
all of these constraints:

1. public entry points are explicit repository configuration rather than
   inferred from filenames, packaging execution, or installed environments;
2. evidence is limited to names from a complete, statically resolved
   module-level `__all__`;
3. unsupported assignments, mutations, imported `__all__` composition, control
   flow, parse recovery, duplicate names, missing referenced names, or dynamic
   module attributes make that entry point unavailable rather than partially
   inferred;
4. the initial comparison reports only added or removed declared names, not
   modified function, class, variable, decorator, annotation, or runtime
   signatures;
5. `.py` runtime surfaces and `.pyi` typing surfaces are not silently merged or
   substituted; any typing-surface mode requires its own explicit contract;
6. evidence is observational before any scoring change. Reusing the
   `public-export` rule requires a separate scoring and compatibility review.

The following remain rejected:

- executing Python, importing target modules, or evaluating target
  configuration;
- treating all non-underscore syntax as a supported API;
- recursively expanding wildcard imports without complete bounded evidence;
- guessing dynamic attributes, decorator effects, metaclass behavior, generated
  members, or conditional/version-specific exports;
- presenting annotation or source-text differences as runtime compatibility
  conclusions;
- using a `.pyi` file as proof of the runtime surface or a `.py` file as proof
  of the distributed typing surface.

## Consequences

- Python graph support remains useful without a weak compatibility claim;
- Python and TypeScript results continue to differ explicitly in capability;
- the existing Python limitation is intentional rather than an unfinished
  implied feature;
- repositories with carefully maintained `__all__` do not yet receive export
  evidence;
- changes to implicit public names, direct attributes, dynamic exports,
  signatures, and typing-only interfaces are not detected;
- a future narrow evidence mode would require additive configuration and
  separate design, implementation, verification, and scoring checkpoints.
