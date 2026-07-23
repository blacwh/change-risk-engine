# ADR 0005: Static No-Script HTML Report

## Status

Accepted

## Context

Reviewers need a navigable visual report before the output schema includes a
portable dependency graph. A hosted application would add deployment, data
retention, network, and trust boundaries that are unnecessary for viewing one
analysis result. Client-side JSON loading would require script execution and can
be restricted by local browser file policies.

## Decision

Render the validated version 1 result directly to a self-contained HTML document
through the shared reporters package and expose it as CLI format `html`. Include
all findings, contributions, changed files, evidence, and limitations. Use only
semantic HTML and inline CSS, with no JavaScript, external assets, or network
requests. Apply a restrictive content security policy and escape all
repository-derived values.

Keep dependency nodes and edges out of this report until they have an explicit,
versioned output contract. Do not infer a graph from finding prose.

## Consequences

- reports can be archived or opened locally without a server;
- the standalone CLI can generate the viewer without another package;
- the document remains useful with scripts disabled and in offline environments;
- large validated results produce proportionally large HTML files;
- interactive graph navigation requires a later schema and viewer milestone.
