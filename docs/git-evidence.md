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
