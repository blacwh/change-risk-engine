# ADR 0013: Built-in policy packs

## Status

Accepted

## Context

Configuration schema version 1 exposes deterministic thresholds, sensitive
areas, and rule settings, but each repository must repeat a complete review
posture. Reusable defaults are useful only if their origin, contents, merge
order, and limits remain explicit. Loading packs from a repository module,
package registry, or network service would expand the target-code execution and
supply-chain boundary.

## Decision

Add an ordered `policyPacks` list to configuration schema version 1. Accept only
bounded built-in IDs whose definitions ship with the analyzer. Compose packs
from left to right, then apply explicit repository configuration over the
result. Packs may supply only existing classification thresholds,
sensitive-area definitions, and rule settings.

The first definitions are:

- `strict-review`, an explicitly uncalibrated conservative review posture;
- `security-sensitive`, a documented set of common security-sensitive path
  patterns.

The stock CLI and GitHub Action use the same configuration resolver. No pack is
selected by default, and pack identity does not change result schema version 1.

## Consequences

- repeated policy defaults are versioned with the analyzer and validated at the
  existing configuration trust boundary;
- explicit configuration remains authoritative and can replace or refine pack
  defaults;
- pack order is semantically meaningful and therefore preserved;
- findings and score contributions remain produced by existing transparent
  rules;
- built-in thresholds and patterns are heuristics with documented false-positive
  and false-negative risks;
- external packs, automatic selection, executable configuration, and remote
  registries remain out of scope.
