import { posix } from 'node:path';

import ts from 'typescript';

export type SourceSnapshot = { path: string; source: string };
export type PublicExportRecord = { name: string; signature: string };
export type PublicExportChange = {
  path: string;
  exportName: string;
  change: 'added' | 'modified' | 'removed';
};
export type PublicApiIssue = {
  kind: 'parse-error' | 'source-too-large';
  path: string;
  code?: number;
  line?: number;
  column?: number;
};
export type PublicApiComparison = {
  changes: readonly PublicExportChange[];
  issues: readonly PublicApiIssue[];
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validatePath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 4_096 ||
    path.includes('\\') ||
    path.includes('\0') ||
    posix.isAbsolute(path) ||
    path === '..' ||
    path.startsWith('../') ||
    posix.normalize(path) !== path
  ) {
    throw new Error('Source snapshots require normalized repository paths');
  }
}

function normalizeSignature(value: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    value,
  );
  const tokens: string[] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    tokens.push(scanner.getTokenText());
  }
  return tokens.join(' ');
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ??
        false)
    : false;
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  );
}

function declarationName(node: ts.DeclarationStatement): string | undefined {
  if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) return 'default';
  return node.name !== undefined && ts.isIdentifier(node.name)
    ? node.name.text
    : undefined;
}

function memberIsPrivate(member: ts.ClassElement): boolean {
  return (
    (member.name !== undefined && ts.isPrivateIdentifier(member.name)) ||
    hasModifier(member, ts.SyntaxKind.PrivateKeyword)
  );
}

function memberSignature(member: ts.ClassElement, file: ts.SourceFile): string {
  if (
    (ts.isMethodDeclaration(member) ||
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member) ||
      ts.isConstructorDeclaration(member)) &&
    member.body !== undefined
  ) {
    return `${file.text.slice(member.getStart(file), member.body.getStart(file))};`;
  }
  if (ts.isPropertyDeclaration(member) && member.initializer !== undefined) {
    return `${file.text.slice(member.getStart(file), member.initializer.getStart(file))};`;
  }
  return member.getText(file);
}

function declarationSignature(
  node: ts.DeclarationStatement,
  file: ts.SourceFile,
): string {
  if (ts.isFunctionDeclaration(node) && node.body !== undefined) {
    return normalizeSignature(
      `${file.text.slice(node.getStart(file), node.body.getStart(file))};`,
    );
  }
  if (ts.isClassDeclaration(node)) {
    const members = node.members
      .filter((member) => !memberIsPrivate(member))
      .map((member) => memberSignature(member, file));
    const headerEnd = node.members[0]?.getStart(file) ?? node.end - 1;
    const header = file.text.slice(node.getStart(file), headerEnd);
    return normalizeSignature(`${header} ${members.join(' ')} }`);
  }
  return normalizeSignature(node.getText(file));
}

