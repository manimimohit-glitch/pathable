/**
 * IndoorPositioningService — Indoor positioning with pluggable providers.
 * Default: SimulatedPositionProvider for prototype/demo.
 * Can be extended with BLE beacon, WiFi fingerprinting, etc.
 */
class IndoorPositioningService {
    constructor() {
        this.provider = {};
        this.activeProvider = null;
        this.currentPosition = null;
        this._positionListeners = [];
        this._positionInterval = null;

        // Register built-in providers
        this.registerProvider('simulated', new SimulatedPositionProvider());

        // Default to simulated
        this.setProvider('simulated');
    }

    registerProvider(name, provider) {
        this.providers[name] = provider;
    }

    setProvider(name) {
        if (this.providers[name]) {
            this.activeProvider = this.providers[name];
            this.activeProvider.start((position) => {
                this.currentPosition = position;
                this._notifyListeners(position);
            });
            return true;
        }
        console.warn('IndoorPositioningService: Provider not found:', name);
        return false;
    }

    getCurrentPosition() {
        return this.currentPosition;
    }

    startTracking() {
        if (this.activeProvider) {
            this.activeProvider.start((position) => {
                this.currentPosition = position;
                this._notifyListeners(position);
            });
        }
    }

    stopTracking() {
        if (this._positionInterval) {
            clearInterval(this._positionInterval);
            this._positionInterval = null;
        }
        if (this.activeProvider) {
            this.activeProvider.stop();
        }
    }

    onPositionUpdate(callback) {
        this._positionListeners.push(callback);
        // Return unsubscribe function
        return () => {
            this._positionListeners = this._positionListeners.filter(cb => cb !== callback);
        };
    }

    _notifyListeners(position) {
        for (const cb of this._positionListeners) {
            try {
                cb(position);
            } catch (e) {
                console.warn('IndoorPositioningService: Listener error', e);
            }
        }
    }

    // Helper: Get nearest location to current position
    getNearestLocation(locations) {
        if (!this.currentPosition || !locations || locations.length === 0) {
            return locations && locations.length > 0 ? locations[0] : null;
        }

        let nearest = null;
        let minDist = Infinity;

        for (const loc of locations) {
            const dx = loc.x - this.currentPosition.x;
            const dy = loc.y - this.currentPosition.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = loc;
            }
        }

        return nearest;
    }
}

/**
 * SimulatedPositionProvider — Simulates indoor movement for prototype.
 * Moves the user along a path between waypoints.
 */
class SimulatedPositionProvider {
    constructor() {
        this._callbacks = [];
        this._interval = null;
        this._waypoints = [];
        this._currentIndex = 0;
        this._speed = 2; // units per tick
    }

    start(onUpdate) {
        this._callbacks.push(onUpdate);

        // Set default waypoints for Tech Tower
        this._waypoints = [
            { x: 50, y: 90, locationId: 'loc-1', name: 'Main Entrance' },
            { x: 50, y: 70, locationId: 'loc-2', name: 'Lobby' },
            { x: 30, y: 60, locationId: 'loc-3', name: 'Elevator A' },
            { x: 20, y: 40, locationId: 'loc-5', name: 'Restroom 1F' },
            { x: 30, y: 60, locationId: 'loc-3', name: 'Elevator A' },
            { x: 50, y: 70, locationId: 'loc-2', name: 'Lobby' },
            { x: 60, y: 40, locationId: 'loc-13', name: 'Elevator B' },
            { x: 50, y: 50, locationId: 'loc-6', name: 'Cafeteria' },
            { x: 25, y: 30, locationId: 'loc-7', name: 'Room 201' },
            { x: 50, y: 50, locationId: 'loc-6', name: 'Cafeteria' },
            { x: 75, y: 30, locationId: 'loc-8', name: 'Room 205' }
        ];
        this._currentIndex = 0;

        // Emit initial position
        const initial = this._waypoints[0];
        onUpdate({ ...initial, provider: 'simulated' });

        // Simulate movement
        let currentPos = { ...initial };
        let targetIndex = 1;

        this._interval = setInterval(() => {
            if (targetIndex >= this._waypoints.length) {
                // Loop back
                targetIndex = 1;
                currentPos = { ...this._waypoints[0] };
            }

            const target = this._waypoints[targetIndex];
            const dx = target.x - currentPos.x;
            const dy = target.y - currentPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this._speed) {
                currentPos = { ...target };
                targetIndex++;
            } else {
                currentPos.x += (dx / dist) * this._speed;
                currentPos.y += (dy / dist) * this._speed;
            }

            const position = {
                ...currentPos,
                provider: 'simulated',
                timestamp: Date.now()
            };

            for (const cb of this._callbacks) {
                cb(position);
            }
        }, 100);

        this._onUpdate = onUpdate;
    }

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        this._callbacks = [];
    }

    // Allow setting custom waypoints (e.g., during navigation)
    setWaypoints(waypoints) {
        this._waypoints = waypoints;
        this._currentIndex = 0;
    }
}

// Global instance
window.IndoorPositioningService = new IndoorPositioningService();
