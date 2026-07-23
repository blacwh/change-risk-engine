import { z } from 'zod';

export const BLAST_RADIUS_SCHEMA_VERSION = 1 as const;

const graphNodeSchema = z
  .object({
    path: z.string().min(1).max(1_000),
    changed: z.boolean(),
    distance: z.number().int().min(0).max(100),
    fanIn: z.number().int().nonnegative(),
    fanOut: z.number().int().nonnegative(),
  })
  .strict();

const graphEdgeSchema = z
  .object({
    from: z.string().min(1).max(1_000),
    to: z.string().min(1).max(1_000),
  })
  .strict();

export const blastRadiusVisualizationSchema = z
  .object({
    schemaVersion: z.literal(BLAST_RADIUS_SCHEMA_VERSION),
    nodes: z.array(graphNodeSchema).max(250),
    edges: z.array(graphEdgeSchema).max(1_000),
    sourceNodeCount: z.number().int().nonnegative(),
    sourceEdgeCount: z.number().int().nonnegative(),
    changedPathCount: z.number().int().nonnegative(),
    unindexedChangedPaths: z.array(z.string().min(1).max(1_000)).max(250),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((graph, context) => {
    const nodePaths = new Set(graph.nodes.map(({ path }) => path));
    if (nodePaths.size !== graph.nodes.length) {
      context.addIssue({
        code: 'custom',
        message: 'Graph node paths must be unique',
        path: ['nodes'],
      });
    }
    if (
      graph.sourceNodeCount < graph.nodes.length ||
      graph.sourceEdgeCount < graph.edges.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Source graph counts cannot be smaller than rendered counts',
      });
    }
    const edgeKeys = new Set<string>();
    for (const [index, edge] of graph.edges.entries()) {
      if (!nodePaths.has(edge.from) || !nodePaths.has(edge.to)) {
        context.addIssue({
          code: 'custom',
          message: 'Graph edges must reference rendered nodes',
          path: ['edges', index],
        });
      }
      const key = `${edge.from}\0${edge.to}`;
      if (edgeKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Graph edges must be unique',
          path: ['edges', index],
        });
      }
      edgeKeys.add(key);
    }
    for (const [index, node] of graph.nodes.entries()) {
      if (node.changed !== (node.distance === 0)) {
        context.addIssue({
          code: 'custom',
          message: 'Changed nodes must have distance zero',
          path: ['nodes', index],
        });
      }
    }
    const missing = new Set(graph.unindexedChangedPaths);
    if (
      missing.size !== graph.unindexedChangedPaths.length ||
      [...missing].some((path) => nodePaths.has(path))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Unindexed changed paths must be unique and absent from nodes',
        path: ['unindexedChangedPaths'],
      });
    }
    if (
      graph.changedPathCount <
      graph.nodes.filter(({ changed }) => changed).length + missing.size
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Changed path count cannot be smaller than represented changes',
        path: ['changedPathCount'],
      });
    }
  });

export type BlastRadiusVisualization = z.infer<
  typeof blastRadiusVisualizationSchema
>;

export const blastRadiusVisualizationJsonSchema = z.toJSONSchema(
  blastRadiusVisualizationSchema,
);

export function parseBlastRadiusVisualization(
  input: unknown,
): BlastRadiusVisualization {
  return blastRadiusVisualizationSchema.parse(input);
}
