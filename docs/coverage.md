# Supplied coverage evidence

The analyzer can consume one caller-supplied head LCOV tracefile and relate its
line coverage to changed source files. It can optionally compare that evidence
with one caller-supplied baseline LCOV tracefile. The CLI options are
`--coverage <repository-relative-path>` and
`--baseline-coverage <repository-relative-path>`; the GitHub Action inputs are
`coverage` and `baseline-coverage`. A baseline requires head coverage. Neither
interface discovers or retrieves artifacts, runs tests, installs dependencies,
or executes repository code.

## Evidence contract

Coverage relationships include every changed file that is:

- not deleted;
- classified as source; and
- not classified as test or generated.

Each relationship contains the repository-relative path plus `linesFound` and
`linesHit`. A source missing from a valid tracefile receives explicit `null`
counts. A source record with `LF:0` and `LH:0` remains distinct and represents
no measurable lines.

Eligibility follows the explicitly selected language. TypeScript selection
uses the documented TS/JS source set; Python selection uses `.py` and `.pyi`
while excluding Python test conventions. The LCOV format and trust boundary are
otherwise identical.

When a baseline is supplied and valid, each relationship also contains the
base-side path and baseline `linesFound` and `linesHit`. Renames use the Git
diff's `previousPath`; other sources use their current path. Missing baseline
records receive paired `null` counts. Percentage change is derived only when
both records have measurable lines, so a missing or zero-measurable baseline
does not become a regression claim.

When exact changed-line Git evidence is available, the relationship also
contains:

- `changedLineCount`: all new-side lines in zero-context hunks;
- `changedLinesFound`: changed lines with an LCOV `DA` record; and
- `changedLinesHit`: instrumented changed lines with a non-zero count.

Additions and replacement lines are included. Context and deleted-side lines are
excluded. An unchanged rename or a modified file with only deletions has a zero
changed-line count and is not evaluated against a changed-line threshold. When a
file has new-side changed lines but none are instrumented, the changed-line
percentage is explicitly unmeasurable; non-instrumented lines are not counted as
uncovered.

The bounded parser accepts the LCOV `TN`, `SF`, `DA`, `LF`, `LH`, and
`end_of_record` line-coverage structure and ignores function, branch, and
version record payloads. `DA` checksums are accepted but not interpreted.
Source paths may be relative to the repository or absolute paths that normalize
inside it. Duplicate sources or line records, inconsistent summaries, unknown
records, invalid paths, invalid UTF-8, unterminated sections, and limit failures
invalidate the complete artifact. Partial relationships never reach rules.

This follows LCOV's documented tracefile structure while deliberately using
only line records. See the
[LCOV `geninfo` tracefile format](https://manpages.debian.org/unstable/lcov/geninfo.1.en.html).

## Security and bounds

Each artifact path must be repository-relative and normalize inside the
canonical repository root. Parent-directory and final-file symbolic links are
rejected. The reader opens the final path without following links and requires
a regular file.

Default parser limits are 10 MB, 1,000,000 lines, 10,000 characters per line,
100,000 source records, 1,000 characters per source path, and 2,000,000 `DA`
records. Changed-line mapping is capped at 1,000,000 new-side lines. Retained
issues are capped at 100. Limit failures expose only a stable issue kind and
optional line number; report limitations never copy artifact source text.

Changed-line ranges come from a separate bounded Git patch collection between
the exact resolved revisions. External diff and textconv execution are disabled.
Raw paths are NUL-delimited, patch output is bounded, and only numeric new-side
ranges are returned to analysis. Patch source content is never copied into
reports. If range collection fails, the report states a source-free limitation
and continues with valid whole-file LCOV evidence.

## Policy and limitations

The built-in [`insufficient-coverage`](rules/insufficient-coverage.md) rule uses
the complete head relationship set and an available complete baseline. It can
flag a whole-file percentage drop greater than `maxLinePercentDrop` without
adding a second score contribution. Coverage data remains caller-supplied
evidence: the analyzer does not verify when either artifact was generated, which
revision it describes, which test commands ran, or whether the suites and
instrumentation are comparable. Every accepted artifact states this freshness
and revision-alignment limitation.

Artifacts may be generated and ignored rather than committed. If either is an
untracked, non-ignored file, the analyzer's existing clean-head invariant will
omit filesystem-derived dependency, test-relationship, and ownership evidence.
Use repository-ignored artifact locations when those evidence sources should
remain eligible.

The integration does not support branch or function thresholds, deleted-line
coverage, multiple baselines, remote artifacts, artifact merging,
repository-wide trends, changed-line history, or formats other than LCOV. It
does not declare a change adequately tested.
Coverage evidence and findings use the existing version 1 evidence model, so no
result-schema change is required.
