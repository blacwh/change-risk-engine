# Git Evidence

`@change-risk/git-adapter` resolves the requested base and head names to full
commit object IDs before collecting a diff. The returned envelope always includes
those exact IDs and a normalized list of changed files.

Each changed file records its final path, status, additions, deletions, and
whether Git classified its content as binary. Renames also record the previous
path. Type changes are represented as modifications. Binary files use zero line
counts because Git does not supply meaningful additions or deletions for them.

Collection uses Git rename detection at a configurable integer similarity
threshold from 0 through 100, defaulting to 50. Name-status and numstat output
must describe the same final paths; mismatches and unknown statuses are errors.

All output is NUL-delimited. This preserves spaces, tabs, and newlines in paths.
The current adapter decodes Git output as UTF-8; repositories with non-UTF-8 path
bytes are a documented limitation and may not round-trip losslessly.

## Changed-line ranges

When supplied coverage is requested, the adapter separately collects bounded
zero-context patch evidence between the exact resolved commits. It invokes Git
with argument arrays, `--no-ext-diff`, and `--no-textconv`, then correlates
NUL-delimited raw final paths with patch sections in deterministic Git order.
It fixes the Myers algorithm, disables the indent heuristic, and uses a stable
submodule summary. Coverage orchestration supplies bounded literal top-level
pathspecs for eligible changed sources and both sides of eligible renames, so
rename detection is preserved while unrelated large patches do not remove the
refinement. Only numeric new-side hunk ranges are returned.

New files and replacement lines contribute their head-side line numbers.
Deleted-side lines, context, binary changes, mode-only changes, and unchanged
renames contribute no ranges. File count, range count, total changed lines,
subprocess output, and duration are bounded. Malformed or over-limit output
raises a stable error without returning paths or source lines. Coverage
orchestration converts that failure to a limitation and retains valid whole-file
LCOV evidence.
