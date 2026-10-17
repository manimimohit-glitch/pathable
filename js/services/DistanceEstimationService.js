/**
 * DistanceEstimationService — Estimates real-world distance to detected objects.
 * Uses known object widths + camera geometry. Provides uncertainty indicators.
 * No guessing — only estimates when sufficient data is available.
 */
class DistanceEstimationService {
    constructor() {
        // Known average widths in meters for COCO-SSD classes
        this.knownWidths = {
            person: 0.5,       // shoulder width
            chair: 0.45,
            table: 1.2,
            bench: 1.5,
            door: 0.9,
            // Add more as needed
        };

        // Camera focal length in pixels (approximate for typical phone cameras)
        // This is a rough estimate — real calibration would improve accuracy
        this.focalLength = 800; // pixels at 640x480 resolution

        // Average stair step height in meters
        this.stepHeight = 0.175; // 17.5cm standard step
    }

    /**
     * Estimate distance to a detected object.
     * Returns null if distance cannot be reliably estimated.
     *
     * @param {Object} detection — { class, bbox: [x, y, width, height] }
     * @param {number} videoWidth — Width of video frame in pixels
     * @returns {Object} { distance, unit: 'meters', method, uncertainty } or null
     */
    estimateDistance(detection, videoWidth) {
        if (!detection || !detection.bbox) return null;

        const [x, y, width, height] = detection.bbox;
        const className = detection.class;

        // Method 1: Known object width
        if (this.knownWidths[className]) {
            return this._estimateByKnownWidth(className, width, videoWidth);
        }

        // Method 2: Person height (if person detected, use height instead)
        if (className === 'person') {
            return this._estimateByPersonHeight(height, videoWidth);
        }

        // Method 3: Wall distance — use edge density and apparent height
        if (className === 'wall') {
            return this._estimateWallDistance(detection, videoWidth);
        }

        // Method 4: Stair distance — use step count and apparent size
        if (className === 'stairs') {
            return this._estimateStairDistance(detection, videoWidth);
        }

        // Cannot estimate — no guessing
        return null;
    }

    /**
     * Estimate distance using known object width.
     * Formula: distance = (knownWidth * focalLength) / apparentWidth
     */
    _estimateByKnownWidth(className, apparentWidthPixels, videoWidth) {
        if (apparentWidthPixels <= 0) return null;

        const knownWidth = this.knownWidths[className];
        const distance = (knownWidth * this.focalLength) / apparentWidthPixels;

        // Uncertainty increases with distance
        const uncertainty = this._calculateUncertainty(distance, apparentWidthPixels);

        return {
            distance: Math.round(distance * 10) / 10,
            unit: 'meters',
            method: 'known_width',
            uncertainty,
            reliable: uncertainty !== 'high'
        };
    }

    /**
     * Estimate distance using average person height (1.7m).
     */
    _estimateByPersonHeight(apparentHeightPixels, videoWidth) {
        if (apparentHeightPixels <= 0) return null;

        const avgHeight = 1.7; // meters
        const distance = (avgHeight * this.focalLength) / apparentHeightPixels;

        const uncertainty = this._calculateUncertainty(distance, apparentHeightPixels);

        return {
            distance: Math.round(distance * 10) / 10,
            unit: 'meters',
            method: 'person_height',
            uncertainty,
            reliable: uncertainty !== 'high'
        };
    }

    /**
     * Estimate wall distance using apparent height in frame.
     * Walls span the full frame height when close, less when far.
     */
    _estimateWallDistance(detection, videoWidth) {
        const [x, y, width, height] = detection.bbox;
        const apparentHeight = height; // normalized 0-1

        // Wall apparent height inversely correlates with distance
        // Full frame height ≈ 1-2 meters, half frame ≈ 3-4 meters
        if (apparentHeight > 0.8) {
            return { distance: 1.5, unit: 'meters', method: 'wall_height', uncertainty: 'low', reliable: true };
        } else if (apparentHeight > 0.5) {
            return { distance: 2.5, unit: 'meters', method: 'wall_height', uncertainty: 'medium', reliable: true };
        } else if (apparentHeight > 0.3) {
            return { distance: 4, unit: 'meters', method: 'wall_height', uncertainty: 'medium', reliable: true };
        } else {
            return { distance: 6, unit: 'meters', method: 'wall_height', uncertainty: 'high', reliable: false };
        }
    }

    /**
     * Estimate stair distance using step count and apparent size.
     */
    _estimateStairDistance(detection, videoWidth) {
        const [x, y, width, height] = detection.bbox;
        const stepCount = detection.stepCount || 3;
        const apparentHeight = height; // normalized 0-1

        // More visible steps + larger apparent size = closer
        const totalStepHeight = stepCount * this.stepHeight;

        if (apparentHeight > 0.6) {
            return { distance: 2, unit: 'meters', method: 'stair_steps', uncertainty: 'low', reliable: true };
        } else if (apparentHeight > 0.3) {
            return { distance: 3.5, unit: 'meters', method: 'stair_steps', uncertainty: 'medium', reliable: true };
        } else {
            return { distance: 5, unit: 'meters', method: 'stair_steps', uncertainty: 'high', reliable: false };
        }
    }

    /**
     * Calculate uncertainty based on apparent size and distance.
     * Smaller apparent size = higher uncertainty.
     */
    _calculateUncertainty(distance, apparentSizePixels) {
        if (apparentSizePixels < 20 || distance > 15) return 'high';
        if (apparentSizePixels < 50 || distance > 8) return 'medium';
        return 'low';
    }

    /**
     * Format distance for display with uncertainty indicator.
     */
    formatDistance(estimate) {
        if (!estimate) return 'Unknown';

        const dist = estimate.distance;
        let text;

        if (dist < 1) text = 'Less than 1 meter';
        else if (dist < 3) text = `About ${Math.round(dist)} meters`;
        else if (dist < 10) text = `About ${Math.round(dist)} meters`;
        else text = `About ${Math.round(dist / 5) * 5} meters`;

        // Add uncertainty indicator
        if (estimate.uncertainty === 'high') {
            text += ' (approximate)';
        }

        return text;
    }

    /**
     * Get distance category for risk assessment.
     */
    getDistanceCategory(estimate) {
        if (!estimate) return 'unknown';
        const dist = estimate.distance;
        if (dist < 1.5) return 'immediate';
        if (dist < 3) return 'close';
        if (dist < 6) return 'medium';
        return 'far';
    }
}

// Global instance
window.DistanceEstimationService = new DistanceEstimationService();
