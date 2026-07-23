import { describe, expect, it } from 'vitest';

import { parseBlastRadiusVisualization } from './visualization.js';

const graph = {
  schemaVersion: 1,
  nodes: [
    { path: 'core.ts', changed: true, distance: 0, fanIn: 1, fanOut: 0 },
    { path: 'app.ts', changed: false, distance: 1, fanIn: 0, fanOut: 1 },
  ],
  edges: [{ from: 'app.ts', to: 'core.ts' }],
  sourceNodeCount: 2,
  sourceEdgeCount: 1,
  changedPathCount: 1,
  unindexedChangedPaths: [],
  truncated: false,
};

describe('blast-radius visualization schema', () => {
  it('accepts a bounded graph with explicit change distances', () => {
    expect(parseBlastRadiusVisualization(graph)).toEqual(graph);
  });

  it('rejects hidden endpoints and inconsistent changed nodes', () => {
    expect(() =>
      parseBlastRadiusVisualization({
        ...graph,
        edges: [{ from: 'missing.ts', to: 'core.ts' }],
      }),
    ).toThrow();
    expect(() =>
      parseBlastRadiusVisualization({
        ...graph,
        nodes: [{ ...graph.nodes[0], changed: false }],
        edges: [],
      }),
    ).toThrow();
  });
});
