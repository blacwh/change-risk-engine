# Supplied coverage evidence

The analyzer can consume one caller-supplied LCOV tracefile and relate its line
coverage to changed source files. The CLI option is
`--coverage <repository-relative-path>`; the GitHub Action input is `coverage`.
Neither interface discovers artifacts, runs tests, installs dependencies, or
executes repository code.

## Evidence contract

Coverage relationships include every changed file that is:

- not deleted;
- classified as source; and
- not classified as test or generated.

Each relationship contains the repository-relative path plus `linesFound` and
`linesHit`. A source missing from a valid tracefile receives explicit `null`
counts. A source record with `LF:0` and `LH:0` remains distinct and represents
no measurable lines.

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

The artifact path must be repository-relative and normalize inside the
canonical repository root. Parent-directory and final-file symbolic links are
rejected. The reader opens the final path without following links and requires
a regular file.

Default parser limits are 10 MB, 1,000,000 lines, 10,000 characters per line,
100,000 source records, 1,000 characters per source path, and 2,000,000 `DA`
records. Retained issues are capped at 100. Limit failures expose only a stable
issue kind and optional line number; report limitations never copy artifact
source text.

## Policy and limitations

The built-in [`insufficient-coverage`](rules/insufficient-coverage.md) rule uses
the complete relationship set. Coverage data remains caller-supplied evidence:
the analyzer does not verify when it was generated, which revision it describes,
which test commands ran, or whether the test suite was complete. Every analysis
that accepts a coverage path states this freshness and revision-alignment
limitation.

The artifact may be generated and ignored rather than committed. If it is an
untracked, non-ignored file, the analyzer's existing clean-head invariant will
omit filesystem-derived dependency, test-relationship, and ownership evidence.
Use a repository-ignored artifact location when those evidence sources should
remain eligible.

The integration does not support branch or function thresholds, changed-line
coverage, multiple or remote artifacts, artifact merging, historical deltas, or
formats other than LCOV. It does not declare a change adequately tested.
Coverage evidence and findings use the existing version 1 evidence model, so no
result-schema change is required.
