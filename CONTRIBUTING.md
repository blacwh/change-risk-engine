# Contributing

Open an issue before changing schemas, scoring semantics, security boundaries, language support, execution behavior, or plugin architecture. Use an ADR for significant decisions.

Pull requests should include:

- problem and scope;
- affected contracts;
- tests and fixtures;
- example report changes;
- performance and security impact;
- known false positives and negatives.

A new rule requires a stable ID, purpose, evidence, default weight, configuration, positive and negative fixtures, false-positive discussion, and remediation guidance.

Never add default behavior that executes analyzed repository code.
