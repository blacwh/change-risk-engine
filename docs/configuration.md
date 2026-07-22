# Configuration

Configuration is validated by `@change-risk/config`. Version 1 rejects unknown
keys and unsupported schema versions.

```json
{
  "schemaVersion": 1,
  "ignorePatterns": ["dist/**"],
  "analysis": {
    "maxEntries": 100000,
    "maxFileBytes": 1000000,
    "maxFiles": 10000,
    "maxGraphEdges": 1000000,
    "maxTraversalDepth": 20
  },
  "thresholds": {
    "moderate": 20,
    "high": 50,
    "critical": 80
  },
  "sensitiveAreas": [
    { "id": "authentication", "patterns": ["src/auth/**"] }
  ],
  "rules": {
    "large-change": { "enabled": true, "weight": 15 }
  }
}
```

Omitted sections receive deterministic defaults. Thresholds must increase from
moderate to high to critical. Directory-entry, file-count, file-size, graph-edge,
and graph-depth limits are positive and bounded. Pattern syntax is stored as data
in v1 and will be interpreted by later policy capabilities.
