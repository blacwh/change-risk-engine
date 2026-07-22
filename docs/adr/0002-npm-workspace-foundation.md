# ADR 0002: npm Workspace Foundation

## Status

Accepted

## Context

The engine needs enforceable boundaries between orchestration, repository I/O,
language indexing, graph analysis, rules, configuration, and reporting. The
foundation must also be usable without a global package manager or target
repository dependency installation.

## Decision

Use private npm workspaces for the documented applications and packages. Use a
shared strict TypeScript configuration, package-local builds, root quality
commands, and a lockfile-backed CI matrix.

Workspace entry points remain behavior-free until their capability milestone.
Publishing metadata and cross-package runtime dependencies will be introduced
only when real contracts exist.

## Consequences

- contributors need only Node.js and npm;
- package boundaries are visible and independently buildable;
- CI and local development use the same commands;
- the initial build emits empty modules by design;
- future milestones must add explicit workspace dependencies as contracts form.
