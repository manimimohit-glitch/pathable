/**
 * ReroutingService — Detects when user goes off-route and triggers rerouting.
 * Uses confirmation frames to avoid false positives.
 */
class ReroutingService {
    constructor() {
        this._isNavigating = false;
        this._plannedPath = [];
        this._currentWaypointIndex = 0;
        this._offRouteFrames = 0;
        this._confirmationThreshold = 3; // consecutive off-route frames before triggering
        this._onRerouteCallback = null;
        this._onOffRouteCallback = null;
    }

    /**
     * Start monitoring for off-route detection.
     */
    startMonitoring(path, onReroute, onOffRoute) {
        this._isNavigating = true;
        this._plannedPath = path;
        this._currentWaypointIndex = 0;
        this._offRouteFrames = 0;
        this._onRerouteCallback = onReroute;
        this._onOffRouteCallback = offRoute;
    }

    stopMonitoring() {
        this._isNavigating = false;
        this._plannedPath = [];
        this._currentWaypointIndex = 0;
        this._offRouteFrames = 0;
        this._onRerouteCallback = null;
        this._onOffRouteCallback = null;
    }

    /**
     * Update current position and check if user is on route.
     * Called periodically by the positioning service.
     */
    updatePosition(currentPos, locations) {
        if (!this._isNavigating || !this._plannedPath.length) return null;

        // Find closest point on route
        const closestInfo = this._findClosestPointOnRoute(currentPos, locations);

        if (!closestInfo) return null;

        // Check if user is within acceptable distance of route
        const offRouteThreshold = 15; // units
        const isOffRoute = closestInfo.distance > offRouteThreshold;

        if (isOffRoute) {
            this._offRouteFrames++;
            if (this._onOffRouteCallback) {
                this._onOffRouteCallback(this._offRouteFrames, this._confirmationThreshold);
            }

            if (this._offRouteFrames >= this._confirmationThreshold) {
                // Trigger reroute
                if (this._onRerouteCallback) {
                    const currentLocId = closestInfo.closestWaypointId;
                    this._onRerouteCallback(currentLocId, this._plannedPath[this._plannedPath.length - 1]);
                }
                this._offRouteFrames = 0; // Reset after triggering
            }
        } else {
            // User is back on route — reset counter and advance waypoint
            if (this._offRouteFrames > 0) {
                this._offRouteFrames = 0;
            }

            // Advance waypoint index if user has passed current waypoint
            if (closestInfo.closestWaypointIndex > this._currentWaypointIndex) {
                this._currentWaypointIndex = closestInfo.closestWaypointIndex;
            }
        }

        return {
            isOffRoute,
            offRouteFrames: this._offRouteFrames,
            closestWaypointIndex: this._currentWaypointIndex,
            closestDistance: closestInfo.distance
        };
    }

    _findClosestPointOnRoute(pos, locations) {
        if (!this._plannedPath.length) return null;

        let minDist = Infinity;
        let closestWaypointId = null;
        let closestWaypointIndex = 0;

        for (let i = 0; i < this._plannedPath.length; i++) {
            const locId = this._plannedPath[i];
            const loc = locations[locId];
            if (!loc) continue;

            const dx = loc.x - pos.x;
            const dy = loc.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                closestWaypointId = locId;
                closestWaypointIndex = i;
            }
        }

        return {
            distance: minDist,
            closestWaypointId,
            closestWaypointIndex
        };
    }

    /**
     * Check if user has reached the destination.
     */
    hasArrived(currentPos, destinationLoc) {
        if (!currentPos || !destinationLoc) return false;
        const dx = currentPos.x - destinationLoc.x;
        const dy = currentPos.y - destinationLoc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < 5; // Within 5 units
    }
}

// Global instance
window.ReroutingService = new ReroutingService();
