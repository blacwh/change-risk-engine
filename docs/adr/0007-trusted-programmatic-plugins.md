# ADR 0007: Trusted Programmatic Plugin Boundary

## Status

Accepted

## Context

Rule packs and language adapters need a stable composition contract, but loading
code from the repository under analysis would violate the default no-execution
boundary. Manifest files cannot make executable JavaScript safe, and automatic
package installation would add network and lifecycle-script risk.

## Decision

Define plugin API version 1 as an in-process contract for trusted embedding
hosts. Validate and bound plugin IDs, API versions, rule/adapter counts, rule
weights, required functions, and global component ID uniqueness. Sort all
components and freeze copied metadata without invoking plugin functions during
registration.

Expose explicitly supplied rule sets and one explicitly selected language
adapter through programmatic analysis options. Make the built-in TypeScript
indexer implement the same adapter interface. Do not add CLI/Action plugin flags,
repository discovery, dynamic imports, package installation, or target config
execution.

## Consequences

- hosts can compose deterministic rule packs and adapters without forking core;
- built-ins and extensions share collision and ordering rules;
- extension code has the host's privileges and must already be trusted;
- untrusted third-party plugins require isolation outside this contract;
- automatic discovery and multi-language graph merging remain future work.

