/**
 * BuildingMapService — Manages building maps, locations, connections.
 * Singleton pattern. Persists to localStorage.
 */
class BuildingMapService {
    constructor() {
        this.buildings = [];
        this.currentBuilding = null;
        this._loadFromStorage();
    }

    _loadFromStorage() {
        try {
            const data = localStorage.getItem('pathable_buildings');
            if (data) {
                this.buildings = JSON.parse(data);
            } else {
                this._seedDefaults();
            }
        } catch (e) {
            console.warn('BuildingMapService: Failed to load from storage', e);
            this._seedDefaults();
        }
    }

    _saveToStorage() {
        try {
            localStorage.setItem('pathable_buildings', JSON.stringify(this.buildings));
        } catch (e) {
            console.warn('BuildingMapService: Failed to save to storage', e);
        }
    }

    _seedDefaults() {
        this.buildings = [
            {
                id: 'building-1',
                name: 'Tech Tower',
                icon: '🏢',
                floors: 5,
                locations: [
                    { id: 'loc-1', name: 'Main Entrance', type: 'entrance', floor: 1, x: 50, y: 90 },
                    { id: 'loc-2', name: 'Lobby', type: 'common', floor: 1, x: 50, y: 70 },
                    { id: 'loc-3', name: 'Elevator A', type: 'elevator', floor: 1, x: 30, y: 60 },
                    { id: 'loc-4', name: 'Stairs A', type: 'stairs', floor: 1, x: 70, y: 60 },
                    { id: 'loc-5', name: 'Restroom 1F', type: 'restroom', floor: 1, x: 20, y: 40 },
                    { id: 'loc-6', name: 'Cafeteria', type: 'dining', floor: 2, x: 50, y: 50 },
                    { id: 'loc-7', name: 'Room 201', type: 'room', floor: 2, x: 25, y: 30 },
                    { id: 'loc-8', name: 'Room 205', type: 'room', floor: 2, x: 75, y: 30 },
                    { id: 'loc-9', name: 'Conference Room', type: 'meeting', floor: 3, x: 50, y: 30 },
                    { id: 'loc-10', name: 'Emergency Exit', type: 'exit', floor: 1, x: 90, y: 90 },
                    { id: 'loc-11', name: 'Library', type: 'common', floor: 3, x: 20, y: 50 },
                    { id: 'loc-12', name: 'Lab 301', type: 'room', floor: 3, x: 80, y: 50 },
                    { id: 'loc-13', name: 'Elevator B', type: 'elevator', floor: 1, x: 60, y: 40 },
                    { id: 'loc-14', name: 'Stairs B', type: 'stairs', floor: 1, x: 40, y: 40 }
                ],
                connections: [
                    { from: 'loc-1', to: 'loc-2', distance: 15, accessible: true },
                    { from: 'loc-2', to: 'loc-3', distance: 20, accessible: true },
                    { from: 'loc-2', to: 'loc-4', distance: 20, accessible: false },
                    { from: 'loc-2', to: 'loc-13', distance: 18, accessible: true },
                    { from: 'loc-3', to: 'loc-5', distance: 25, accessible: true },
                    { from: 'loc-3', to: 'loc-14', distance: 15, accessible: true },
                    { from: 'loc-4', to: 'loc-14', distance: 12, accessible: false },
                    { from: 'loc-13', to: 'loc-6', distance: 30, accessible: true },
                    { from: 'loc-14', to: 'loc-6', distance: 28, accessible: true },
                    { from: 'loc-6', to: 'loc-7', distance: 22, accessible: true },
                    { from: 'loc-6', to: 'loc-8', distance: 22, accessible: true },
                    { from: 'loc-6', to: 'loc-9', distance: 25, accessible: true },
                    { from: 'loc-6', to: 'loc-11', distance: 20, accessible: true },
                    { from: 'loc-6', to: 'loc-12', distance: 20, accessible: true },
                    { from: 'loc-1', to: 'loc-10', distance: 10, accessible: true }
                ],
                beacons: [
                    { id: 'bc-1', locationId: 'loc-1', uuid: 'bbb-001', major: 1, minor: 1 },
                    { id: 'bc-2', locationId: 'loc-2', uuid: 'bbb-002', major: 1, minor: 2 },
                    { id: 'bc-3', locationId: 'loc-6', uuid: 'bbb-003', major: 1, minor: 6 }
                ]
            },
            {
                id: 'building-2',
                name: 'City Hospital',
                icon: '🏥',
                floors: 8,
                locations: [
                    { id: 'h-loc-1', name: 'Emergency Entrance', type: 'entrance', floor: 1, x: 50, y: 90 },
                    { id: 'h-loc-2', name: 'Reception', type: 'common', floor: 1, x: 50, y: 70 },
                    { id: 'h-loc-3', name: 'Pharmacy', type: 'service', floor: 1, x: 30, y: 60 },
                    { id: 'h-loc-4', name: 'ICU', type: 'critical', floor: 3, x: 50, y: 30 },
                    { id: 'h-loc-5', name: 'Radiology', type: 'service', floor: 2, x: 25, y: 50 },
                    { id: 'h-loc-6', name: 'Cafeteria', type: 'dining', floor: 1, x: 70, y: 60 },
                    { id: 'h-loc-7', name: 'Ward A', type: 'room', floor: 4, x: 30, y: 40 },
                    { id: 'h-loc-8', name: 'Ward B', type: 'room', floor: 4, x: 70, y: 40 },
                    { id: 'h-loc-9', name: 'Exit West', type: 'exit', floor: 1, x: 90, y: 90 },
                    { id: 'h-loc-10', name: 'Exit East', type: 'exit', floor: 1, x: 10, y: 90 }
                ],
                connections: [
                    { from: 'h-loc-1', to: 'h-loc-2', distance: 12, accessible: true },
                    { from: 'h-loc-2', to: 'h-loc-3', distance: 18, accessible: true },
                    { from: 'h-loc-2', to: 'h-loc-6', distance: 18, accessible: true },
                    { from: 'h-loc-2', to: 'h-loc-4', distance: 35, accessible: true },
                    { from: 'h-loc-2', to: 'h-loc-5', distance: 25, accessible: true },
                    { from: 'h-loc-2', to: 'h-loc-7', distance: 30, accessible: true },
                    { from: 'h-loc-2', to: 'h-loc-8', distance: 30, accessible: true },
                    { from: 'h-loc-1', to: 'h-loc-9', distance: 8, accessible: true },
                    { from: 'h-loc-1', to: 'h-loc-10', distance: 8, accessible: true }
                ],
                beacons: []
            }
        ];
        this._saveToStorage();
    }

