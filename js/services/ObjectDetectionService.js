/**
 * ObjectDetectionService — Multi-layer real AI object detection.
 *
 * Layer 1: TensorFlow.js + COCO-SSD (80 classes: person, chair, door, etc.)
 * Layer 2: Custom wall detection via edge analysis (Sobel gradient)
 * Layer 3: Custom stair detection via horizontal line pattern analysis
 *
 * Lazy-loads TF.js scripts. Uses temporal smoothing and NMS.
 */
class ObjectDetectionService {
    constructor() {
        this.model = null;
        this.isLoading = false;
        this.isReady = false;
        this.detectionHistory = [];
        this.historySize = 5;
        // 3-of-5 confirmation. This is what keeps single noisy frames silent;
        // it was previously computed and then thrown away.
        this.minConfirmFrames = 3;
        // Mobility aids a phone-level detector can actually see. COCO-SSD's
        // 80 classes are mostly irrelevant indoors and each one costs the user
        // a false alert, so we detect fewer things and say them well.
        // Every name here is a genuine COCO-SSD label.
        this.relevantClasses = new Set([
            'person', 'chair', 'bench', 'dining table', 'potted plant',
            'couch', 'bed', 'door', 'tv', 'laptop',
            'toilet', 'sink', 'refrigerator', 'book', 'clock', 'vase',
            'bottle', 'cup', 'backpack', 'handbag', 'umbrella', 'suitcase',
            'bicycle', 'motorcycle', 'car', 'bus', 'truck'
        ]);
        this.confidenceThreshold = 0.45;
        this.nmsThreshold = 0.5;
        this._scriptsLoaded = false;
        this._loadPromise = null;
        this._videoElement = null;
        this._canvas = null;
        this._ctx = null;
        this._detectionInterval = null;
        this._onDetectionCallback = null;
        this._isDetecting = false;

        // Analysis canvas for custom CV (walls, stairs)
        this._analysisCanvas = null;
        this._analysisCtx = null;

        // Stair detection history
        this._stairHistory = [];
    }

    /**
     * Load one script and resolve when it has executed.
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // preserve execution order
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Load TensorFlow.js then COCO-SSD, strictly in order.
     * coco-ssd depends on the global `tf`, so it must not run first.
     */
    _injectScripts() {
        if (this._scriptsLoaded) return Promise.resolve();
        if (this._loadPromise) return this._loadPromise;

        const TFJS_URLS = [
            'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js',
            'https://unpkg.com/@tensorflow/tfjs@4.17.0/dist/tf.min.js'
        ];
        const COCO_URLS = [
            'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
            'https://unpkg.com/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'
        ];

        // Try each URL in turn until one loads.
        const tryEach = (urls, index = 0) => {
            if (index >= urls.length) return Promise.reject(new Error('All CDN mirrors failed'));
            return this._loadScript(urls[index]).catch(() => tryEach(urls, index + 1));
        };

        this._loadPromise = (async () => {
            // Sequential — tf must be fully loaded before coco-ssd runs
            await tryEach(TFJS_URLS);

            if (typeof window.tf === 'undefined') {
                throw new Error('TensorFlow.js loaded but window.tf is undefined');
            }

            await tryEach(COCO_URLS);

            if (typeof window.cocoSsd === 'undefined') {
                throw new Error('COCO-SSD loaded but window.cocoSsd is undefined');
            }

            this._scriptsLoaded = true;
        })();

        return this._loadPromise;
    }

    /**
     * Initialize the detection model.
     */
    async init() {
        if (this.isReady) return true;
        if (this.isLoading) return this._loadPromise;

        this.isLoading = true;

        try {
            await this._injectScripts();

            // The model weights (~13MB) download from Google Cloud Storage
            this.model = await cocoSsd.load({
                base: 'lite_mobilenet_v2'
            });

            this.isReady = true;
            this.isLoading = false;
            console.log('ObjectDetectionService: Model loaded successfully');
            return true;
        } catch (e) {
            console.error('ObjectDetectionService: Failed to load model —', e.message || e);
            this.isLoading = false;
            this._loadPromise = null;
            this._scriptsLoaded = false;
            this._lastModelError = (e && e.message) || String(e);
            return false;
        }
    }

