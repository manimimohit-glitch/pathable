/**
 * NavigationInstructionService — Generates turn-by-turn voice instructions.
 */
class NavigationInstructionService {
    constructor() {
        this._lastInstruction = null;
    }

    /**
     * Generate instruction for moving from one location to the next.
     * @param {Object} from — Current location
     * @param {Object} to — Next location
     * @param {Object} nextNext — The location after next (for turn context)
     * @param {number} distance — Distance in meters
     * @returns {Object} { text, icon, type }
     */
    generateInstruction(from, to, nextNext, distance) {
        if (!from || !to) return null;

        const distText = this._formatDistance(distance);

        // First step: departure
        if (from.type === 'entrance' && distance < 5) {
            return {
                text: `Starting at ${from.name}. Walk straight.`,
                icon: '⬆️',
                type: 'depart'
            };
        }

        // Last step: arrival
        if (!nextNext || to.type === 'exit' || to.type === 'entrance') {
            return {
                text: `You have arrived at ${to.name}.`,
                icon: '📍',
                type: 'arrive'
            };
        }

        // Determine turn direction
        const turn = this._getTurnDirection(from, to, nextNext);

        if (turn.direction === 'straight') {
            return {
                text: `Continue straight for ${distText}.`,
                icon: '⬆️',
                type: 'straight'
            };
        } else if (turn.direction === 'left') {
            return {
                text: `Turn left in ${distText}.`,
                icon: '⬅️',
                type: 'turn_left'
            };
        } else if (turn.direction === 'right') {
            return {
                text: `Turn right in ${distText}.`,
                icon: '➡️',
                type: 'turn_right'
            };
        } else if (turn.direction === 'slight_left') {
            return {
                text: `Bear left in ${distText}.`,
                icon: '↖️',
                type: 'slight_left'
            };
        } else if (turn.direction === 'slight_right') {
            return {
                text: `Bear right in ${distText}.`,
                icon: '↗️',
                type: 'slight_right'
            };
        } else if (turn.direction === 'uturn') {
            return {
                text: `Make a U-turn in ${distText}.`,
                icon: '🔄',
                type: 'uturn'
            };
        }

        // Elevator / stairs
        if (to.type === 'elevator') {
            return {
                text: `Take the elevator to ${to.name}.`,
                icon: '🛗',
                type: 'elevator'
            };
        }

        if (to.type === 'stairs') {
            return {
                text: `Take the stairs to ${to.name}.`,
                icon: '🪜',
                type: 'stairs'
            };
        }

        // Fallback
        return {
            text: `Continue to ${to.name}, ${distText} ahead.`,
            icon: '⬆️',
            type: 'straight'
        };
    }

    /**
     * Get remaining distance and next turn info for active navigation.
     */
    getProgressInstruction(path, currentIndex, locations, totalDistance) {
        if (!path || currentIndex >= path.length - 1) {
            return {
                text: 'You have arrived at your destination.',
                icon: '📍',
                distanceRemaining: 0,
                nextTurn: 'Arrived'
            };
        }

        const current = locations[path[currentIndex]];
        const next = locations[path[currentIndex + 1]];
        const nextNext = currentIndex + 2 < path.length ? locations[path[currentIndex + 2]] : null;

        // Calculate remaining distance
        let remaining = 0;
        for (let i = currentIndex; i < path.length - 1; i++) {
            // We need the connection distance — approximate with coordinate distance
            const a = locations[path[i]];
            const b = locations[path[i + 1]];
            if (a && b) {
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                remaining += Math.sqrt(dx * dx + dy * dy) * 0.5; // Scale factor to meters
            }
        }

        const instruction = this.generateInstruction(current, next, nextNext, remaining);

        return {
            ...instruction,
            distanceRemaining: Math.round(remaining),
            nextTurn: instruction.type.replace('_', ' ')
        };
    }

    _getTurnDirection(from, to, nextNext) {
        if (!nextNext) {
            return { direction: 'straight', angle: 0 };
        }

        // Calculate vectors
        const v1x = to.x - from.x;
        const v1y = to.y - from.y;
        const v2x = nextNext.x - to.x;
        const v2y = nextNext.y - to.y;

        // Calculate angle between vectors
        const dot = v1x * v2x + v1y * v2y;
        const cross = v1x * v2y - v1y * v2x;
        const angle = Math.atan2(cross, dot) * (180 / Math.PI);

        if (Math.abs(angle) < 30) return { direction: 'straight', angle };
        if (angle >= 30 && angle < 80) return { direction: 'slight_right', angle };
        if (angle >= 80 && angle < 135) return { direction: 'right', angle };
        if (angle >= 135) return { direction: 'uturn', angle };
        if (angle <= -30 && angle > -80) return { direction: 'slight_left', angle };
        if (angle <= -80 && angle > -135) return { direction: 'left', angle };
        return { direction: 'uturn', angle };
    }

    _formatDistance(meters) {
        if (meters < 1) return 'a few steps';
        if (meters < 5) return 'a few meters';
        if (meters < 20) return `${Math.round(meters)} meters`;
        if (meters < 100) return `${Math.round(meters / 5) * 5} meters`;
        return `${Math.round(meters / 10) * 10} meters`;
    }

    setLastInstruction(instruction) {
        this._lastInstruction = instruction;
    }

    getLastInstruction() {
        return this._lastInstruction;
    }

    repeatLast() {
        if (this._lastInstruction) {
            return this._lastInstruction;
        }
        return null;
    }
}

// Global instance
window.NavigationInstructionService = new NavigationInstructionService();
