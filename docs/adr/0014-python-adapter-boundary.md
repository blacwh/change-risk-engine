# ADR 0014: Python adapter boundary

## Status

Proposed

## Context

The released analyzer has one built-in TypeScript/JavaScript language adapter.
Generic Git, path-policy, ownership, and line-count evidence can observe Python
paths, but the stock source classifier, module graph, conventional test mapping,
public-surface comparison, and coverage eligibility do not currently provide
Python-aware analysis.

Python is the selected next language direction. Adding it must not weaken the
no-target-execution boundary, imply mixed-language support, or force a premature
public-surface model.

## Decision

Implement Python as a second built-in adapter in bounded packets. The foundation
will discover `.py` and `.pyi`, parse static imports with analyzer-bundled
non-executing code, and resolve only against deterministic module identities
derived from bounded repository files. It will not invoke Python, import target
modules, execute configuration, install dependencies, or access the network.

Stock selection will be explicit and will select exactly one built-in adapter
per analysis. The proposed public surface is a closed `language` selection in
configuration with CLI and Action overrides. TypeScript remains the default;
there is no automatic detection or mixed-language graph merging.

Python source classification, conventional test relationships, and stock
selection belong to a separate integration packet. TypeScript-only
public-surface comparison must be suppressed for Python analysis. A Python
public-surface model is deferred until its semantics and limitations can be
reviewed independently.

The foundation uses the JavaScript `@lezer/python` grammar and validates the
existing adapter contract without stock behavior changes. Compatibility
treatment of the selection surface still requires integration-time review. This
ADR remains Proposed until the stock integration contract is validated and
accepted.

## Consequences

- Python graph support can be delivered without executing an interpreter or
  target repository code;
- repository-root and conventional root `src` layouts receive a deterministic
  initial resolution model, while ambiguous identities remain explicit;
- stock results remain single-language and cannot describe cross-language
  dependencies;
- generic path evidence remains available independently of language-aware
  evidence;
- initial Python analysis will not claim public-export evidence;
- configurable source roots, dynamic imports, environment-dependent resolution,
  namespace-package composition, and languages beyond Python remain future
  work;
- result schema version 1 should remain unchanged unless implementation proves
  that an explicit compatibility change is necessary.
