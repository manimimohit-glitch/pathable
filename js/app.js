/**
 * PathAble — Main Application Controller
 * Ties all services together and manages UI state.
 */
window.PathAble = (function() {
    'use strict';

    // ---- State ----
    const state = {
        currentScreen: 'splash',
        selectedBuilding: null,
        isNavigating: false,
        currentRoute: null,
        currentRouteIndex: 0,
        currentDestination: null,
        isEmergency: false,
        isObstacleDetecting: false,
        nearbyPlaces: [],
        lastVoiceCommand: null,
        positionUpdateInterval: null
    };

    // ---- DOM References ----
    const dom = {};

    // ---- Initialization ----

    function init() {
        // Cache DOM elements
        cacheDom();

        // Show splash first
        showScreen('splash-screen');

        // Initialize services with error handling
        initServices();

        // Mirror everything spoken into a live region, so the app is usable
        // with speech off, in a noisy corridor, or on a muted phone.
        initCaptions();

        // Bind all event handlers
        bindEvents();

        // Transition splash after delay
        setTimeout(() => {
            const buildings = window.BuildingMapService.getBuildings();
            if (buildings.length === 0) {
                showToast('No buildings available. Please add one in Admin.', 'error');
            }
            showScreen('building-screen');
            renderBuildingList();
        }, 2500);
    }

    function cacheDom() {
        // Screens
        dom.splashScreen = document.getElementById('splash-screen');
        dom.buildingScreen = document.getElementById('building-screen');
        dom.homeScreen = document.getElementById('home-screen');
        dom.navigationScreen = document.getElementById('navigation-screen');
        dom.obstacleScreen = document.getElementById('obstacle-screen');
        dom.nearbyScreen = document.getElementById('nearby-screen');
        dom.settingsScreen = document.getElementById('settings-screen');
        dom.adminScreen = document.getElementById('admin-screen');

        // Building screen
        dom.buildingList = document.getElementById('building-list');

        // Home screen
        dom.currentLocationText = document.getElementById('current-location-text');
        dom.positioningBadge = document.getElementById('positioning-badge');
        dom.voiceNavBtn = document.getElementById('voice-nav-btn');
        dom.btnStartNav = document.getElementById('btn-start-nav');
        dom.btnFindDest = document.getElementById('btn-find-dest');
        dom.btnNearby = document.getElementById('btn-nearby');
        dom.btnObstacle = document.getElementById('btn-obstacle');
        dom.btnEmergency = document.getElementById('btn-emergency');
        dom.btnSettings = document.getElementById('btn-settings');
        dom.btnAdmin = document.getElementById('btn-admin');

        // Navigation screen
        dom.btnStopNav = document.getElementById('btn-stop-nav');
        dom.navDestination = document.getElementById('nav-destination');
        dom.navStatus = document.getElementById('nav-status');
        dom.instructionIcon = document.getElementById('instruction-icon');
        dom.instructionText = document.getElementById('instruction-text');
        dom.distanceRemaining = document.getElementById('distance-remaining');
        dom.nextTurn = document.getElementById('next-turn');
        dom.btnRepeat = document.getElementById('btn-repeat');
        dom.btnReroute = document.getElementById('btn-reroute');

        // Obstacle screen
        dom.btnStopObstacle = document.getElementById('btn-stop-obstacle');
        dom.cameraVideo = document.getElementById('camera-video');
        dom.cameraStatus = document.getElementById('camera-status');
        dom.detectionBox = document.getElementById('detection-box');
        dom.detectionStatus = document.getElementById('detection-status');
        dom.detectedObject = document.getElementById('detected-object');
        dom.detectedDistance = document.getElementById('detected-distance');
        dom.detectionConfidence = document.getElementById('detection-confidence');
        dom.detectionPosition = document.getElementById('detection-position');
        dom.obstacleWarning = document.getElementById('obstacle-warning');

        // Nearby screen
        dom.btnNearbyBack = document.getElementById('btn-nearby-back');
        dom.nearbyList = document.getElementById('nearby-list');

        // Settings screen
        dom.btnSettingsBack = document.getElementById('btn-settings-back');
        dom.voiceSpeed = document.getElementById('voice-speed');
        dom.voiceSpeedValue = document.getElementById('voice-speed-value');
        dom.voiceVolume = document.getElementById('voice-volume');
        dom.voiceVolumeValue = document.getElementById('voice-volume-value');
        dom.voiceLanguage = document.getElementById('voice-language');
        dom.autoRepeat = document.getElementById('auto-repeat');
        dom.sayInfo = document.getElementById('say-info');
        dom.muteVoice = document.getElementById('mute-voice');
        dom.routePreference = document.getElementById('route-preference');
        dom.highContrast = document.getElementById('high-contrast');
        dom.largeText = document.getElementById('large-text');
        dom.vibration = document.getElementById('vibration');
        dom.audioAlerts = document.getElementById('audio-alerts');
        dom.emergencyContact = document.getElementById('emergency-contact');

        // Admin screen
        dom.btnAdminBack = document.getElementById('btn-admin-back');
        dom.tabBuildings = document.getElementById('tab-buildings');
        dom.tabLocations = document.getElementById('tab-locations');
        dom.tabConnections = document.getElementById('tab-connections');
        dom.tabBeacons = document.getElementById('tab-beacons');
        dom.btnAddBuilding = document.getElementById('btn-add-building');
        dom.btnAddLocation = document.getElementById('btn-add-location');
        dom.btnAddConnection = document.getElementById('btn-add-connection');
        dom.btnAddBeacon = document.getElementById('btn-add-beacon');
        dom.adminBuildingsList = document.getElementById('admin-buildings-list');
        dom.adminLocationsList = document.getElementById('admin-locations-list');
        dom.adminConnectionsList = document.getElementById('admin-connections-list');
        dom.adminBeaconsList = document.getElementById('admin-beacons-list');

        // Voice overlay
        dom.voiceOverlay = document.getElementById('voice-overlay');
        dom.voiceOverlayText = document.getElementById('voice-overlay-text');

        // Toast
        dom.toastContainer = document.getElementById('toast-container');
    }

    function initCaptions() {
        dom.captionText = document.getElementById('caption-text');

        window.VoiceAssistantService.setCaptionCallback((text) => {
            if (!dom.captionText) return;
            dom.captionText.textContent = text;
        });
    }

    function initServices() {
        // Each service init wrapped in try/catch to prevent splash from getting stuck
        try {
            // BuildingMapService is already initialized as singleton
            console.log('PathAble: BuildingMapService ready');
        } catch (e) {
            console.error('PathAble: BuildingMapService init failed', e);
        }

        try {
            // VoiceAssistantService is already initialized as singleton
            console.log('PathAble: VoiceAssistantService ready');
        } catch (e) {
            console.error('PathAble: VoiceAssistantService init failed', e);
        }

        try {
            // IndoorPositioningService is already initialized as singleton
            console.log('PathAble: IndoorPositioningService ready');
        } catch (e) {
            console.error('PathAble: IndoorPositioningService init failed', e);
        }

        try {
            // RoutePlanningService is already initialized as singleton
            console.log('PathAble: RoutePlanningService ready');
        } catch (e) {
            console.error('PathAble: RoutePlanningService init failed', e);
        }

        try {
            // NavigationInstructionService is already initialized as singleton
            console.log('PathAble: NavigationInstructionService ready');
        } catch (e) {
            console.error('PathAble: NavigationInstructionService init failed', e);
        }

        try {
            // ReroutingService is already initialized as singleton
            console.log('PathAble: ReroutingService ready');
        } catch (e) {
            console.error('PathAble: ReroutingService init failed', e);
        }

        try {
            // EmergencyNavigationService is already initialized as singleton
            console.log('PathAble: EmergencyNavigationService ready');
        } catch (e) {
            console.error('PathAble: EmergencyNavigationService init failed', e);
        }

        try {
            // ObjectDetectionService is already initialized as singleton
            console.log('PathAble: ObjectDetectionService ready');
        } catch (e) {
            console.error('PathAble: ObjectDetectionService init failed', e);
        }

        try {
            // DistanceEstimationService is already initialized as singleton
            console.log('PathAble: DistanceEstimationService ready');
        } catch (e) {
            console.error('PathAble: DistanceEstimationService init failed', e);
        }

        try {
            // ObstacleRiskService is already initialized as singleton
            console.log('PathAble: ObstacleRiskService ready');
        } catch (e) {
            console.error('PathAble: ObstacleRiskService init failed', e);
        }

        try {
            // AdminService is already initialized as singleton
            console.log('PathAble: AdminService ready');
        } catch (e) {
            console.error('PathAble: AdminService init failed', e);
        }
    }

    // ---- Event Binding ----

    function bindEvents() {
        // Home screen
        dom.voiceNavBtn.addEventListener('click', handleVoiceNav);
        dom.btnStartNav.addEventListener('click', handleStartNav);
        dom.btnFindDest.addEventListener('click', handleFindDest);
        dom.btnNearby.addEventListener('click', handleNearby);
        dom.btnObstacle.addEventListener('click', handleObstacleDetection);
        dom.btnEmergency.addEventListener('click', handleEmergency);
        dom.btnSettings.addEventListener('click', () => showScreen('settings-screen'));
        dom.btnAdmin.addEventListener('click', () => showScreen('admin-screen'));

        // Navigation screen
        dom.btnStopNav.addEventListener('click', handleStopNav);
        dom.btnRepeat.addEventListener('click', handleRepeat);
        dom.btnReroute.addEventListener('click', handleReroute);

        // Obstacle screen
        dom.btnStopObstacle.addEventListener('click', handleStopObstacle);

        // Nearby screen
        dom.btnNearbyBack.addEventListener('click', () => showScreen('home-screen'));

        // Settings screen
        dom.btnSettingsBack.addEventListener('click', () => showScreen('home-screen'));
        bindSettingsEvents();

        // Admin screen
        dom.btnAdminBack.addEventListener('click', () => showScreen('home-screen'));
        bindAdminEvents();

        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
        });
    }

    function bindSettingsEvents() {
        // Voice speed
        dom.voiceSpeed.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dom.voiceSpeedValue.textContent = val.toFixed(1) + 'x';
            window.VoiceAssistantService.updateSettings('speed', val);
        });

        // Voice volume
        dom.voiceVolume.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dom.voiceVolumeValue.textContent = Math.round(val * 100) + '%';
            window.VoiceAssistantService.updateSettings('volume', val);
        });

        // Voice language
        dom.voiceLanguage.addEventListener('change', (e) => {
            window.VoiceAssistantService.updateSettings('language', e.target.value);
        });

        // Auto repeat
        dom.autoRepeat.addEventListener('change', (e) => {
            window.VoiceAssistantService.updateSettings('autoRepeat', e.target.checked);
        });

        // Speak info-level detections (distant objects)
        dom.sayInfo.addEventListener('change', (e) => {
            window.VoiceAssistantService.updateSettings('sayInfo', e.target.checked);
        });

        // Mute all non-critical speech
        dom.muteVoice.addEventListener('change', (e) => {
            window.VoiceAssistantService.updateSettings('muted', e.target.checked);
        });

        // Reflect saved voice settings in the controls
        const vs = window.VoiceAssistantService.settings;
        dom.autoRepeat.checked = !!vs.autoRepeat;
        dom.sayInfo.checked = !!vs.sayInfo;
        dom.muteVoice.checked = !!vs.muted;

        // Route preference
        dom.routePreference.addEventListener('change', (e) => {
            window.RoutePlanningService.setMode(e.target.value);
        });

        // High contrast
        dom.highContrast.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-contrast', e.target.checked ? 'high' : 'normal');
        });

        // Large text
        dom.largeText.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-text', e.target.checked ? 'large' : 'normal');
        });

        // Vibration
        dom.vibration.addEventListener('change', (e) => {
            window.ObstacleRiskService.vibrationEnabled = e.target.checked;
        });

        // Audio alerts
        dom.audioAlerts.addEventListener('change', (e) => {
            window.ObstacleRiskService.audioAlertsEnabled = e.target.checked;
        });

        // Emergency contact
        dom.emergencyContact.addEventListener('change', (e) => {
            try {
                localStorage.setItem('pathable_emergency_contact', e.target.value);
            } catch (err) { /* ignore */ }
        });
    }

    function bindAdminEvents() {
        dom.btnAddBuilding.addEventListener('click', () => {
            const name = prompt('Building name:');
            if (name) {
                window.AdminService.addBuilding({ name, icon: '🏢', floors: 1 });
                renderAdminBuildings();
                renderBuildingList();
            }
        });

        dom.btnAddLocation.addEventListener('click', () => {
            const name = prompt('Location name:');
            if (name) {
                const type = prompt('Type (room/restroom/elevator/stairs/exit/entrance/common/dining/meeting/service/critical):', 'room') || 'room';
                const floor = parseInt(prompt('Floor:', '1')) || 1;
                window.AdminService.addLocation({ name, type, floor, x: 50, y: 50 });
                renderAdminLocations();
            }
        });

        dom.btnAddConnection.addEventListener('click', () => {
            const locations = window.AdminService.getLocations();
            if (locations.length < 2) {
                showToast('Need at least 2 locations to create a connection.', 'warning');
                return;
            }
            const fromName = prompt('From location name:');
            const toName = prompt('To location name:');
            const from = locations.find(l => l.name.toLowerCase() === fromName?.toLowerCase());
            const to = locations.find(l => l.name.toLowerCase() === toName?.toLowerCase());
            if (from && to) {
                const dist = parseInt(prompt('Distance (meters):', '10')) || 10;
                const accessible = confirm('Accessible route?');
                window.AdminService.addConnection(from.id, to.id, dist, accessible);
                renderAdminConnections();
            } else {
                showToast('Location not found.', 'error');
            }
        });

        dom.btnAddBeacon.addEventListener('click', () => {
            const locations = window.AdminService.getLocations();
            if (locations.length === 0) {
                showToast('Add locations first.', 'warning');
                return;
            }
            const locName = prompt('Location name:');
            const loc = locations.find(l => l.name.toLowerCase() === locName?.toLowerCase());
            if (loc) {
                const uuid = prompt('Beacon UUID:') || '';
                const major = parseInt(prompt('Major:', '0')) || 0;
                const minor = parseInt(prompt('Minor:', '0')) || 0;
                window.AdminService.addBeacon({ locationId: loc.id, uuid, major, minor });
                renderAdminBeacons();
            }
        });
    }

    // ---- Screen Management ----

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            state.currentScreen = screenId;
        }
    }

    // ---- Building Selection ----

    function renderBuildingList() {
        const buildings = window.BuildingMapService.getBuildings();
        dom.buildingList.innerHTML = '';

        buildings.forEach(b => {
            const card = document.createElement('button');
            card.className = 'building-card';
            card.setAttribute('aria-label', `Select ${b.name}`);
            card.innerHTML = `
                <div class="building-icon">${b.icon}</div>
                <div class="building-info">
                    <div class="building-name">${b.name}</div>
                    <div class="building-meta">${b.floors} floors · ${b.locationCount} locations</div>
                </div>
            `;
            card.addEventListener('click', () => selectBuilding(b.id));
            dom.buildingList.appendChild(card);
        });
    }

    function selectBuilding(buildingId) {
        const building = window.BuildingMapService.selectBuilding(buildingId);
        if (building) {
            state.selectedBuilding = building;
            showScreen('home-screen');
            updateHomeScreen();
            window.VoiceAssistantService.speak(`Selected ${building.name}. Where would you like to go?`);
        }
    }

    function updateHomeScreen() {
        if (!state.selectedBuilding) return;

        // Update location text
        const pos = window.IndoorPositioningService.getCurrentPosition();
        if (pos && pos.name) {
            dom.currentLocationText.textContent = pos.name;
        }

        // Update positioning badge
        if (pos && pos.provider === 'simulated') {
            dom.positioningBadge.textContent = 'SIMULATED';
            dom.positioningBadge.className = 'badge badge-sim';
        } else {
            dom.positioningBadge.textContent = 'LIVE';
            dom.positioningBadge.className = 'badge badge-live';
        }
    }

    // ---- Voice Navigation ----

    function handleVoiceNav() {
        showVoiceOverlay('Listening...');

        const success = window.VoiceAssistantService.startListening(
            (transcript) => {
                hideVoiceOverlay();
                handleVoiceCommand(transcript);
            },
            () => {
                hideVoiceOverlay();
            }
        );

        if (!success) {
            hideVoiceOverlay();
            showToast('Voice recognition not available. Please use text input.', 'warning');
        }
    }

    function handleVoiceCommand(transcript) {
        const command = window.VoiceAssistantService.parseCommand(transcript);
        state.lastVoiceCommand = command;

        switch (command.action) {
            case 'navigate':
                navigateToDestination(command.destination);
                break;
            case 'emergency':
                handleEmergency();
                break;
            case 'stop_navigation':
                handleStopNav();
                break;
            case 'repeat':
                handleRepeat();
                break;
            case 'toggle_obstacle':
                handleObstacleDetection();
                break;
            case 'settings':
                showScreen('settings-screen');
                break;
            case 'nearby':
                handleNearby();
                break;
            default:
                showToast(`Didn't understand: "${transcript}"`, 'info');
                window.VoiceAssistantService.speak("Sorry, I didn't understand. Please try again.");
        }
    }

    // ---- Navigation ----

    function handleStartNav() {
        const locations = window.BuildingMapService.getLocations();
        if (locations.length === 0) {
            showToast('No locations available in this building.', 'warning');
            return;
        }

        // Show location picker
        const destName = prompt('Enter destination (e.g., "Room 205", "Cafeteria", "Restroom"):');
        if (destName) {
            navigateToDestination(destName);
        }
    }

    function handleFindDest() {
        const locations = window.BuildingMapService.getLocations();
        if (locations.length === 0) {
            showToast('No locations available.', 'warning');
            return;
        }

        // Create a simple list for selection
        const locNames = locations.map((l, i) => `${i + 1}. ${l.name}`).join('\n');
        const choice = prompt(`Select destination:\n${locNames}\n\nEnter number:`);
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < locations.length) {
            navigateToDestination(locations[idx].name);
        }
    }

    function navigateToDestination(destName) {
        if (!state.selectedBuilding) {
            showToast('Please select a building first.', 'warning');
            return;
        }

        const locations = window.BuildingMapService.getLocations();
        const dest = locations.find(l => l.name.toLowerCase().includes(destName.toLowerCase()));

        if (!dest) {
            showToast(`Destination "${destName}" not found.`, 'error');
            window.VoiceAssistantService.speak(`Sorry, I couldn't find ${destName}.`);
            return;
        }

        // Get current position
        const currentPos = window.IndoorPositioningService.getCurrentPosition();
        const startLoc = currentPos && currentPos.locationId
            ? locations.find(l => l.id === currentPos.locationId)
            : locations[0];

        if (!startLoc) {
            showToast('Could not determine starting location.', 'error');
            return;
        }

        // Get graph and find route
        const graph = window.BuildingMapService.getGraph();
        const locationsMap = {};
        locations.forEach(l => { locationsMap[l.id] = l; });

        const route = window.RoutePlanningService.findRoute(graph, startLoc.id, dest.id, locationsMap);

        if (!route.found) {
            showToast(`No route found to ${dest.name}.`, 'error');
            window.VoiceAssistantService.speak(`Sorry, I couldn't find a route to ${dest.name}.`);
            return;
        }

        // Start navigation
        state.isNavigating = true;
        state.currentRoute = route;
        state.currentRouteIndex = 0;
        state.currentDestination = dest;

        showScreen('navigation-screen');
        updateNavigationDisplay();

        // Start rerouting monitoring
        window.ReroutingService.startMonitoring(
            route.path,
            (currentLocId, destId) => {
                // Reroute callback
                handleReroute();
            },
            (frames, threshold) => {
                // Off-route callback
                if (frames >= threshold) {
                    showToast('You are off route. Recalculating...', 'warning');
                }
            }
        );

        // Start position tracking for navigation
        startPositionTracking();

        // Speak first instruction
        const instruction = window.NavigationInstructionService.getProgressInstruction(
            route.path, 0, locationsMap, route.distance
        );
        if (instruction) {
            window.VoiceAssistantService.speak(instruction.text);
            window.NavigationInstructionService.setLastInstruction(instruction);
        }
    }

    function updateNavigationDisplay() {
        if (!state.currentRoute || !state.currentDestination) return;

        const locations = window.BuildingMapService.getLocations();
        const locationsMap = {};
        locations.forEach(l => { locationsMap[l.id] = l; });

        const instruction = window.NavigationInstructionService.getProgressInstruction(
            state.currentRoute.path,
            state.currentRouteIndex,
            locationsMap,
            state.currentRoute.distance
        );

        if (instruction) {
            dom.navDestination.textContent = state.currentDestination.name;
            dom.navStatus.textContent = state.isEmergency ? 'EMERGENCY' : 'Navigating...';
            dom.instructionIcon.textContent = instruction.icon;
            dom.instructionText.textContent = instruction.text;
            dom.distanceRemaining.textContent = instruction.distanceRemaining + 'm';
            dom.nextTurn.textContent = instruction.nextTurn || '—';
        }
    }

    function startPositionTracking() {
        if (state.positionUpdateInterval) {
            clearInterval(state.positionUpdateInterval);
        }

        state.positionUpdateInterval = setInterval(() => {
            if (!state.isNavigating) return;

            const pos = window.IndoorPositioningService.getCurrentPosition();
            if (!pos) return;

            const locations = window.BuildingMapService.getLocations();
            const locationsMap = {};
            locations.forEach(l => { locationsMap[l.id] = l; });

            // Check if arrived
            if (state.currentDestination) {
                const destLoc = locationsMap[state.currentDestination.id];
                if (destLoc && window.ReroutingService.hasArrived(pos, destLoc)) {
                    handleArrival();
                    return;
                }
            }

            // Update route index based on closest waypoint
            const routeInfo = window.ReroutingService.updatePosition(pos, locationsMap);
            if (routeInfo && routeInfo.closestWaypointIndex > state.currentRouteIndex) {
                state.currentRouteIndex = routeInfo.closestWaypointIndex;
                updateNavigationDisplay();

                // Speak new instruction
                const instruction = window.NavigationInstructionService.getProgressInstruction(
                    state.currentRoute.path,
                    state.currentRouteIndex,
                    locationsMap,
                    state.currentRoute.distance
                );
                if (instruction) {
                    window.VoiceAssistantService.speak(instruction.text);
                    window.NavigationInstructionService.setLastInstruction(instruction);
                }
            }
        }, 500);
    }

    function handleArrival() {
        state.isNavigating = false;
        window.ReroutingService.stopMonitoring();
        if (state.positionUpdateInterval) {
            clearInterval(state.positionUpdateInterval);
            state.positionUpdateInterval = null;
        }

        window.VoiceAssistantService.speak(`You have arrived at ${state.currentDestination.name}.`);
        showToast(`Arrived at ${state.currentDestination.name}`, 'success');

        setTimeout(() => {
            showScreen('home-screen');
            updateHomeScreen();
        }, 2000);
    }

    function handleStopNav() {
        state.isNavigating = false;
        state.isEmergency = false;
        state.currentRoute = null;
        state.currentDestination = null;
        window.ReroutingService.stopMonitoring();
        if (state.positionUpdateInterval) {
            clearInterval(state.positionUpdateInterval);
            state.positionUpdateInterval = null;
        }
        window.VoiceAssistantService.stopSpeaking();
        showScreen('home-screen');
        updateHomeScreen();
    }

    function handleRepeat() {
        const last = window.NavigationInstructionService.getLastInstruction();
        if (last) {
            window.VoiceAssistantService.speak(last.text);
        } else {
            showToast('No instruction to repeat.', 'info');
        }
    }

    function handleReroute() {
        if (!state.currentDestination) return;

        const locations = window.BuildingMapService.getLocations();
        const currentPos = window.IndoorPositioningService.getCurrentPosition();
        const startLoc = currentPos && currentPos.locationId
            ? locations.find(l => l.id === currentPos.locationId)
            : locations[0];

        const graph = window.BuildingMapService.getGraph();
        const locationsMap = {};
        locations.forEach(l => { locationsMap[l.id] = l; });

        const newRoute = window.RoutePlanningService.findRoute(graph, startLoc.id, state.currentDestination.id, locationsMap);

        if (newRoute.found) {
            state.currentRoute = newRoute;
            state.currentRouteIndex = 0;
            updateNavigationDisplay();
            window.VoiceAssistantService.speak('Route recalculated. ' + (window.NavigationInstructionService.getProgressInstruction(newRoute.path, 0, locationsMap, newRoute.distance)?.text || ''));
        } else {
            showToast('Could not find alternative route.', 'error');
        }
    }

    // ---- Emergency ----

    function handleEmergency() {
        if (!state.selectedBuilding) {
            showToast('Please select a building first.', 'warning');
            return;
        }

        state.isEmergency = true;
        state.isNavigating = true;

        const locations = window.BuildingMapService.getLocations();
        const currentPos = window.IndoorPositioningService.getCurrentPosition();
        const startLoc = currentPos && currentPos.locationId
            ? locations.find(l => l.id === currentPos.locationId)
            : locations[0];

        const graph = window.BuildingMapService.getGraph();
        const locationsMap = {};
        locations.forEach(l => { locationsMap[l.id] = l; });

        const route = window.EmergencyNavigationService.activateEmergency(
            startLoc.id,
            graph,
            locationsMap,
            (emergencyRoute) => {
                state.currentRoute = emergencyRoute;
                state.currentDestination = emergencyRoute.exit;
                state.currentRouteIndex = 0;

                showScreen('navigation-screen');
                updateNavigationDisplay();

                window.VoiceAssistantService.speak(
                    `Emergency! Nearest exit is ${emergencyRoute.exit.name}. Follow the route.`,
                    'critical'
                );

                startPositionTracking();
            },
            () => {
                state.isEmergency = false;
            }
        );

        if (!route) {
            showToast('No emergency exit found!', 'error');
            state.isEmergency = false;
        }
    }

    // ---- Obstacle Detection ----

    async function handleObstacleDetection() {
        showScreen('obstacle-screen');
        state.isObstacleDetecting = true;

        dom.cameraStatus.textContent = 'Starting camera...';
        dom.detectionStatus.textContent = 'Loading…';
        dom.obstacleWarning.className = 'warning-banner';

        const result = await window.ObjectDetectionService.startDetection(
            dom.cameraVideo,
            (detections, smoothed) => {
                handleDetectionResults(detections, smoothed);
            }
        );

        if (!result.success) {
            state.isObstacleDetecting = false;

            if (result.error === 'camera') {
                dom.cameraStatus.textContent = 'Camera unavailable';
                showToast('Camera access failed. Check browser permissions and that no other app is using the camera.', 'error');
                window.VoiceAssistantService.speak('Camera is not available. Please check your browser permissions.');
            } else if (result.error === 'model') {
                dom.cameraStatus.textContent = 'AI model failed to load';
                showToast('AI model could not load: ' + (result.detail || 'unknown error'), 'error');
                window.VoiceAssistantService.speak('The AI model could not be loaded.');
            }
        }
    }

    function handleDetectionResults(detections) {
        const videoWidth = dom.cameraVideo.videoWidth || 640;
        const videoHeight = dom.cameraVideo.videoHeight || 480;

        if (!detections || detections.length === 0) {
            dom.detectionStatus.textContent = 'Clear';
            dom.detectedObject.textContent = 'Nothing detected';
            dom.detectedDistance.textContent = '—';
            dom.detectionConfidence.textContent = '—';
            dom.detectionPosition.textContent = '—';
            dom.obstacleWarning.className = 'warning-banner';
            dom.obstacleWarning.textContent = '';
            dom.cameraStatus.textContent = 'Scanning';
            return;
        }

        // Highest-risk object leads the panel, not whichever happened to sort
        // first — that was showing an irrelevant object ahead of a real hazard.
        let highestRisk = null;
        let leadDet = null;

        for (const det of detections) {
            const dp = window.ObjectDetectionService.getDetectionWithPosition(det, videoWidth, videoHeight);
            if (!dp) continue;

            const de = window.DistanceEstimationService.estimateDistance(dp, videoWidth);
            const risk = window.ObstacleRiskService.assessRisk(dp, de);
            if (risk && (!highestRisk || risk.priority < highestRisk.priority)) {
                highestRisk = risk;
                leadDet = dp;
                leadDet._estimate = de;
            }
        }

        if (leadDet) {
            dom.detectionStatus.textContent = detections.length > 1
                ? `Active (${detections.length} objects)`
                : 'Active';
            dom.detectedObject.textContent = leadDet.class
                ? leadDet.class.charAt(0).toUpperCase() + leadDet.class.slice(1)
                : '—';

            if (leadDet.orientation) {
                dom.detectedObject.textContent += ` (${leadDet.orientation})`;
            } else if (leadDet.direction) {
                dom.detectedObject.textContent += ` (${leadDet.direction}${leadDet.stepCount ? `, ${leadDet.stepCount} steps` : ''})`;
            }

            dom.detectedDistance.textContent =
                window.DistanceEstimationService.formatDistance(leadDet._estimate);
            dom.detectionConfidence.textContent = leadDet.confidence + '%';
            dom.detectionPosition.textContent =
                leadDet.position === 'center' ? 'Ahead' :
                leadDet.position === 'left' ? 'Left' : 'Right';
        }

        if (highestRisk) {
            window.ObstacleRiskService.triggerAlert(highestRisk, (alertRisk) => {
                dom.obstacleWarning.textContent = alertRisk.message;
                dom.obstacleWarning.className =
                    'warning-banner active ' + window.ObstacleRiskService.getWarningClass(alertRisk.level);
            });
        }

        dom.cameraStatus.textContent = 'Detecting';
    }

    function handleStopObstacle() {
        state.isObstacleDetecting = false;
        window.ObjectDetectionService.stopDetection();
        window.ObstacleRiskService.resetCooldowns();
        showScreen('home-screen');
    }

    // ---- Nearby Places ----

    function handleNearby() {
        showScreen('nearby-screen');

        const locations = window.BuildingMapService.getLocations();
        const currentPos = window.IndoorPositioningService.getCurrentPosition();

        // Sort by distance from current position
        const sorted = [...locations].sort((a, b) => {
            const distA = currentPos ? Math.sqrt((a.x - currentPos.x) ** 2 + (a.y - currentPos.y) ** 2) : 0;
            const distB = currentPos ? Math.sqrt((b.x - currentPos.x) ** 2 + (b.y - currentPos.y) ** 2) : 0;
            return distA - distB;
        });

        // Take top 10
        state.nearbyPlaces = sorted.slice(0, 10);
        renderNearbyList();
    }

    function renderNearbyList() {
        dom.nearbyList.innerHTML = '';

        state.nearbyPlaces.forEach(place => {
            const card = document.createElement('div');
            card.className = 'nearby-card';

            const icon = getLocationIcon(place.type);
            const dist = window.IndoorPositioningService.getCurrentPosition()
                ? Math.round(Math.sqrt((place.x - (window.IndoorPositioningService.getCurrentPosition()?.x || 0)) ** 2 + (place.y - (window.IndoorPositioningService.getCurrentPosition()?.y || 0)) ** 2) * 0.5)
                : '?';

            card.innerHTML = `
                <div class="nearby-icon">${icon}</div>
                <div class="nearby-info">
                    <div class="nearby-name">${place.name}</div>
                    <div class="nearby-distance">${dist}m away · Floor ${place.floor}</div>
                </div>
                <button class="nearby-nav-btn" data-dest="${place.name}">Navigate</button>
            `;

            card.querySelector('.nearby-nav-btn').addEventListener('click', () => {
                navigateToDestination(place.name);
            });

            dom.nearbyList.appendChild(card);
        });
    }

    function getLocationIcon(type) {
        const icons = {
            entrance: '🚪',
            exit: '🚨',
            elevator: '🛗',
            stairs: '🪜',
            restroom: '🚻',
            dining: '🍽️',
            meeting: '📋',
            room: '🚪',
            common: '🏢',
            service: '🔧',
            critical: '🏥'
        };
        return icons[type] || '📍';
    }

    // ---- Admin Panel ----

    function switchAdminTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

        const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        const content = document.getElementById('tab-' + tabName);
        if (btn) btn.classList.add('active');
        if (content) content.classList.remove('hidden');

        // Render content
        switch (tabName) {
            case 'buildings': renderAdminBuildings(); break;
            case 'locations': renderAdminLocations(); break;
            case 'connections': renderAdminConnections(); break;
            case 'beacons': renderAdminBeacons(); break;
        }
    }

    function renderAdminBuildings() {
        const buildings = window.AdminService.getBuildings();
        dom.adminBuildingsList.innerHTML = '';

        buildings.forEach(b => {
            const item = document.createElement('div');
            item.className = 'admin-item';
            item.innerHTML = `
                <div class="admin-item-info">
                    <div class="admin-item-name">${b.icon} ${b.name}</div>
                    <div class="admin-item-meta">${b.floors} floors · ${b.locationCount} locations</div>
                </div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn delete" data-id="${b.id}">Delete</button>
                </div>
            `;
            item.querySelector('.delete').addEventListener('click', () => {
                if (confirm(`Delete ${b.name}?`)) {
                    window.AdminService.deleteBuilding(b.id);
                    renderAdminBuildings();
                    renderBuildingList();
                }
            });
            dom.adminBuildingsList.appendChild(item);
        });
    }

    function renderAdminLocations() {
        const locations = window.AdminService.getLocations();
        dom.adminLocationsList.innerHTML = '';

        locations.forEach(loc => {
            const item = document.createElement('div');
            item.className = 'admin-item';
            item.innerHTML = `
                <div class="admin-item-info">
                    <div class="admin-item-name">${getLocationIcon(loc.type)} ${loc.name}</div>
                    <div class="admin-item-meta">Floor ${loc.floor} · (${loc.x}, ${loc.y})</div>
                </div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn delete" data-id="${loc.id}">Delete</button>
                </div>
            `;
            item.querySelector('.delete').addEventListener('click', () => {
                if (confirm(`Delete ${loc.name}?`)) {
                    window.AdminService.deleteLocation(loc.id);
                    renderAdminLocations();
                }
            });
            dom.adminLocationsList.appendChild(item);
        });
    }

    function renderAdminConnections() {
        const connections = window.AdminService.getConnections();
        const locations = window.AdminService.getLocations();
        const locMap = {};
        locations.forEach(l => { locMap[l.id] = l; });

        dom.adminConnectionsList.innerHTML = '';

        connections.forEach(conn => {
            const from = locMap[conn.from]?.name || conn.from;
            const to = locMap[conn.to]?.name || conn.to;
            const item = document.createElement('div');
            item.className = 'admin-item';
            item.innerHTML = `
                <div class="admin-item-info">
                    <div class="admin-item-name">${from} ↔ ${to}</div>
                    <div class="admin-item-meta">${conn.distance}m · ${conn.accessible ? 'Accessible' : 'Not accessible'}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn delete" data-from="${conn.from}" data-to="${conn.to}">Delete</button>
                </div>
            `;
            item.querySelector('.delete').addEventListener('click', () => {
                window.AdminService.deleteConnection(conn.from, conn.to);
                renderAdminConnections();
            });
            dom.adminConnectionsList.appendChild(item);
        });
    }

    function renderAdminBeacons() {
        const beacons = window.AdminService.getBeacons();
        const locations = window.AdminService.getLocations();
        const locMap = {};
        locations.forEach(l => { locMap[l.id] = l; });

        dom.adminBeaconsList.innerHTML = '';

        beacons.forEach(bc => {
            const loc = locMap[bc.locationId]?.name || bc.locationId;
            const item = document.createElement('div');
            item.className = 'admin-item';
            item.innerHTML = `
                <div class="admin-item-info">
                    <div class="admin-item-name">📡 ${loc}</div>
                    <div class="admin-item-meta">UUID: ${bc.uuid || '—'} · ${bc.major}.${bc.minor}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn delete" data-id="${bc.id}">Delete</button>
                </div>
            `;
            item.querySelector('.delete').addEventListener('click', () => {
                window.AdminService.deleteBeacon(bc.id);
                renderAdminBeacons();
            });
            dom.adminBeaconsList.appendChild(item);
        });
    }

    // ---- Voice Overlay ----

    function showVoiceOverlay(text) {
        dom.voiceOverlayText.textContent = text;
        dom.voiceOverlay.classList.remove('hidden');
    }

    function hideVoiceOverlay() {
        dom.voiceOverlay.classList.add('hidden');
    }

    // ---- Toast ----

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ---- Public API ----

    return {
        init,
        showScreen,
        showToast,
        selectBuilding,
        navigateToDestination,
        handleEmergency,
        handleStopNav,
        handleObstacleDetection,
        handleStopObstacle,
        handleNearby,
        handleVoiceCommand,
        handleRepeat,
        handleReroute,
        state
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.PathAble.init);
} else {
    window.PathAble.init();
}
