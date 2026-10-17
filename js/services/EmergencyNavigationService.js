/**
 * EmergencyNavigationService — Emergency mode with nearest exit finding.
 * Prioritizes speed and safety over normal routing preferences.
 */
class EmergencyNavigationService {
    constructor() {
        this._isEmergency = false;
        this._emergencyRoute = null;
        this._onEmergencyStart = null;
        this._onEmergencyEnd = null;
    }

    get isEmergency() {
        return this._isEmergency;
    }

    /**
     * Activate emergency mode.
     * Finds nearest exit and starts navigation to it.
     */
    activateEmergency(currentLocationId, graph, locationsMap, onStart, onEnd) {
        this._isEmergency = true;
        this._onEmergencyStart = onStart;
        this._onEmergencyEnd = onEnd;

        // Force accessible mode for emergency
        const originalMode = window.RoutePlanningService.getMode();
        window.RoutePlanningService.setMode('accessible');

        // Find nearest exit
        const route = window.RoutePlanningService.findNearestExit(graph, currentLocationId, locationsMap);

        // Restore original mode
        window.RoutePlanningService.setMode(originalMode);

        if (route) {
            this._emergencyRoute = route;
            if (onStart) {
                onStart(route);
            }
            return route;
        }

        return null;
    }

    /**
     * Deactivate emergency mode.
     */
    deactivateEmergency() {
        this._isEmergency = false;
        this._emergencyRoute = null;
        if (this._onEmergencyEnd) {
            this._onEmergencyEnd();
        }
        this._onEmergencyStart = null;
        this._onEmergencyEnd = null;
    }

    /**
     * Get emergency instructions — more urgent, shorter.
     */
    getEmergencyInstruction(from, to, distance) {
        const distText = distance < 10 ? 'a few steps' : `${Math.round(distance)} meters`;

        if (to.type === 'exit') {
            return {
                text: `EMERGENCY. Nearest exit is ${to.name}, ${distText} ahead. Follow the emergency route.`,
                icon: '🚨',
                type: 'emergency_exit'
            };
        }

        return {
            text: `EMERGENCY. Proceed to ${to.name} immediately. ${distText} ahead.`,
            icon: '🚨',
            type: 'emergency'
        };
    }

    /**
     * Get all exits sorted by distance from current position.
     */
    getExitsByDistance(currentLocationId, graph, locationsMap) {
        const exits = Object.values(locationsMap).filter(l => l.type === 'exit' || l.type === 'entrance');
        const results = [];

        for (const exit of exits) {
            const route = window.RoutePlanningService.findRoute(graph, currentLocationId, exit.id, locationsMap);
            if (route.found) {
                results.push({ exit, distance: route.distance, route });
            }
        }

        results.sort((a, b) => a.distance - b.distance);
        return results;
    }
}

// Global instance
window.EmergencyNavigationService = new EmergencyNavigationService();
