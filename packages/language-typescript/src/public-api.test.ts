import { describe, expect, it } from 'vitest';

import { comparePublicExportSurfaces } from './public-api.js';

describe('TypeScript public export comparison', () => {
  it('detects added, removed, and signature-modified exports in stable order', () => {
    const comparison = comparePublicExportSurfaces(
      [
        {
          path: 'src/index.ts',
          source: [
            'export function changed(value: string): string { return value; }',
            'export const removed = 1;',
            "export { external as alias } from './external.js';",
          ].join('\n'),
        },
      ],
      [
        {
          path: 'src/index.ts',
          source: [
            'export function changed(value: number): string { return String(value); }',
            'export const added = true;',
            "export { external as alias } from './external.js';",
          ].join('\n'),
        },
      ],
    );
    expect(comparison).toEqual({
      changes: [
        { path: 'src/index.ts', exportName: 'added', change: 'added' },
        { path: 'src/index.ts', exportName: 'changed', change: 'modified' },
        { path: 'src/index.ts', exportName: 'removed', change: 'removed' },
      ],
      issues: [],
    });
  });

  it('ignores function bodies, private class members, and method bodies', () => {
    const base = `
      export function stable(value: string): string { return value; }
      export class Service {
        private secret = 1;
        public run(value: string): string { return value; }
      }
    `;
    const head = `
      export function stable(value: string): string { return value.toUpperCase(); }
      export class Service {
        private secret = 999;
        public run(value: string): string { return value.trim(); }
      }
    `;
    expect(
      comparePublicExportSurfaces(
        [{ path: 'src/index.ts', source: base }],
        [{ path: 'src/index.ts', source: head }],
      ).changes,
    ).toEqual([]);
  });

  it('preserves literal contents while ignoring signature formatting', () => {
    expect(
      comparePublicExportSurfaces(
        [{ path: 'src/index.ts', source: "export const value='a  b';" }],
        [{ path: 'src/index.ts', source: "export   const value = 'a b';" }],
      ).changes,
    ).toEqual([
      { path: 'src/index.ts', exportName: 'value', change: 'modified' },
    ]);
    expect(
      comparePublicExportSurfaces(
        [
          {
            path: 'src/index.ts',
            source: 'export function run(a:string):void;',
          },
        ],
        [
          {
            path: 'src/index.ts',
            source: 'export function run( a: string ): void;',
          },
        ],
      ).changes,
    ).toEqual([]);
  });

  it('reports parse and size issues instead of inferring incomplete changes', () => {
    const parsed = comparePublicExportSurfaces(
      [{ path: 'src/index.ts', source: 'export const value = ;' }],
      [{ path: 'src/index.ts', source: 'export const value = 1;' }],
    );
    expect(parsed.changes).toEqual([]);
    expect(parsed.issues[0]).toMatchObject({
      kind: 'parse-error',
      path: 'src/index.ts',
    });

    const bounded = comparePublicExportSurfaces(
      [],
      [{ path: 'src/large.ts', source: 'export const value = 1;' }],
      4,
    );
    expect(bounded).toEqual({
      changes: [],
      issues: [{ kind: 'source-too-large', path: 'src/large.ts' }],
    });
  });
});
