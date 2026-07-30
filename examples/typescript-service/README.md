# TypeScript service example

This configuration selects the built-in `security-sensitive` path defaults,
lowers the high-fan-in threshold, and tunes the large-change thresholds for a
small service. Explicit rule option keys override any corresponding pack
defaults.

From a repository containing this `.change-risk.json`, run:

```bash
change-risk analyze --base main --head HEAD
change-risk analyze --base main --head HEAD --format json
change-risk analyze --base main --head HEAD --fail-on high
```

The terminal report identifies exact revisions, changed line totals, findings,
effective score contributions, and analysis limitations. The JSON form preserves
the same evidence under the versioned output schema. A gate hit exits with code
2; analyzer or configuration failure exits with code 1.
