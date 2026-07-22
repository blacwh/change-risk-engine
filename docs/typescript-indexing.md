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