    /**
     * Start camera and detection loop.
     */
    async startDetection(videoElement, onDetection) {
        this._videoElement = videoElement;
        this._onDetectionCallback = onDetection;

        // Setup analysis canvas for custom CV
        this._setupAnalysisCanvas();

        // Try to get camera stream — try rear camera first, then fall back to any camera
        let stream = null;
        const constraints = [
            { video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } },
            { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
            { video: true } // Any available camera
        ];

        for (const constraint of constraints) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraint);
                if (stream) break;
            } catch (e) {
                console.warn('ObjectDetectionService: Camera constraint failed:', e.name, e.message);
                // Try next constraint
            }
        }

        if (!stream) {
            console.error('ObjectDetectionService: No camera available');
            console.error('Diagnostics:', JSON.stringify({
                hasMediaDevices: !!navigator.mediaDevices,
                hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                isSecureContext: window.isSecureContext,
                origin: window.location.origin
            }, null, 2));
            return { success: false, error: 'camera' };
        }

        this._videoElement.srcObject = stream;
        await this._videoElement.play();

        // Now load the AI model
        if (!this.isReady) {
            const modelSuccess = await this.init();
            if (!modelSuccess) {
                console.error('ObjectDetectionService: Model not available');
                // Stop camera if model fails
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                return { success: false, error: 'model', detail: this._lastModelError || 'unknown error' };
            }
        }

        this._isDetecting = true;
        this._detectionLoop();
        return { success: true };
    }

    _setupAnalysisCanvas() {
        this._analysisCanvas = document.createElement('canvas');
        this._analysisCanvas.width = 160;  // Low-res for performance
        this._analysisCanvas.height = 120;
        this._analysisCtx = this._analysisCanvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Stop detection and release camera.
     */
    stopDetection() {
        this._isDetecting = false;

        if (this._detectionInterval) {
            clearTimeout(this._detectionInterval);
            this._detectionInterval = null;
        }

        if (this._videoElement && this._videoElement.srcObject) {
            const tracks = this._videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this._videoElement.srcObject = null;
        }

        this._onDetectionCallback = null;
        this._stairHistory = [];
    }

    /**
     * Main detection loop.
     */
    async _detectionLoop() {
        if (!this._isDetecting || !this._videoElement || !this.model) return;

        try {
            // Layer 1: COCO-SSD object detection
            const predictions = await this.model.detect(this._videoElement);
            const filtered = this._applyNMS(predictions);

            // Layer 2 & 3: Custom CV analysis (walls + stairs)
            const customDetections = this._runCustomDetection();

            // Combine all detections
            const allDetections = [...filtered, ...customDetections];

            // Drop noise classes, then require temporal confirmation.
            // The confirmed set is what the user hears — a single frame of
            // speckle never reaches them.
            const relevant = allDetections.filter(
                d => d.score >= this.confidenceThreshold &&
                     (this.relevantClasses.has(d.class) || d.class === 'wall' || d.class === 'stairs')
            );
            const results = this._applyTemporalSmoothing(relevant);

            if (this._onDetectionCallback) {
                this._onDetectionCallback(results, relevant);
            }
        } catch (e) {
            console.warn('ObjectDetectionService: Detection error', e);
        }

        if (this._isDetecting) {
            this._detectionInterval = setTimeout(() => this._detectionLoop(), 200);
        }
    }

    // ==========================================================
    // Layer 2: Wall Detection
    // ==========================================================

    /**
     * Detect walls using Sobel edge detection on the camera frame.
     * Walls produce strong vertical/horizontal edge lines.
     */
    detectWalls() {
        if (!this._analysisCtx || !this._videoElement) return [];

        const w = this._analysisCanvas.width;
        const h = this._analysisCanvas.height;

        // Draw current frame to analysis canvas
        this._analysisCtx.drawImage(this._videoElement, 0, 0, w, h);
        const imageData = this._analysisCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Convert to grayscale
        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        // Sobel operator for edge detection
        const sobelX = new Float32Array(w * h);
        const sobelY = new Float32Array(w * h);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;

                // Sobel X kernel: [-1 0 1; -2 0 2; -1 0 1]
                sobelX[idx] =
                    -gray[(y-1)*w + (x-1)] + gray[(y-1)*w + (x+1)]
                    -2*gray[y*w + (x-1)]     + 2*gray[y*w + (x+1)]
                    -gray[(y+1)*w + (x-1)] + gray[(y+1)*w + (x+1)];

                // Sobel Y kernel: [-1 -2 -1; 0 0 0; 1 2 1]
                sobelY[idx] =
                    -gray[(y-1)*w + (x-1)] - 2*gray[(y-1)*w + x] - gray[(y-1)*w + (x+1)]
                    +gray[(y+1)*w + (x-1)] + 2*gray[(y+1)*w + x] + gray[(y+1)*w + (x+1)];
            }
        }

        // Calculate gradient magnitude and direction
        const gradient = new Float32Array(w * h);
        const direction = new Float32Array(w * h);

        for (let i = 0; i < w * h; i++) {
            gradient[i] = Math.sqrt(sobelX[i] * sobelX[i] + sobelY[i] * sobelY[i]);
            direction[i] = Math.atan2(sobelY[i], sobelX[i]) * (180 / Math.PI);
        }

        // Find wall regions — walls have consistent edge direction over large areas
        const wallRegions = this._findWallRegions(gradient, direction, w, h);

        return wallRegions;
    }

    /**
     * Find contiguous wall regions from edge data.
     */
    _findWallRegions(gradient, direction, w, h) {
        const threshold = 60; // Minimum gradient strength for wall edge
        const regions = [];

        // Divide frame into zones (left, center-left, center-right, right)
        const zones = [
            { name: 'left', xStart: 0, xEnd: Math.floor(w * 0.25) },
            { name: 'center-left', xStart: Math.floor(w * 0.25), xEnd: Math.floor(w * 0.5) },
            { name: 'center-right', xStart: Math.floor(w * 0.5), xEnd: Math.floor(w * 0.75) },
            { name: 'right', xStart: Math.floor(w * 0.75), xEnd: w }
        ];

        for (const zone of zones) {
            let strongEdges = 0;
            let totalPixels = 0;
            let verticalEdges = 0;
            let horizontalEdges = 0;

            for (let y = 1; y < h - 1; y++) {
                for (let x = zone.xStart; x < zone.xEnd; x++) {
                    const idx = y * w + x;
                    totalPixels++;

                    if (gradient[idx] > threshold) {
                        strongEdges++;
                        const angle = Math.abs(direction[idx]);
                        // Vertical lines: angle near 0 or 180
                        if (angle < 20 || angle > 160) verticalEdges++;
                        // Horizontal lines: angle near 90
                        if (angle > 70 && angle < 110) horizontalEdges++;
                    }
                }
            }

            const edgeDensity = totalPixels > 0 ? strongEdges / totalPixels : 0;

            // If significant edge density, there's likely a wall
            if (edgeDensity > 0.15 && strongEdges > 20) {
                const orientation = verticalEdges > horizontalEdges ? 'vertical' : 'horizontal';
                regions.push({
                    class: 'wall',
                    score: Math.min(0.95, edgeDensity * 2.5),
                    position: zone.name,
                    bbox: [
                        zone.xStart / w, 0,
                        (zone.xEnd - zone.xStart) / w, 1
                    ],
                    orientation,
                    edgeDensity: Math.round(edgeDensity * 100) / 100
                });
            }
        }

        return regions;
    }

    // ==========================================================
    // Layer 3: Stair Detection
    // ==========================================================

    /**
     * Detect stairs by analyzing horizontal line patterns.
     * Stairs produce repeating horizontal edges at varying heights.
     */
    detectStairs() {
        if (!this._analysisCtx || !this._videoElement) return [];

        const w = this._analysisCanvas.width;
        const h = this._analysisCanvas.height;

        this._analysisCtx.drawImage(this._videoElement, 0, 0, w, h);
        const imageData = this._analysisCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Grayscale
        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            gray[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
        }

        // Detect horizontal edges row by row
        const horizontalEdges = new Float32Array(h);
        for (let y = 1; y < h - 1; y++) {
            let edgeSum = 0;
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                const diff = Math.abs(gray[idx - 1] - gray[idx + 1]);
                edgeSum += diff;
            }
            horizontalEdges[y] = edgeSum / w;
        }

        // Find peaks in horizontal edge strength (potential stair edges)
        const peaks = [];
        const peakThreshold = 30;
        for (let y = 2; y < h - 2; y++) {
            if (horizontalEdges[y] > peakThreshold &&
                horizontalEdges[y] > horizontalEdges[y-1] &&
                horizontalEdges[y] > horizontalEdges[y+1] &&
                horizontalEdges[y] > horizontalEdges[y-2] &&
                horizontalEdges[y] > horizontalEdges[y+2]) {
                peaks.push({ y, strength: horizontalEdges[y] });
            }
        }

        // Stairs: 3+ roughly evenly spaced horizontal peaks
        if (peaks.length >= 3) {
            // Check for even spacing
            const spacings = [];
            for (let i = 1; i < peaks.length; i++) {
                spacings.push(peaks[i].y - peaks[i-1].y);
            }

            const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
            const spacingVariance = spacings.reduce((a, b) => a + Math.abs(b - avgSpacing), 0) / spacings.length;

            // If spacing is relatively consistent, it's likely stairs
            if (spacingVariance < avgSpacing * 0.5 && avgSpacing > 3) {
                // Determine if going up or down based on edge progression
                const isAscending = this._determineStairDirection(peaks, horizontalEdges);

                // Temporal confirmation
                this._stairHistory.push({ peaks: peaks.length, avgSpacing, isAscending });
                if (this._stairHistory.length > 5) this._stairHistory.shift();

                // Require at least 3 of last 5 frames to confirm
                const confirmedFrames = this._stairHistory.filter(s => s.peaks >= 3).length;

                if (confirmedFrames >= 3) {
                    const avgStrength = peaks.reduce((a, p) => a + p.strength, 0) / peaks.length;
                    const confidence = Math.min(0.9, (peaks.length / 8) * (avgStrength / 60));

                    return [{
                        class: 'stairs',
                        score: Math.round(confidence * 100) / 100,
                        position: 'center',
                        bbox: [0.1, Math.max(0, peaks[0].y / h - 0.1), 0.8, Math.min(1, (peaks[peaks.length-1].y - peaks[0].y) / h + 0.2)],
                        direction: isAscending ? 'up' : 'down',
                        stepCount: peaks.length,
                        edgeStrength: Math.round(avgStrength)
                    }];
                }
            }
        }

        return [];
    }

    /**
     * Determine if stairs go up or down based on edge pattern.
     */
    _determineStairDirection(peaks, horizontalEdges) {
        if (peaks.length < 2) return true;

        // Look at edge strength progression
        // Ascending stairs: edges get stronger as they get closer (lower in frame)
        const firstHalf = peaks.slice(0, Math.floor(peaks.length / 2));
        const secondHalf = peaks.slice(Math.floor(peaks.length / 2));

        const firstAvg = firstHalf.reduce((a, p) => a + p.strength, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, p) => a + p.strength, 0) / secondHalf.length;

        // If lower edges are stronger, stairs go up (closer steps appear lower)
        return secondAvg >= firstAvg;
    }

    // ==========================================================
    // Combined Custom Detection
    // ==========================================================

    /**
     * Run both wall and stair detection.
     */
    _runCustomDetection() {
        const detections = [];

        try {
            const walls = this.detectWalls();
            detections.push(...walls);
        } catch (e) {
            console.warn('Wall detection error:', e);
        }

        try {
            const stairs = this.detectStairs();
            detections.push(...stairs);
        } catch (e) {
            console.warn('Stair detection error:', e);
        }

        return detections;
    }

    // ==========================================================
    // NMS & Temporal Smoothing
    // ==========================================================

    _applyNMS(predictions) {
        if (!predictions || predictions.length === 0) return [];

        const sorted = [...predictions].sort((a, b) => b.score - a.score);
        const selected = [];

        for (const pred of sorted) {
            let shouldSuppress = false;
            for (const sel of selected) {
                if (pred.class === sel.class) {
                    const iou = this._calculateIoU(pred.bbox, sel.bbox);
                    if (iou > this.nmsThreshold) {
                        shouldSuppress = true;
                        break;
                    }
                }
            }
            if (!shouldSuppress) {
                selected.push(pred);
            }
        }

        return selected;
    }

    _calculateIoU(boxA, boxB) {
        const [x1, y1, w1, h1] = boxA;
        const [x2, y2, w2, h2] = boxB;

        const xLeft = Math.max(x1, x2);
        const yTop = Math.max(y1, y2);
        const xRight = Math.min(x1 + w1, x2 + w2);
        const yBottom = Math.min(y1 + h1, y2 + h2);

        if (xRight < xLeft || yBottom < yTop) return 0;

        const intersection = (xRight - xLeft) * (yBottom - yTop);
        const areaA = w1 * h1;
        const areaB = w2 * h2;
        const union = areaA + areaB - intersection;

        return union > 0 ? intersection / union : 0;
    }

    /**
     * Require a class to persist for 3 of the last 5 frames before reporting it.
     * Returns the confirmed subset of the current frame.
     */
    _applyTemporalSmoothing(currentDetections) {
        this.detectionHistory.push(currentDetections);
        if (this.detectionHistory.length > this.historySize) {
            this.detectionHistory.shift();
        }

        const classCounts = {};
        for (const frame of this.detectionHistory) {
            for (const det of frame) {
                classCounts[det.class] = (classCounts[det.class] || 0) + 1;
            }
        }

        // While the history is still filling, scale the requirement so the
        // first detection is not silent for a full 5 frames.
        const required = Math.min(
            this.minConfirmFrames,
            Math.max(1, this.detectionHistory.length - 2)
        );

        return currentDetections.filter(det => (classCounts[det.class] || 0) >= required);
    }

    // ==========================================================
    // Detection Helpers
    // ==========================================================

    /**
     * Resolve a detection into pixels plus a left/centre/right position.
     *
     * Both producers in this file emit normalised [x, y, w, h] in 0-1 —
     * COCO-SSD and the wall/stair layers alike — while everything
     * downstream (distance maths, risk) works in pixels. Normalise once,
     * here, instead of scattering the conversion.
     *
     * Note: the previous version compared a 0-1 centre against
     * `videoWidth * 0.33` (~211px), so every detection resolved to "left",
     * and handed distance maths a 0-1 width to divide by.
     */
    getDetectionWithPosition(detection, videoWidth = 640, videoHeight = 480) {
        const bbox = detection.bbox;
        if (!bbox || bbox.length < 4) return null;

        const [x, y, width, height] = bbox;

        const pxWidth = width * videoWidth;
        const pxHeight = height * videoHeight;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Left/right is judged relative to the middle of the frame, with a
        // dead zone so a thing dead ahead is not called "left".
        const position = centerX < 0.40 ? 'left'
                       : centerX > 0.60 ? 'right'
                       : 'center';

        return {
            class: detection.class,
            score: detection.score,
            confidence: Math.round(detection.score * 100),
            bbox: detection.bbox,
            bboxPixels: [x * videoWidth, y * videoHeight, pxWidth, pxHeight],
            widthPixels: pxWidth,
            heightPixels: pxHeight,
            position,
            centerX,
            centerY,
            orientation: detection.orientation || null,
            direction: detection.direction || null,
            stepCount: detection.stepCount || null,
            // Coarse screen region, used to tell "a new thing entered my
            // path" apart from "the same thing is still there".
            bucket: this._screenBucket(centerX, centerY)
        };
    }

    _screenBucket(cx, cy) {
        const horizontal = cx < 0.40 ? 'L' : cx > 0.60 ? 'R' : 'C';
        const vertical = cy < 0.45 ? 'upper' : 'lower';
        return vertical + horizontal;
    }

    drawDetections(detections, canvas, videoWidth, videoHeight) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const det of detections) {
            const [x, y, width, height] = det.bbox;
            const color = this._getClassColor(det.class);

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            const label = `${det.class} ${Math.round(det.score * 100)}%`;
            ctx.font = '14px Inter, sans-serif';
            const textMetrics = ctx.measureText(label);
            const textHeight = 20;

            ctx.fillStyle = color;
            ctx.fillRect(x, y - textHeight, textMetrics.width + 8, textHeight);

            ctx.fillStyle = '#fff';
            ctx.fillText(label, x + 4, y - 5);
        }
    }

    _getClassColor(className) {
        const colors = {
            person: '#ff4757',
            chair: '#ffa502',
            table: '#2ed573',
            door: '#1e90ff',
            stairs: '#ff6b81',
            wall: '#a29bfe',
            bench: '#fd79a8',
            default: '#6c5ce7'
        };
        return colors[className] || colors.default;
    }

    get isDetecting() {
        return this._isDetecting;
    }
}

// Global instance
window.ObjectDetectionService = new ObjectDetectionService();