function recordsFrom(file: ts.SourceFile): PublicExportRecord[] {
  const records: PublicExportRecord[] = [];
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      const signature = normalizeSignature(statement.getText(file));
      if (
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const element of statement.exportClause.elements) {
          records.push({ name: element.name.text, signature });
        }
      } else {
        const moduleName = statement.moduleSpecifier;
        records.push({
          name:
            moduleName !== undefined && ts.isStringLiteralLike(moduleName)
              ? `*:${moduleName.text}`
              : '*',
          signature,
        });
      }
    } else if (ts.isExportAssignment(statement)) {
      records.push({
        name: 'default',
        signature: normalizeSignature(statement.getText(file)),
      });
    } else if (
      ts.isVariableStatement(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      const signature = normalizeSignature(statement.getText(file));
      for (const declaration of statement.declarationList.declarations) {
        for (const name of bindingNames(declaration.name)) {
          records.push({ name, signature });
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      const name = declarationName(statement);
      if (name !== undefined) {
        records.push({
          name,
          signature: declarationSignature(statement, file),
        });
      }
    }
  }

  const grouped = new Map<string, string[]>();
  for (const record of records) {
    const signatures = grouped.get(record.name) ?? [];
    signatures.push(record.signature);
    grouped.set(record.name, signatures);
  }
  return [...grouped.entries()]
    .map(([name, signatures]) => ({
      name,
      signature: [...new Set(signatures)].sort(compareText).join('\n'),
    }))
    .sort((left, right) => compareText(left.name, right.name));
}

function indexSnapshots(
  snapshots: readonly SourceSnapshot[],
  maxSourceBytes: number,
): {
  records: Map<string, readonly PublicExportRecord[]>;
  issues: PublicApiIssue[];
} {
  if (snapshots.length > 100_000)
    throw new Error('Source snapshot limit exceeded');
  const records = new Map<string, readonly PublicExportRecord[]>();
  const issues: PublicApiIssue[] = [];
  for (const snapshot of snapshots) {
    validatePath(snapshot.path);
    if (records.has(snapshot.path))
      throw new Error('Source snapshot paths must be unique');
    if (Buffer.byteLength(snapshot.source, 'utf8') > maxSourceBytes) {
      issues.push({ kind: 'source-too-large', path: snapshot.path });
      records.set(snapshot.path, []);
      continue;
    }
    const file = ts.createSourceFile(
      snapshot.path,
      snapshot.source,
      ts.ScriptTarget.Latest,
      true,
    );
    const diagnostics = (
      file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
    ).parseDiagnostics;
    if ((diagnostics?.length ?? 0) > 0) {
      for (const diagnostic of diagnostics ?? []) {
        const position =
          diagnostic.start === undefined
            ? { line: 0, character: 0 }
            : file.getLineAndCharacterOfPosition(diagnostic.start);
        issues.push({
          kind: 'parse-error',
          path: snapshot.path,
          code: diagnostic.code,
          line: position.line + 1,
          column: position.character + 1,
        });
      }
      records.set(snapshot.path, []);
      continue;
    }
    records.set(snapshot.path, recordsFrom(file));
  }
  return { records, issues };
}

export function comparePublicExportSurfaces(
  base: readonly SourceSnapshot[],
  head: readonly SourceSnapshot[],
  maxSourceBytes = 1_000_000,
): PublicApiComparison {
  if (
    !Number.isSafeInteger(maxSourceBytes) ||
    maxSourceBytes <= 0 ||
    maxSourceBytes > 4_000_000
  ) {
    throw new Error('maxSourceBytes must be an integer from 1 to 4000000');
  }
  const baseIndex = indexSnapshots(base, maxSourceBytes);
  const headIndex = indexSnapshots(head, maxSourceBytes);
  const issues = [...baseIndex.issues, ...headIndex.issues].sort(
    (left, right) =>
      compareText(left.path, right.path) || compareText(left.kind, right.kind),
  );
  const invalidPaths = new Set(issues.map(({ path }) => path));
  const paths = [
    ...new Set([...baseIndex.records.keys(), ...headIndex.records.keys()]),
  ].sort(compareText);
  const changes: PublicExportChange[] = [];
  for (const path of paths) {
    if (invalidPaths.has(path)) continue;
    const before = new Map(
      (baseIndex.records.get(path) ?? []).map((record) => [
        record.name,
        record,
      ]),
    );
    const after = new Map(
      (headIndex.records.get(path) ?? []).map((record) => [
        record.name,
        record,
      ]),
    );
    const names = [...new Set([...before.keys(), ...after.keys()])].sort(
      compareText,
    );
    for (const exportName of names) {
      const oldRecord = before.get(exportName);
      const newRecord = after.get(exportName);
      if (oldRecord === undefined)
        changes.push({ path, exportName, change: 'added' });
      else if (newRecord === undefined)
        changes.push({ path, exportName, change: 'removed' });
      else if (oldRecord.signature !== newRecord.signature)
        changes.push({ path, exportName, change: 'modified' });
    }
  }
  return { changes, issues };
}
