import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

import ts from 'typescript';

import {
  discoverTypeScriptFiles,
  type DiscoveryIssue,
  type DiscoveryOptions,
} from './discovery.js';

export type ImportKind =
  'dynamic-import' | 'export' | 'import' | 'import-equals' | 'require';
export type ImportReference = {
  specifier: string;
  kind: ImportKind;
  typeOnly: boolean;
};
export type ModuleRecord = {
  path: string;
  imports: readonly ImportReference[];
};
export type IndexIssue =
  | DiscoveryIssue
  | {
      kind: 'file-too-large' | 'path-outside-root' | 'unreadable-file';
      path: string;
    }
  | {
      kind: 'parse-error';
      path: string;
      code: number;
      line: number;
      column: number;
    };
export type ModuleIndex = {
  repositoryRoot: string;
  modules: readonly ModuleRecord[];
  issues: readonly IndexIssue[];
};
export type IndexOptions = DiscoveryOptions & { maxFileBytes?: number };

function scriptKind(path: string): ts.ScriptKind {
  if (/\.tsx$/iu.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/iu.test(path)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/iu.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function stringArgument(node: ts.CallExpression): string | undefined {
  const argument = node.arguments[0];
  return argument !== undefined && ts.isStringLiteralLike(argument)
    ? argument.text
    : undefined;
}

function importIsTypeOnly(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (clause?.isTypeOnly === true) return true;
  return (
    clause?.name === undefined &&
    clause?.namedBindings !== undefined &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function exportIsTypeOnly(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true;
  return (
    node.exportClause !== undefined &&
    ts.isNamedExports(node.exportClause) &&
    node.exportClause.elements.length > 0 &&
    node.exportClause.elements.every((element) => element.isTypeOnly)
  );
}

function importsFrom(sourceFile: ts.SourceFile): ImportReference[] {
  const imports: ImportReference[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        kind: 'import',
        typeOnly: importIsTypeOnly(node),
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        kind: 'export',
        typeOnly: exportIsTypeOnly(node),
      });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const expression = node.moduleReference.expression;
      if (expression !== undefined && ts.isStringLiteralLike(expression)) {
        imports.push({
          specifier: expression.text,
          kind: 'import-equals',
          typeOnly: node.isTypeOnly,
        });
      }
    } else if (ts.isCallExpression(node)) {
      const specifier = stringArgument(node);
      if (
        specifier !== undefined &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        imports.push({ specifier, kind: 'dynamic-import', typeOnly: false });
      } else if (
        specifier !== undefined &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        imports.push({ specifier, kind: 'require', typeOnly: false });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return imports;
}

export async function indexTypeScriptProject(
  repositoryRoot: string,
  options: IndexOptions = {},
): Promise<ModuleIndex> {
  const maxFileBytes = options.maxFileBytes ?? 1_000_000;
  if (
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes <= 0 ||
    maxFileBytes > 100_000_000
  ) {
    throw new Error('maxFileBytes must be an integer from 1 to 100000000');
  }
  const discovery = await discoverTypeScriptFiles(repositoryRoot, options);
  const issues: IndexIssue[] = [...discovery.issues];
  const modules: ModuleRecord[] = [];

  for (const path of discovery.files) {
    let handle;
    try {
      const canonicalPath = await realpath(
        join(discovery.repositoryRoot, path),
      );
      const fromRoot = relative(discovery.repositoryRoot, canonicalPath);
      if (
        fromRoot === '..' ||
        fromRoot.startsWith(`..${sep}`) ||
        isAbsolute(fromRoot)
      ) {
        issues.push({ kind: 'path-outside-root', path });
        continue;
      }
      handle = await open(
        canonicalPath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const stats = await handle.stat();
      if (!stats.isFile()) throw new Error('Not a regular file');
      if (stats.size > maxFileBytes) {
        issues.push({ kind: 'file-too-large', path });
        continue;
      }
      const source = await handle.readFile('utf8');
      const sourceFile = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(path),
      );
      const diagnostics = (
        sourceFile as ts.SourceFile & {
          parseDiagnostics?: readonly ts.Diagnostic[];
        }
      ).parseDiagnostics;
      for (const diagnostic of diagnostics ?? []) {
        const position =
          diagnostic.start === undefined
            ? { line: 0, character: 0 }
            : sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
        issues.push({
          kind: 'parse-error',
          path,
          code: diagnostic.code,
          line: position.line + 1,
          column: position.character + 1,
        });
      }
      modules.push({ path, imports: importsFrom(sourceFile) });
    } catch {
      issues.push({ kind: 'unreadable-file', path });
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close();
        } catch {
          issues.push({ kind: 'unreadable-file', path });
        }
      }
    }
  }
  return { repositoryRoot: discovery.repositoryRoot, modules, issues };
}
