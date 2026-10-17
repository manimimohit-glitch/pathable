/**
 * RoutePlanningService — A* pathfinding with route modes.
 * Modes: shortest, safest, accessible
 */
class RoutePlanningService {
    constructor() {
        this.mode = 'shortest'; // default
    }

    setMode(mode) {
        if (['shortest', 'safest', 'accessible'].includes(mode)) {
            this.mode = mode;
        }
    }

    getMode() {
        return this.mode;
    }

    /**
     * Find route using A* algorithm.
     * @param {Object} graph — Adjacency list from BuildingMapService.getGraph()
     * @param {string} startId — Starting location ID
     * @param {string} endId — Destination location ID
     * @param {Object} locationsMap — Map of locationId -> location (for heuristic)
     * @returns {Object} { path: [locationIds], distance: number, found: boolean }
     */
    findRoute(graph, startId, endId, locationsMap) {
        if (!graph || !startId || !endId) {
            return { path: [], distance: 0, found: false };
        }

        if (startId === endId) {
            return { path: [startId], distance: 0, found: true };
        }

        // A* structures
        const openSet = new Set([startId]);
        const cameFrom = {};
        const gScore = {};
        const fScore = {};

        for (const nodeId in graph) {
            gScore[nodeId] = Infinity;
            fScore[nodeId] = Infinity;
        }
        gScore[startId] = 0;

        // Heuristic: Euclidean distance if coordinates available
        const heuristic = (a, b) => {
            if (locationsMap && locationsMap[a] && locationsMap[b]) {
                const dx = locationsMap[a].x - locationsMap[b].x;
                const dy = locationsMap[a].y - locationsMap[b].y;
                return Math.sqrt(dx * dx + dy * dy);
            }
            return 0; // No heuristic info
        };

        fScore[startId] = heuristic(startId, endId);

        while (openSet.size > 0) {
            // Get node with lowest fScore
            let current = null;
            let lowestF = Infinity;
            for (const nodeId of openSet) {
                if (fScore[nodeId] < lowestF) {
                    lowestF = fScore[nodeId];
                    current = nodeId;
                }
            }

            if (current === endId) {
                // Reconstruct path
                const path = [current];
                let totalDist = 0;
                while (cameFrom[current] !== undefined) {
                    const prev = cameFrom[current];
                    // Find edge distance
                    const edges = graph[prev];
                    const edge = edges.find(e => e.node === current);
                    if (edge) totalDist += edge.distance;
                    current = prev;
                    path.unshift(current);
                }
                return { path, distance: totalDist, found: true };
            }

            openSet.delete(current);

            const neighbors = graph[current] || [];
            for (const neighbor of neighbors) {
                // Skip non-accessible edges in accessible mode
                if (this.mode === 'accessible' && !neighbor.accessible) {
                    continue;
                }

                // Calculate edge cost based on mode
                let edgeCost = neighbor.distance;

                if (this.mode === 'safest') {
                    // Prefer accessible routes
                    edgeCost = neighbor.accessible ? neighbor.distance : neighbor.distance * 2;
                }

                const tentativeG = gScore[current] + edgeCost;

                if (tentativeG < gScore[neighbor.node]) {
                    cameFrom[neighbor.node] = current;
                    gScore[neighbor.node] = tentativeG;
                    fScore[neighbor.node] = tentativeG + heuristic(neighbor.node, endId);
                    openSet.add(neighbor.node);
                }
            }
        }

        // No path found
        return { path: [], distance: 0, found: false };
    }

    /**
     * Find nearest exit from a given location.
     */
    findNearestExit(graph, startId, locationsMap) {
        const exits = Object.values(locationsMap).filter(l => l.type === 'exit' || l.type === 'entrance');
        let bestRoute = null;
        let bestDist = Infinity;

        for (const exit of exits) {
            const route = this.findRoute(graph, startId, exit.id, locationsMap);
            if (route.found && route.distance < bestDist) {
                bestDist = route.distance;
                bestRoute = route;
            }
        }

        return bestRoute ? { ...bestRoute, exit: exits.find(e => e.id === bestRoute.path[bestRoute.path.length - 1]) } : null;
    }

    /**
     * Get route summary with step count.
     */
    getRouteSummary(route) {
        if (!route || !route.found) return null;
        return {
            steps: route.path.length - 1,
            distance: Math.round(route.distance),
            start: route.path[0],
            end: route.path[route.path.length - 1]
        };
    }
}

// Global instance
window.RoutePlanningService = new RoutePlanningService();