    // ---- Building CRUD ----

    getBuildings() {
        return this.buildings.map(b => ({
            id: b.id,
            name: b.name,
            icon: b.icon,
            floors: b.floors,
            locationCount: b.locations.length
        }));
    }

    getBuilding(id) {
        return this.buildings.find(b => b.id === id) || null;
    }

    addBuilding(data) {
        const building = {
            id: 'building-' + Date.now(),
            name: data.name || 'New Building',
            icon: data.icon || '🏢',
            floors: data.floors || 1,
            locations: [],
            connections: [],
            beacons: []
        };
        this.buildings.push(building);
        this._saveToStorage();
        return building;
    }

    updateBuilding(id, data) {
        const b = this.getBuilding(id);
        if (!b) return null;
        if (data.name) b.name = data.name;
        if (data.icon) b.icon = data.icon;
        if (data.floors) b.floors = data.floors;
        this._saveToStorage();
        return b;
    }

    deleteBuilding(id) {
        this.buildings = this.buildings.filter(b => b.id !== id);
        if (this.currentBuilding && this.currentBuilding.id === id) {
            this.currentBuilding = null;
        }
        this._saveToStorage();
    }

    selectBuilding(id) {
        this.currentBuilding = this.getBuilding(id);
        return this.currentBuilding;
    }

    // ---- Location CRUD ----

    getLocations(buildingId) {
        const b = buildingId ? this.getBuilding(buildingId) : this.currentBuilding;
        return b ? b.locations : [];
    }

    getLocation(buildingId, locationId) {
        const b = buildingId ? this.getBuilding(buildingId) : this.currentBuilding;
        return b ? b.locations.find(l => l.id === locationId) || null : null;
    }

    addLocation(data) {
        if (!this.currentBuilding) return null;
        const loc = {
            id: 'loc-' + Date.now(),
            name: data.name || 'New Location',
            type: data.type || 'room',
            floor: data.floor || 1,
            x: data.x || 50,
            y: data.y || 50
        };
        this.currentBuilding.locations.push(loc);
        this._saveToStorage();
        return loc;
    }

    updateLocation(locationId, data) {
        if (!this.currentBuilding) return null;
        const loc = this.currentBuilding.locations.find(l => l.id === locationId);
        if (!loc) return null;
        Object.assign(loc, data);
        this._saveToStorage();
        return loc;
    }

    deleteLocation(locationId) {
        if (!this.currentBuilding) return;
        this.currentBuilding.locations = this.currentBuilding.locations.filter(l => l.id !== locationId);
        this.currentBuilding.connections = this.currentBuilding.connections.filter(
            c => c.from !== locationId && c.to !== locationId
        );
        this._saveToStorage();
    }

    // ---- Connection CRUD ----

    getConnections(buildingId) {
        const b = buildingId ? this.getBuilding(buildingId) : this.currentBuilding;
        return b ? b.connections : [];
    }

    addConnection(fromId, toId, distance, accessible) {
        if (!this.currentBuilding) return null;
        // Prevent duplicates
        const exists = this.currentBuilding.connections.some(
            c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
        );
        if (exists) return null;
        const conn = {
            from: fromId,
            to: toId,
            distance: distance || 10,
            accessible: accessible !== false
        };
        this.currentBuilding.connections.push(conn);
        this._saveToStorage();
        return conn;
    }

    deleteConnection(fromId, toId) {
        if (!this.currentBuilding) return;
        this.currentBuilding.connections = this.currentBuilding.connections.filter(
            c => !((c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId))
        );
        this._saveToStorage();
    }

    // ---- Graph for A* ----

    getGraph() {
        if (!this.currentBuilding) return null;
        const graph = {};
        for (const loc of this.currentBuilding.locations) {
            graph[loc.id] = [];
        }
        for (const conn of this.currentBuilding.connections) {
            if (graph[conn.from] && graph[conn.to]) {
                graph[conn.from].push({ node: conn.to, distance: conn.distance, accessible: conn.accessible });
                graph[conn.to].push({ node: conn.from, distance: conn.distance, accessible: conn.accessible });
            }
        }
        return graph;
    }

    // ---- Exits ----

    getExits() {
        if (!this.currentBuilding) return [];
        return this.currentBuilding.locations.filter(l => l.type === 'exit' || l.type === 'entrance');
    }
}

// Global singleton
window.BuildingMapService = new BuildingMapService();
