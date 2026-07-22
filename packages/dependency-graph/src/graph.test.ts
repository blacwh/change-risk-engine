import { describe, expect, it } from 'vitest';

import {
  DirectedDependencyGraph,
  dependencyGraphFromModules,
} from './graph.js';

const graph = new DirectedDependencyGraph({
  nodes: [
    'packages/app/api.ts',
    'packages/app/ui.ts',
    'packages/service/index.ts',
    'packages/core/index.ts',
  ],
  edges: [
    { from: 'packages/app/api.ts', to: 'packages/service/index.ts' },
    { from: 'packages/app/ui.ts', to: 'packages/service/index.ts' },
    { from: 'packages/service/index.ts', to: 'packages/core/index.ts' },
    { from: 'packages/service/index.ts', to: 'packages/core/index.ts' },
  ],
  packageRoots: [
    { id: 'app', root: 'packages/app' },
    { id: 'service', root: 'packages/service' },
    { id: 'core', root: 'packages/core' },
  ],
});

describe('directed dependency graph', () => {
  it('deduplicates edges and calculates deterministic fan-in and fan-out', () => {
    expect(graph.edges()).toHaveLength(3);
    expect(graph.metrics()).toEqual([
      { path: 'packages/app/api.ts', fanIn: 0, fanOut: 1 },
      { path: 'packages/app/ui.ts', fanIn: 0, fanOut: 1 },
      { path: 'packages/core/index.ts', fanIn: 1, fanOut: 0 },
      { path: 'packages/service/index.ts', fanIn: 2, fanOut: 1 },
    ]);
    expect(graph.directDependents('packages/service/index.ts')).toEqual([
      'packages/app/api.ts',
      'packages/app/ui.ts',
    ]);
  });

  it('traverses dependents by distance and reports depth truncation', () => {
    expect(graph.transitiveDependents('packages/core/index.ts', 2)).toEqual({
      dependents: [
        { path: 'packages/service/index.ts', distance: 1 },
        { path: 'packages/app/api.ts', distance: 2 },
        { path: 'packages/app/ui.ts', distance: 2 },
      ],
      truncated: false,
    });
    expect(graph.transitiveDependents('packages/core/index.ts', 1)).toEqual({
      dependents: [{ path: 'packages/service/index.ts', distance: 1 }],
      truncated: true,
    });
  });

  it('identifies package-boundary crossings using the longest matching root', () => {
    expect(graph.boundaryCrossings()).toEqual([
      {
        from: 'packages/app/api.ts',
        to: 'packages/service/index.ts',
        fromPackage: 'app',
        toPackage: 'service',
      },
      {
        from: 'packages/app/ui.ts',
        to: 'packages/service/index.ts',
        fromPackage: 'app',
        toPackage: 'service',
      },
      {
        from: 'packages/service/index.ts',
        to: 'packages/core/index.ts',
        fromPackage: 'service',
        toPackage: 'core',
      },
    ]);
  });

  it('finds cycles iteratively, including self-cycles', () => {
    const cyclic = new DirectedDependencyGraph({
      nodes: ['a.ts', 'b.ts', 'self.ts', 'standalone.ts'],
      edges: [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'a.ts' },
        { from: 'self.ts', to: 'self.ts' },
      ],
    });
    expect(cyclic.stronglyConnectedComponents()).toEqual([
      ['a.ts', 'b.ts'],
      ['self.ts'],
      ['standalone.ts'],
    ]);
    expect(cyclic.cycles()).toEqual([['a.ts', 'b.ts'], ['self.ts']]);
  });

  it('handles deep graphs without recursive call-stack growth', () => {
    const nodes = Array.from(
      { length: 5_000 },
      (_, index) => `src/${String(index).padStart(4, '0')}.ts`,
    );
    const edges = nodes
      .slice(1)
      .map((node, index) => ({ from: nodes[index]!, to: node }));
    const deep = new DirectedDependencyGraph({ nodes, edges });
    expect(deep.stronglyConnectedComponents()).toHaveLength(5_000);
  });

  it('validates graph nodes, edges, packages, and traversal bounds', () => {
    expect(
      () => new DirectedDependencyGraph({ nodes: ['a.ts', 'a.ts'], edges: [] }),
    ).toThrow(/unique/);
    expect(
      () =>
        new DirectedDependencyGraph({
          nodes: ['a.ts'],
          edges: [{ from: 'a.ts', to: 'missing.ts' }],
        }),
    ).toThrow(/unknown node/);
    expect(() => graph.transitiveDependents('missing.ts', 2)).toThrow(
      /Unknown graph node/,
    );
    expect(() =>
      graph.transitiveDependents('packages/core/index.ts', 101),
    ).toThrow(/maxDepth/);
    expect(
      () =>
        new DirectedDependencyGraph({
          nodes: ['a.ts', 'b.ts'],
          edges: [],
          limits: { maxNodes: 1 },
        }),
    ).toThrow(/node limit/);
    expect(
      () =>
        new DirectedDependencyGraph({
          nodes: ['a.ts'],
          edges: [{ from: 'a.ts', to: 'a.ts' }],
          limits: { maxEdges: 2_000_000 },
        }),
    ).toThrow(/maxEdges/);
    expect(
      () =>
        new DirectedDependencyGraph({
          nodes: ['a.ts'],
          edges: [],
          packageRoots: [
            { id: 'one', root: '' },
            { id: 'two', root: '' },
          ],
        }),
    ).toThrow(/roots must be unique/);
  });
});

describe('resolved module integration', () => {
  it('builds edges only for resolved internal references', () => {
    const built = dependencyGraphFromModules([
      {
        path: 'a.ts',
        imports: [
          { resolution: 'internal', targetPath: 'b.ts' },
          { resolution: 'external' },
          { resolution: 'unresolved' },
        ],
      },
      { path: 'b.ts', imports: [] },
    ]);
    expect(built.edges()).toEqual([{ from: 'a.ts', to: 'b.ts' }]);
  });
});
