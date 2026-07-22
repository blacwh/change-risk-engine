import { posix } from 'node:path';

export type DependencyEdge = { from: string; to: string };
export type PackageRoot = { id: string; root: string };
export type GraphLimits = { maxEdges?: number; maxNodes?: number };
export type DependencyGraphDefinition = {
  nodes: readonly string[];
  edges: readonly DependencyEdge[];
  packageRoots?: readonly PackageRoot[];
  limits?: GraphLimits;
};
export type GraphNodeMetrics = {
  path: string;
  fanIn: number;
  fanOut: number;
};
export type TransitiveDependents = {
  dependents: readonly { path: string; distance: number }[];
  truncated: boolean;
};
export type BoundaryCrossing = DependencyEdge & {
  fromPackage: string | null;
  toPackage: string | null;
};

type ResolvedModuleLike = {
  path: string;
  imports: readonly { resolution: string; targetPath?: string }[];
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validPath(path: string, allowRoot = false): boolean {
  if (allowRoot && path === '') return true;
  return (
    path.length > 0 &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    !posix.isAbsolute(path) &&
    path !== '..' &&
    !path.startsWith('../') &&
    posix.normalize(path) === path
  );
}

function validateDepth(maxDepth: number): void {
  if (!Number.isSafeInteger(maxDepth) || maxDepth <= 0 || maxDepth > 100) {
    throw new Error('maxDepth must be an integer from 1 to 100');
  }
}

function graphLimit(
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return limit;
}

function edgeKey(edge: DependencyEdge): string {
  return `${edge.from}\0${edge.to}`;
}

export class DirectedDependencyGraph {
  readonly #nodes: readonly string[];
  readonly #edges: readonly DependencyEdge[];
  readonly #dependencies = new Map<string, readonly string[]>();
  readonly #dependents = new Map<string, readonly string[]>();
  readonly #packageRoots: readonly PackageRoot[];

  public constructor(definition: DependencyGraphDefinition) {
    const maxNodes = graphLimit(
      definition.limits?.maxNodes,
      100_000,
      100_000,
      'maxNodes',
    );
    const maxEdges = graphLimit(
      definition.limits?.maxEdges,
      1_000_000,
      1_000_000,
      'maxEdges',
    );
    if (definition.nodes.length > maxNodes)
      throw new Error('Graph node limit exceeded');
    if (definition.edges.length > maxEdges)
      throw new Error('Graph edge limit exceeded');
    const nodes = [...definition.nodes];
    if (nodes.some((path) => !validPath(path)))
      throw new Error('Graph nodes must be normalized repository paths');
    if (new Set(nodes).size !== nodes.length)
      throw new Error('Graph nodes must be unique');
    nodes.sort(compareText);
    const nodeSet = new Set(nodes);

    const edgeKeys = new Set<string>();
    const edges: DependencyEdge[] = [];
    for (const edge of definition.edges) {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
        throw new Error(
          `Graph edge references an unknown node: ${edge.from} -> ${edge.to}`,
        );
      }
      const key = edgeKey(edge);
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({ from: edge.from, to: edge.to });
      }
    }
    edges.sort((left, right) => compareText(edgeKey(left), edgeKey(right)));

    const dependencies = new Map(nodes.map((node) => [node, [] as string[]]));
    const dependents = new Map(nodes.map((node) => [node, [] as string[]]));
    for (const edge of edges) {
      dependencies.get(edge.from)?.push(edge.to);
      dependents.get(edge.to)?.push(edge.from);
    }
    for (const values of [...dependencies.values(), ...dependents.values()])
      values.sort(compareText);

    const packageRoots = [...(definition.packageRoots ?? [])].map(
      ({ id, root }) => ({
        id,
        root: root.replace(/\/$/u, ''),
      }),
    );
    if (
      packageRoots.some(
        ({ id, root }) => id.length === 0 || !validPath(root, true),
      )
    ) {
      throw new Error(
        'Package roots require non-empty ids and normalized repository paths',
      );
    }
    if (
      new Set(packageRoots.map(({ id }) => id)).size !== packageRoots.length
    ) {
      throw new Error('Package root ids must be unique');
    }
    if (
      new Set(packageRoots.map(({ root }) => root)).size !== packageRoots.length
    ) {
      throw new Error('Package roots must be unique');
    }
    packageRoots.sort(
      (left, right) =>
        right.root.length - left.root.length ||
        compareText(left.root, right.root),
    );

    this.#nodes = nodes;
    this.#edges = edges;
    this.#dependencies = dependencies;
    this.#dependents = dependents;
    this.#packageRoots = packageRoots;
  }

  public nodes(): readonly string[] {
    return [...this.#nodes];
  }

  public edges(): readonly DependencyEdge[] {
    return this.#edges.map((edge) => ({ ...edge }));
  }

  public metrics(): readonly GraphNodeMetrics[] {
    return this.#nodes.map((path) => ({
      path,
      fanIn: this.#dependents.get(path)?.length ?? 0,
      fanOut: this.#dependencies.get(path)?.length ?? 0,
    }));
  }

  public directDependents(path: string): readonly string[] {
    this.#assertNode(path);
    return [...(this.#dependents.get(path) ?? [])];
  }

  public transitiveDependents(
    path: string,
    maxDepth: number,
  ): TransitiveDependents {
    this.#assertNode(path);
    validateDepth(maxDepth);
    const visited = new Set([path]);
    let frontier = [path];
    const result: { path: string; distance: number }[] = [];

    for (
      let distance = 1;
      distance <= maxDepth && frontier.length > 0;
      distance += 1
    ) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const dependent of this.#dependents.get(current) ?? []) {
          if (!visited.has(dependent)) {
            visited.add(dependent);
            next.push(dependent);
            result.push({ path: dependent, distance });
          }
        }
      }
      next.sort(compareText);
      frontier = next;
    }

    const truncated = frontier.some((node) =>
      (this.#dependents.get(node) ?? []).some(
        (dependent) => !visited.has(dependent),
      ),
    );
    result.sort(
      (left, right) =>
        left.distance - right.distance || compareText(left.path, right.path),
    );
    return { dependents: result, truncated };
  }

  public stronglyConnectedComponents(): readonly (readonly string[])[] {
    const visited = new Set<string>();
    const finishOrder: string[] = [];
    for (const start of this.#nodes) {
      if (visited.has(start)) continue;
      const stack: { node: string; expanded: boolean }[] = [
        { node: start, expanded: false },
      ];
      while (stack.length > 0) {
        const frame = stack.pop();
        if (frame === undefined) break;
        if (frame.expanded) {
          finishOrder.push(frame.node);
          continue;
        }
        if (visited.has(frame.node)) continue;
        visited.add(frame.node);
        stack.push({ node: frame.node, expanded: true });
        const neighbors = [
          ...(this.#dependencies.get(frame.node) ?? []),
        ].reverse();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor))
            stack.push({ node: neighbor, expanded: false });
        }
      }
    }

    const assigned = new Set<string>();
    const components: string[][] = [];
    for (const start of finishOrder.reverse()) {
      if (assigned.has(start)) continue;
      const component: string[] = [];
      const stack = [start];
      assigned.add(start);
      while (stack.length > 0) {
        const node = stack.pop();
        if (node === undefined) break;
        component.push(node);
        for (const neighbor of this.#dependents.get(node) ?? []) {
          if (!assigned.has(neighbor)) {
            assigned.add(neighbor);
            stack.push(neighbor);
          }
        }
      }
      component.sort(compareText);
      components.push(component);
    }
    components.sort((left, right) =>
      compareText(left[0] ?? '', right[0] ?? ''),
    );
    return components;
  }

  public cycles(): readonly (readonly string[])[] {
    const selfEdges = new Set(
      this.#edges.filter(({ from, to }) => from === to).map(({ from }) => from),
    );
    return this.stronglyConnectedComponents().filter(
      (component) =>
        component.length > 1 ||
        (component[0] !== undefined && selfEdges.has(component[0])),
    );
  }

  public boundaryCrossings(): readonly BoundaryCrossing[] {
    return this.#edges.flatMap((edge) => {
      const fromPackage = this.#packageFor(edge.from);
      const toPackage = this.#packageFor(edge.to);
      return fromPackage === toPackage
        ? []
        : [{ ...edge, fromPackage, toPackage }];
    });
  }

  #assertNode(path: string): void {
    if (!this.#dependencies.has(path))
      throw new Error(`Unknown graph node: ${path}`);
  }

  #packageFor(path: string): string | null {
    return (
      this.#packageRoots.find(
        ({ root }) =>
          root === '' || path === root || path.startsWith(`${root}/`),
      )?.id ?? null
    );
  }
}

export function dependencyGraphFromModules(
  modules: readonly ResolvedModuleLike[],
  packageRoots: readonly PackageRoot[] = [],
  limits: GraphLimits = {},
): DirectedDependencyGraph {
  const nodes = modules.map(({ path }) => path);
  const edges = modules.flatMap((module) =>
    module.imports.flatMap((reference) =>
      reference.resolution === 'internal' && reference.targetPath !== undefined
        ? [{ from: module.path, to: reference.targetPath }]
        : [],
    ),
  );
  return new DirectedDependencyGraph({ nodes, edges, packageRoots, limits });
}
