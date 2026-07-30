# ADR 0014: Python adapter boundary

## Status

Accepted

## Context

The analyzer originally shipped with one built-in TypeScript/JavaScript language
adapter. Generic Git, path-policy, ownership, and line-count evidence could
observe Python paths without providing Python-aware analysis.

Python is the selected next language direction. Adding it must not weaken the
no-target-execution boundary, imply mixed-language support, or force a premature
public-surface model.

## Decision

Implement Python as a second built-in adapter in bounded packets. The foundation
discovers `.py` and `.pyi`, parses static imports with analyzer-bundled
non-executing code, and resolve only against deterministic module identities
derived from bounded repository files. It will not invoke Python, import target
modules, execute configuration, install dependencies, or access the network.

Stock selection is explicit and selects exactly one built-in adapter per
analysis. Configuration has a closed `language` selection with CLI and Action
overrides. TypeScript remains the default; there is no automatic detection or
mixed-language graph merging. A trusted programmatic `languageAdapter` object
remains the indexing authority, while the language selection controls stock
classification, test, and public-surface behavior.

Python source classification, conventional test relationships, and stock
selection were delivered in a separate integration packet. TypeScript-only
public-surface comparison is suppressed for Python analysis. A Python
public-surface model is deferred until its semantics and limitations can be
reviewed independently.

The foundation uses the JavaScript `@lezer/python` grammar and validates the
existing adapter contract. The stock integration retains configuration and
result schema version 1, preserves TypeScript defaults, and has focused
configuration, CLI, Action, coverage, packaging, and repeat-run evidence.

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
