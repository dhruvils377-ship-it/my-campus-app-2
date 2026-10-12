// Turns a route-type choice ("shortest" / "fastest" / "accessible") into an
// edge-weight function for dijkstra() (see geo.js). Pure logic, no React —
// fully unit-tested in routeTypes.test.js.
//
// HONEST LIMITATION, read before assuming this "just works": distinguishing
// these modes requires knowing which road-graph edges are stairs. That's not
// something OSM road-network exports carry through in this app's current
// buildRoadSnappedGraph() output — it only keeps node connectivity, not any
// per-edge tag. Until real stairs edges are identified for this specific
// campus and added to STAIRS_EDGES below, "fastest" and "accessible" will
// compute the exact same route as "shortest" — which is CORRECT behavior
// (there's nothing to route around), not a bug. See the comment above
// STAIRS_EDGES for how to add real data once it's identified.
//
// NOTE: unchanged for the manual-location and multiple-alternate-routes
// features — kShortestPaths() in geo.js accepts the exact same edgeWeightFn
// this file already produces, so nothing here needed to move.

export const ROUTE_TYPES = ['shortest', 'fastest', 'accessible'];

// Extra "distance" (in meters) added on top of an edge's real length when
// fastest mode crosses a stairs edge — representing that stairs are slower
// to cross than flat ground of the same length, without banning them
// outright the way accessible mode does. This is a reasonable planning
// estimate, not a measured constant — tune it if it doesn't feel right once
// you have real stairs data to test against.
export const FASTEST_STAIRS_PENALTY_METERS = 25;

// Pairs of node IDs (as they appear in your road graph) that represent a
// stairs edge. Empty by default — this app has no way to know which paths
// have stairs without you identifying them on your own campus. To populate
// this for real: walk your campus (or check satellite imagery / your own
// knowledge of it), find the road-graph node IDs on either side of each
// staircase (the same IDs your ROAD_NODES/ROAD_EDGES data already uses),
// and add them here as [nodeIdA, nodeIdB] pairs. Order doesn't matter — both
// directions are treated as the same edge.
export const STAIRS_EDGES = [
  // Example only — replace with real node-id pairs from your own data:
  // ['n1234', 'n1235'],
];

function edgeKey(a, b) {
  return [a, b].sort().join('|');
}

export function buildStairsEdgeSet(stairsEdges = STAIRS_EDGES) {
  return new Set(stairsEdges.map(([a, b]) => edgeKey(a, b)));
}

// Returns an edgeWeightFn for dijkstra(), or `undefined` for 'shortest'
// (dijkstra already defaults to plain distance when no function is given —
// no need to wrap it in an identity function that does the same thing).
export function getEdgeWeightFn(routeType, stairsEdgeSet) {
  if (routeType === 'accessible') {
    return (from, to, dist) => (stairsEdgeSet.has(edgeKey(from, to)) ? Infinity : dist);
  }
  if (routeType === 'fastest') {
    return (from, to, dist) =>
      stairsEdgeSet.has(edgeKey(from, to)) ? dist + FASTEST_STAIRS_PENALTY_METERS : dist;
  }
  return undefined; // 'shortest' — no modification, plain distance
}

export function routeTypeLabel(routeType) {
  return { shortest: 'Shortest', fastest: 'Fastest', accessible: 'Accessible' }[routeType] || routeType;
}