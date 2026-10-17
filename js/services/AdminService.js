/**
 * AdminService — Administrative CRUD operations.
 * Manages buildings, locations, connections, and beacons.
 */
class AdminService {
    constructor() {
        this.mapService = window.BuildingMapService;
    }

    // ---- Buildings ----

    getBuildings() {
        return this.mapService.getBuildings();
    }

    addBuilding(data) {
        return this.mapService.addBuilding(data);
    }

    updateBuilding(id, data) {
        return this.mapService.updateBuilding(id, data);
    }

    deleteBuilding(id) {
        this.mapService.deleteBuilding(id);
    }

    // ---- Locations ----

    getLocations() {
        return this.mapService.getLocations();
    }

    addLocation(data) {
        return this.mapService.addLocation(data);
    }

    updateLocation(id, data) {
        return this.mapService.updateLocation(id, data);
    }

    deleteLocation(id) {
        this.mapService.deleteLocation(id);
    }

    // ---- Connections ----

    getConnections() {
        return this.mapService.getConnections();
    }

    addConnection(fromId, toId, distance, accessible) {
        return this.mapService.addConnection(fromId, toId, distance, accessible);
    }

    deleteConnection(fromId, toId) {
        this.mapService.deleteConnection(fromId, toId);
    }

    // ---- Beacons ----

    getBeacons() {
        if (!this.mapService.currentBuilding) return [];
        return this.mapService.currentBuilding.beacons || [];
    }

    addBeacon(data) {
        if (!this.mapService.currentBuilding) return null;
        const beacon = {
            id: 'bc-' + Date.now(),
            locationId: data.locationId,
            uuid: data.uuid || '',
            major: data.major || 0,
            minor: data.minor || 0
        };
        if (!this.mapService.currentBuilding.beacons) {
            this.mapService.currentBuilding.beacons = [];
        }
        this.mapService.currentBuilding.beacons.push(beacon);
        this.mapService._saveToStorage();
        return beacon;
    }

    deleteBeacon(id) {
        if (!this.mapService.currentBuilding) return;
        this.mapService.currentBuilding.beacons = (this.mapService.currentBuilding.beacons || []).filter(b => b.id !== id);
        this.mapService._saveToStorage();
    }

    // ---- Import / Export ----

    exportBuilding(id) {
        const building = this.mapService.getBuilding(id);
        if (!building) return null;
        return JSON.stringify(building, null, 2);
    }

    importBuilding(jsonString) {
        try {
            const building = JSON.parse(jsonString);
            if (!building.name || !building.locations) {
                return { success: false, error: 'Invalid building data' };
            }
            building.id = 'building-' + Date.now();
            this.mapService.buildings.push(building);
            this.mapService._saveToStorage();
            return { success: true, building };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // ---- Validation ----

    validateBuilding(data) {
        const errors = [];
        if (!data.name || data.name.trim().length === 0) {
            errors.push('Building name is required');
        }
        if (data.floors && (isNaN(data.floors) || data.floors < 1)) {
            errors.push('Floors must be a positive number');
        }
        return { valid: errors.length === 0, errors };
    }

    validateLocation(data) {
        const errors = [];
        if (!data.name || data.name.trim().length === 0) {
            errors.push('Location name is required');
        }
        if (data.x && (isNaN(data.x) || data.x < 0 || data.x > 100)) {
            errors.push('X coordinate must be between 0 and 100');
        }
        if (data.y && (isNaN(data.y) || data.y < 0 || data.y > 100)) {
            errors.push('Y coordinate must be between 0 and 100');
        }
        return { valid: errors.length === 0, errors };
    }
}

// Global instance
window.AdminService = new AdminService();
