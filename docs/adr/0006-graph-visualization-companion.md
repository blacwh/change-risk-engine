# ADR 0006: Versioned Graph Visualization Companion

## Status

Accepted

## Context

Analysis result version 1 intentionally contains findings and their evidence,
not a complete dependency graph. Adding optional graph fields under the same
version would silently change a strict public contract; upgrading the entire
result schema solely for HTML would force unrelated JSON consumers to migrate.
Inferring edges back from high-fan-in finding prose would be incomplete and
semantically fragile.

## Decision

Define a separately versioned `BlastRadiusVisualization` schema in core. Build it
from the eligible `DirectedDependencyGraph` with a bounded multi-source reverse
traversal from changed source modules. Preserve importer-to-dependency edges,
minimum dependent distance, fan-in/fan-out, source graph/change counts,
unindexed changed paths, and explicit truncation.

Pass this companion through an analysis-artifacts API only to HTML rendering.
Keep `analyzeRepository` and JSON result version 1 unchanged. Render a
deterministic SVG and an equivalent accessible table without JavaScript.

## Consequences

- JSON consumers retain their existing strict result contract;
- graph claims come from graph data rather than reconstructed finding text;
- visualization absence follows the existing dirty/mismatched-worktree
  limitation;
- bounds keep HTML and layout work predictable and disclose incompleteness;
- consumers wanting graph data can adopt the companion schema independently.
