# Rules

Rules turn repository evidence into deterministic, reviewable findings. The
engine evaluates rules in stable ID order, links every finding to evidence, and
exposes the effective weight that later score aggregation will use. Rules can be
disabled or assigned a finite weight through configuration.

| Stable ID | Default weight | Signal |
| --- | ---: | --- |
| [`large-change`](large-change.md) | 20 | Changed file or line count exceeds a configured limit |
| [`multi-area-change`](multi-area-change.md) | 15 | Change crosses several top-level repository areas |
| [`sensitive-path`](sensitive-path.md) | 25 | Changed paths match a configured sensitive area |
| [`dependency-manifest`](dependency-manifest.md) | 15 | Dependency manifests or lockfiles changed |
| [`migration`](migration.md) | 25 | Migration-classified paths changed |
| [`infrastructure`](infrastructure.md) | 25 | Infrastructure or CI paths changed |

Every rule document identifies its stable ID, evidence, default weight,
configuration, remediation guidance, and known false-positive and false-negative
cases. A rule may not contribute to a score without exposing the contribution
and supporting evidence.
