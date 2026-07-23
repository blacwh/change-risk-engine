import { describe, expect, it } from 'vitest';

import { DirectedDependencyGraph } from './graph.js';
import { buildBlastRadiusVisualization } from './visualization.js';

const graph = new DirectedDependencyGraph({
  nodes: ['app.ts', 'core.ts', 'feature.ts', 'unrelated.ts'],
  edges: [
    { from: 'app.ts', to: 'feature.ts' },
    { from: 'feature.ts', to: 'core.ts' },
  ],
});

describe('blast-radius visualization builder', () => {
  it('creates a deterministic focused graph with impact distances', () => {
    expect(
      buildBlastRadiusVisualization(graph, ['missing.ts', 'core.ts'], {
        maxDepth: 3,
      }),
    ).toEqual({
      schemaVersion: 1,
      nodes: [
        { path: 'core.ts', changed: true, distance: 0, fanIn: 1, fanOut: 0 },
        {
          path: 'feature.ts',
          changed: false,
          distance: 1,
          fanIn: 1,
          fanOut: 1,
        },
        { path: 'app.ts', changed: false, distance: 2, fanIn: 0, fanOut: 1 },
      ],
      edges: [
        { from: 'app.ts', to: 'feature.ts' },
        { from: 'feature.ts', to: 'core.ts' },
      ],
      sourceNodeCount: 4,
      sourceEdgeCount: 2,
      changedPathCount: 2,
      unindexedChangedPaths: ['missing.ts'],
      truncated: false,
    });
  });

  it('reports traversal and rendering truncation explicitly', () => {
    expect(
      buildBlastRadiusVisualization(graph, ['core.ts'], { maxDepth: 1 }),
    ).toMatchObject({ truncated: true });
    expect(
      buildBlastRadiusVisualization(graph, ['core.ts'], {
        maxDepth: 3,
        maxNodes: 2,
      }),
    ).toMatchObject({
      truncated: true,
      nodes: [{ path: 'core.ts' }, { path: 'feature.ts' }],
    });
  });
});
