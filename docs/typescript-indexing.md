# TypeScript and JavaScript Indexing

`@change-risk/language-typescript` discovers `.ts`, `.tsx`, `.mts`, `.cts`,
`.js`, `.jsx`, `.mjs`, and `.cjs` files, including declaration files. Default
ignored directories are `.git`, `node_modules`, `dist`, `build`, `coverage`, and
`vendor`. Callers may replace that directory-name set explicitly.

Discovery order is deterministic and independent of filesystem enumeration.
Defaults bound traversal to 100,000 directory entries and 10,000 source files.
Indexing additionally limits each source file to 1,000,000 bytes. Reaching a
limit produces an issue rather than silently claiming complete analysis.

The indexer recognizes:

- ESM imports, including side-effect and type-only imports;
- re-exports with module specifiers;
- TypeScript import-equals declarations;
- CommonJS `require()` calls with string literals;
- dynamic `import()` calls with string literals.

Computed specifiers are intentionally not guessed. A locally shadowed `require`
identifier may currently be reported as a CommonJS reference; resolution will
determine whether the specifier maps to a repository module.

Syntax diagnostics record only file, diagnostic code, line, and column. The
adapter can still return imports recovered from a syntactically incomplete file,
but consumers must reduce confidence whenever issues are present. Indexing alone
does not load configuration, install packages, resolve plugins, or execute target code.

`typeScriptLanguageAdapter` exposes this bounded repository index through plugin
API version 1's shared language-adapter contract. Programmatic hosts select it
explicitly; the adapter does not discover other adapters or executable plugins.

## Module resolution

Resolution operates only on discovered module paths. Relative imports support
extensionless files, directory `index` files, and TypeScript substitution for
`.js`, `.jsx`, `.mjs`, and `.cjs` specifiers. A root `tsconfig.json` may provide
JSONC `baseUrl` and single-wildcard `paths` mappings. Mapping targets must remain
inside the repository.

For safety and explicitness, `extends` is reported but not followed. Package
exports, package `imports`, project references, and target dependencies are not
read. A relative or matched-alias miss becomes an `unresolved-import` issue.
An unmatched bare specifier such as `react` is classified as external because
the analyzer neither needs nor installs that package to build the repository
graph.

## Public surfaces

`comparePublicExportSurfaces` compares caller-selected source snapshots from two
resolved revisions. It recognizes exported declarations, variables, named and
star re-exports, and export assignments. Function and public method bodies plus
private class members are excluded so implementation-only edits do not appear as
surface changes. Added, modified, and removed export names are deterministically
ordered.

This is a conservative syntactic comparison, not TypeScript type checking.
Inferred variable/property types, declaration merging, package export maps, and
runtime mutation can be incomplete. Parse errors and sources over the configured
byte bound produce explicit issues and suppress comparisons for that path.

## Test relationships

`inferConventionalTestRelationships` maps TypeScript/JavaScript modules using
colocated `.test`/`.spec` files and normalized `src`, `test`, `tests`, `spec`, and
`__tests__` directory identities. Results and paths are stable and bounded. Each
non-test module receives a record; an empty test list means the convention found
no related test. The mapping is evidence for policy, not proof of coverage or
test quality.
