# File Classification

Classification is deterministic and based only on the repository-relative path.
It does not read or execute file content. Paths are compared case-insensitively
with forward-slash separators.

A file can have multiple categories. This preserves useful distinctions without
forcing a hidden precedence rule: test source counts as both test and source,
generated source remains visible as source, and lockfiles count as dependency
changes and lockfiles. Categories are emitted in the stable order defined by the
v1 result schema, regardless of which pattern matched first.

When `typescript` is selected, `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`,
`.mjs`, `.cjs`, `.vue`, and `.svelte` are source. When `python` is selected,
only `.py` and `.pyi` are source. Python tests are `.py` files below a `tests`
directory or named `test_*.py` or `*_test.py`; `.pyi` stubs are not tests.
Defaults also recognize documentation, dependency manifests and lockfiles,
generated directories, infrastructure, CI, migrations, tool configuration, and
static assets independently of language. See
[language support](language-support.md) before interpreting a category as
parser or graph support.

The dependency defaults are currently JavaScript-ecosystem names:
`package.json`, `deno.json`, `deno.jsonc`, `package-lock.json`,
`npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, and Bun lockfiles. Python
package metadata and lockfiles are not yet dependency-classified.

Public API comparison, conventional test relationships, and sensitive-path
analysis remain separate capabilities. Repository-specific sensitive patterns
belong to versioned configuration rather than this generic classifier.
