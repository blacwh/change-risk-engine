# Fixture Strategy

Repository integration fixtures belong under `packages/fixtures` and must be
small, deterministic, and safe to inspect without installing dependencies or
executing their code.

Each fixture should document:

- the capability or rule it exercises;
- the base and head revisions;
- expected evidence and findings;
- intentionally malformed or incomplete inputs;
- known false-positive and false-negative coverage.

Fixture repositories will be introduced with Git evidence. Later fixtures will
cover shared modules, public API changes, authentication, migrations, related
tests, cycles, parse failures, and monorepos.
