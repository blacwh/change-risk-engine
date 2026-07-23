import {
  BLAST_RADIUS_SCHEMA_VERSION,
  parseBlastRadiusVisualization,
  type BlastRadiusVisualization,
} from '@change-risk/core';

import type { DirectedDependencyGraph } from './graph.js';

export type BlastRadiusOptions = {
  maxDepth: number;
  maxNodes?: number;
  maxEdges?: number;
};

function boundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const candidate = value ?? fallback;
  if (
    !Number.isSafeInteger(candidate) ||
    candidate < 1 ||
    candidate > maximum
  ) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return candidate;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildBlastRadiusVisualization(
  graph: DirectedDependencyGraph,
  changedPaths: readonly string[],
  options: BlastRadiusOptions,
): BlastRadiusVisualization {
  const maxDepth = boundedInteger(options.maxDepth, 20, 100, 'maxDepth');
  const maxNodes = boundedInteger(options.maxNodes, 120, 250, 'maxNodes');
  const maxEdges = boundedInteger(options.maxEdges, 500, 1_000, 'maxEdges');
  const graphNodes = graph.nodes();
  const graphNodeSet = new Set(graphNodes);
  const uniqueChangedPaths = [...new Set(changedPaths)].sort(compareText);
  const indexedChangedPaths = uniqueChangedPaths.filter((path) =>
    graphNodeSet.has(path),
  );
  const unindexedChangedPaths = uniqueChangedPaths
    .filter((path) => !graphNodeSet.has(path))
    .slice(0, 250);
  const distances = new Map<string, number>();
  let truncated =
    indexedChangedPaths.length > maxNodes ||
    uniqueChangedPaths.length - indexedChangedPaths.length > 250;
  let frontier = indexedChangedPaths.slice(0, maxNodes);
  for (const path of frontier) distances.set(path, 0);

  for (
    let distance = 1;
    distance <= maxDepth && frontier.length > 0;
    distance += 1
  ) {
    const candidates = new Set<string>();
    for (const path of frontier) {
      for (const dependent of graph.directDependents(path)) {
        if (!distances.has(dependent)) candidates.add(dependent);
      }
    }
    const ordered = [...candidates].sort(compareText);
    const available = maxNodes - distances.size;
    if (ordered.length > available) truncated = true;
    frontier = ordered.slice(0, Math.max(0, available));
    for (const path of frontier) distances.set(path, distance);
    if (available <= 0) break;
    if (distance === maxDepth) {
      truncated ||= frontier.some((path) =>
        graph
          .directDependents(path)
          .some((dependent) => !distances.has(dependent)),
      );
    }
  }

  const metrics = new Map(
    graph.metrics().map((metric) => [metric.path, metric]),
  );
  const nodes = [...distances]
    .map(([path, distance]) => ({
      path,
      changed: distance === 0,
      distance,
      fanIn: metrics.get(path)?.fanIn ?? 0,
      fanOut: metrics.get(path)?.fanOut ?? 0,
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance || compareText(left.path, right.path),
    );
  const included = new Set(nodes.map(({ path }) => path));
  const candidateEdges = graph
    .edges()
    .filter(({ from, to }) => included.has(from) && included.has(to));
  if (candidateEdges.length > maxEdges) truncated = true;

  return parseBlastRadiusVisualization({
    schemaVersion: BLAST_RADIUS_SCHEMA_VERSION,
    nodes,
    edges: candidateEdges.slice(0, maxEdges),
    sourceNodeCount: graphNodes.length,
    sourceEdgeCount: graph.edges().length,
    changedPathCount: uniqueChangedPaths.length,
    unindexedChangedPaths,
    truncated,
  });
}
