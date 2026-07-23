# Dependency Graph

`@change-risk/dependency-graph` represents each repository module as a node and
each internal import as a directed importer-to-dependency edge. Duplicate edges
are removed, all public results are deterministically ordered, and edges that
reference missing nodes are rejected.

The graph provides:

- fan-in (direct dependent count) and fan-out (direct dependency count);
- sorted direct dependents;
- breadth-first transitive dependents with distance and explicit truncation;
- strongly connected components and cycle-only components;
- package-boundary crossings.

Traversal depth is limited to 1 through 100. Construction defaults to at most
100,000 nodes and 1,000,000 input edges; callers may set lower limits. Strongly
connected components are iterative, so a deep but bounded graph does not consume
the JavaScript call stack.

Package roots are explicit `{ id, root }` inputs. The longest matching root owns
a module, allowing a nested package to override a workspace root. Crossings are
edges whose source and target owners differ, including transitions between a
known package and an unowned repository module. Package manifest discovery is
kept separate from graph mathematics.

Type-only references are currently retained as edges because they can affect
compilation and public type consumers. External and unresolved references do not
become graph edges; their status remains in the language index and must inform
analysis confidence.

## Blast-radius visualization model

`buildBlastRadiusVisualization` creates a bounded companion artifact from an
eligible head-tree graph and changed source paths. Multi-source breadth-first
traversal assigns distance zero to changed modules and the minimum reverse
dependency distance to each displayed dependent. Nodes retain fan-in and
fan-out; edges retain their importer-to-dependency direction.

The default display bounds are 120 nodes and 500 edges, with hard schema limits
of 250 nodes and 1,000 edges. The model records total source graph sizes, total
changed source paths, changed paths missing from the index, and a `truncated`
flag covering seed, traversal-depth, node, edge, and missing-path limits. Nodes
are ordered by distance then path, and edges preserve the graph's stable order.
The model never infers edges from findings or prose.
