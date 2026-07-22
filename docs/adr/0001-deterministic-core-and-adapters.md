# ADR 0001: Deterministic Core with Language Adapters

## Status

Accepted

## Decision

Use a deterministic core pipeline with separate adapters for Git evidence, language indexing, dependency analysis, rules, and reporters. Support TypeScript/JavaScript first. CLI and GitHub Action consume the same result model.

## Consequences

This improves testing, reuse, consistency, and future extensibility, but requires disciplined interfaces and avoids premature plugin complexity.
