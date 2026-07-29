# GitHub Action

The bundled Node 24 Action runs the same deterministic analysis as the CLI. It
uses the exact base and head object IDs in the GitHub event, writes the complete
version 1 JSON result, adds a Markdown job summary, exposes classification and
score outputs, and optionally maintains one pull-request comment.

## Workflow

```yaml
name: Change risk

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
          persist-credentials: false
          ref: ${{ github.event.pull_request.head.sha }}
      - id: risk
        uses: blacwh/change-risk-engine@v0.1.0
        env:
          GITHUB_TOKEN: ${{ github.event.pull_request.head.repo.full_name == github.repository && github.token || '' }}
        with:
          fail-on: high
          output: change-risk-report.json
      - name: Upload complete JSON report
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: change-risk-report
          path: change-risk-report.json
          if-no-files-found: error
          retention-days: 14
```

Use a released tag for readability or pin the Action to a full commit ID for an
immutable supply-chain boundary. Full history is required because both event
revisions must be available locally. The workflow does not install or execute
the analyzed repository's dependencies. Generate the coverage artifact in a
separate, appropriately isolated step before the analyzer when coverage policy
is desired, then add `coverage: coverage/lcov.info` to the Action's `with`
mapping.

## Inputs and outputs

| Input | Default | Meaning |
| --- | --- | --- |
| `config` | optional | Repository-relative JSON configuration path. |
| `coverage` | optional | Repository-relative caller-supplied LCOV tracefile. |
| `fail-on` | `none` | `none`, `low`, `moderate`, `high`, or `critical`. |
| `comment` | `true` | Maintain a comment when the pull request is from the same repository. |
| `output` | `change-risk-report.json` | Repository-relative JSON artifact path. |

Outputs are `classification`, `score`, and `json-path`. A configured gate exits
2 when the classification reaches its threshold; input, analysis, reporting, or
API failures exit 1. JSON, outputs, and the job summary are written before the
gate is applied. Use `if: always()` on artifact upload so gated changes retain
their evidence.

## Comments and forks

The Action updates only a marker-bearing comment owned by
`github-actions[bot]`; otherwise it creates a new comment. Searches and API
response sizes are bounded. The Markdown report escapes repository-derived
content and shows finding evidence IDs, configured weights, effective grouped
score contributions, and limitations. The JSON artifact remains the complete
source of record when a large report must be shortened.

When the checked-out head is clean, ownership analysis uses its bounded
`.github/CODEOWNERS` file and the shared `missing-owner` rule. This is head-tree
risk evidence, not a reproduction of GitHub's base-branch reviewer assignment.
Missing or invalid ownership input becomes a limitation and does not trigger the
rule.

Coverage input is bounded, no-follow, and all-or-nothing. A valid artifact maps
eligible changed sources and can trigger `insufficient-coverage`; invalid input
becomes a limitation and suppresses that rule. The Action does not generate or
discover coverage and cannot verify artifact freshness or revision alignment.
The shared analyzer derives bounded new-side changed-line ranges from the exact
event revisions without external diff or textconv execution. Hunk collection
failure preserves whole-file coverage and becomes an explicit limitation.

Fork pull requests never call the comments API, even if a token is present. They
still produce JSON, outputs, and a summary. The conditional token expression in
the example adds a second boundary by withholding the token from forks. Set
`comment: 'false'` and remove `pull-requests: write` when comments are not wanted.

Do not combine `pull_request_target`, privileged credentials, and a checkout of
untrusted pull-request code. Use the ordinary `pull_request` event shown above.
