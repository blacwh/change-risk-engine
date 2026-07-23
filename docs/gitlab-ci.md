# GitLab CI

The CLI works in GitLab merge-request and default-branch pipelines without a
GitLab API token. The analyzer needs the exact base and head commits plus a clean
checkout of the head tree; it does not need project-write permission.

[`examples/gitlab-ci.yml`](../examples/gitlab-ci.yml) is a working self-analysis
job for a GitLab mirror of this repository. It:

- requests full Git history with `GIT_DEPTH: '0'`;
- uses `CI_MERGE_REQUEST_DIFF_BASE_SHA` for merge requests and
  `CI_COMMIT_BEFORE_SHA` for default-branch pushes;
- rejects the all-zero or absent push base instead of guessing;
- installs this repository's locked analyzer dependencies with lifecycle scripts
  disabled, then builds the CLI;
- writes versioned JSON before applying the `high` classification gate;
- retains the JSON artifact for 14 days even when the gate fails.

Copy the example to `.gitlab-ci.yml` in a mirror of this repository. For another
project, install a released Change Risk Engine tarball as a CI tool instead of
copying the source-build steps. Pin an immutable release version, verify its
entry in the release `SHA256SUMS`, and install with lifecycle scripts disabled:

```sh
sha256sum --check SHA256SUMS --ignore-missing
npm install --global --ignore-scripts ./change-risk-engine-0.1.0.tgz
change-risk analyze \
  --base "$CI_MERGE_REQUEST_DIFF_BASE_SHA" \
  --head "$CI_COMMIT_SHA" \
  --format json \
  --fail-on high > change-risk-report.json
```

Do not use an unpinned branch archive or skip checksum verification. Configure
the job with `artifacts: when: always` so exit code 2 preserves the report. The
command does not install target dependencies, run target tests, or send data to
an external service.

