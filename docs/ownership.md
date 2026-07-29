# Ownership evidence

The stock analyzer reads `.github/CODEOWNERS` from the clean worktree only when
that worktree matches the analyzed head commit before and after analysis. It
does not search the repository root or `docs/` fallback locations, call the
GitHub API, resolve team membership, or verify write access. This evidence
describes the analyzed head ownership policy; it does not emulate GitHub's
base-branch reviewer assignment.

The reader canonicalizes the repository and `.github` directory, rejects a
symbolic-link directory or file, opens the fixed file without following the
final link, and requires a regular UTF-8 file. It reads no ownership file when
the worktree invariant is unavailable.

## Syntax and matching

The supported syntax follows the documented CODEOWNERS subset:

- blank lines and lines beginning with `#` are ignored;
- a whitespace-preceded `#` begins an inline comment;
- owners may be `@user`, `@organization/team`, or an email address;
- a rule with no owner explicitly makes its matching paths unowned;
- matching is case-sensitive and the last matching rule wins;
- `*`, `**`, and `?` wildcards, root-leading `/`, and trailing directory `/`
  are supported;
- `!` negation, bracket ranges, and backslash escaping are rejected.

Patterns without a slash match names at any depth. Patterns containing a slash
are root-relative. A trailing slash or a literal final path segment includes
descendants, while a final wildcard segment does not: `docs/*` matches a direct
file but not a further nested file. These rules align with the examples in
[GitHub's CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners#codeowners-syntax).

The matcher uses bounded iterative wildcard operations rather than dynamically
constructed regular expressions. Input is limited to 1 MB, 100,000 lines,
50,000 characters per line, 10,000 rules, 1,000 characters per pattern, 100
owners per rule, 200 characters per owner, and 1,000,000 rule/path evaluations.
Invalid UTF-8 is rejected, and at most 100 parser issues are retained.

## Failure behavior

Missing, unreadable, linked, oversized, malformed, unsupported, or
computationally over-limit input produces explicit issue kinds and no ownership
relationships. The CLI converts those issues to limitations containing only
the issue kind and optional line number; it does not include CODEOWNERS source.
Suppressing the entire relationship set prevents a skipped or truncated rule
from becoming a false missing-owner finding.

When parsing succeeds, every changed path receives exactly one relationship.
The owners array is either the deduplicated owners from the last matching rule
or empty when no rule—or an explicit ownerless rule—wins.

## Limitations

The analyzer cannot determine whether an owner exists, has repository access,
is available, or approved a change. It does not support escaped whitespace in
patterns. Deleted and renamed paths are evaluated using their head-facing
changed path, not historical base ownership. Absence of a finding means only
that every changed path matched a syntactically accepted head-worktree rule.
