/**
 * DistanceEstimationService — Estimates real-world distance to detected objects.
 * Uses known object widths + camera geometry. Provides uncertainty indicators.
 *
 * Honesty rule: if there is no defensible basis for a number, return null.
 * The caller then reports "Unknown" rather than inventing a distance.
 */
class DistanceEstimationService {
    constructor() {
        // Typical real-world widths in meters. Only classes we actually alert
        // on belong here — an entry means we claim to be able to measure it,
        // so anything without a dependable real-world width is absent and
        // will report "Unknown" instead of a number.
        this.knownWidths = {
            person: 0.5,        // shoulder width
            chair: 0.45,
            'dining table': 1.2,
            bench: 1.5,
            couch: 2.0,
            door: 0.9,
            'potted plant': 0.4,
            suitcase: 0.35,
            backpack: 0.35,
            bicycle: 0.6,
            motorcycle: 0.7
        };

        // Focal length in pixels at a 640px-wide frame. Approximate for a
        // typical phone main camera; real accuracy needs a per-device
        // calibration step, which is why every result carries an uncertainty.
        this.focalLength = 800;

        this.stepHeight = 0.175; // standard stair rise
    }

    /**
     * @param {Object} detection — From getDetectionWithPosition (has
     *        widthPixels / heightPixels) or a raw detection with a bbox.
     * @param {number} videoWidth
     * @returns {Object|null} { distance, unit, method, uncertainty, reliable }
     */
    estimateDistance(detection, videoWidth = 640) {
        if (!detection) return null;

        const pxWidth = detection.widthPixels;
        const pxHeight = detection.heightPixels;
        if (!pxWidth && !pxHeight) return null;

        const className = detection.class;

        // Known real-world width.
        if (this.knownWidths[className] && pxWidth > 0) {
            return this._estimateByKnownWidth(className, pxWidth);
        }

        // A person standing at known average height.
        if (className === 'person' && pxHeight > 0) {
            return this._estimateByPersonHeight(pxHeight);
        }

        if (className === 'wall') return this._estimateWallDistance(detection);
        if (className === 'stairs') return this._estimateStairDistance(detection);

        // No defensible basis — say so rather than guessing.
        return null;
    }

    /**
     * distance = (knownWidth * focalLength) / apparentWidthPixels
     */
    _estimateByKnownWidth(className, apparentWidthPixels) {
        if (apparentWidthPixels <= 0) return null;

        const knownWidth = this.knownWidths[className];
        const distance = (knownWidth * this.focalLength) / apparentWidthPixels;

        // A bounding box only a few pixels wide is not a measurement.
        if (apparentWidthPixels < 8) {
            return {
                distance: null,
                unit: 'meters',
                method: 'known_width',
                uncertainty: 'high',
                reliable: false
            };
        }

        const uncertainty = this._calculateUncertainty(distance, apparentWidthPixels);

        return {
            distance: Math.round(distance * 10) / 10,
            unit: 'meters',
            method: 'known_width',
            uncertainty,
            reliable: uncertainty !== 'high'
        };
    }

    _estimateByPersonHeight(apparentHeightPixels) {
        if (apparentHeightPixels <= 0) return null;

        const avgHeight = 1.7;
        const distance = (avgHeight * this.focalLength) / apparentHeightPixels;

        if (apparentHeightPixels < 12) {
            return {
                distance: null,
                unit: 'meters',
                method: 'person_height',
                uncertainty: 'high',
                reliable: false
            };
        }

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
     * Walls have no known width. Apparent frame height is a coarse proxy:
     * a wall filling the frame is close, one hugging the horizon is far.
     * These bands are wide on purpose and always labelled medium/high.
     *
     * The closest band must fall inside the 'immediate' range (< 1.5m).
     * Previously the floor here was 1.5m itself, so a wall — the single most
     * dangerous thing a blind walker meets — could never raise a critical
     * alert at any distance.
     */
    _estimateWallDistance(detection) {
        const apparentHeight = detection.heightPixels;
        if (!apparentHeight) return null;

        if (apparentHeight > 0.85) {
            // Filling the frame: within arm's reach.
            return { distance: 0.9, unit: 'meters', method: 'wall_height', uncertainty: 'medium', reliable: true };
        }
        if (apparentHeight > 0.6) {
            return { distance: 1.4, unit: 'meters', method: 'wall_height', uncertainty: 'medium', reliable: true };
        }
        if (apparentHeight > 0.35) {
            return { distance: 2.5, unit: 'meters', method: 'wall_height', uncertainty: 'medium', reliable: true };
        }
        if (apparentHeight > 0.2) {
            return { distance: 4, unit: 'meters', method: 'wall_height', uncertainty: 'high', reliable: false };
        }
        return { distance: 6, unit: 'meters', method: 'wall_height', uncertainty: 'high', reliable: false };
    }

    /**
     * Stairs by apparent size. Like walls, the nearest band has to reach into
     * the 'immediate' range, since an unnoticed step is a fall.
     */
    _estimateStairDistance(detection) {
        const apparentHeight = detection.heightPixels;
        if (!apparentHeight) return null;

        if (apparentHeight > 0.75) {
            return { distance: 1.2, unit: 'meters', method: 'stair_steps', uncertainty: 'medium', reliable: true };
        }
        if (apparentHeight > 0.45) {
            return { distance: 2, unit: 'meters', method: 'stair_steps', uncertainty: 'medium', reliable: true };
        }
        if (apparentHeight > 0.25) {
            return { distance: 3.5, unit: 'meters', method: 'stair_steps', uncertainty: 'high', reliable: false };
        }
        return { distance: 5, unit: 'meters', method: 'stair_steps', uncertainty: 'high', reliable: false };
    }

    /**
     * Two independent reasons to distrust a number: the object is small in
     * frame (few pixels, noisy box), or it is far away (focal-length error
     * dominates). Either pushes the estimate up a tier.
     */
    _calculateUncertainty(distance, apparentSizePixels) {
        if (apparentSizePixels < 20 || distance > 15) return 'high';
        if (apparentSizePixels < 50 || distance > 8) return 'medium';
        return 'low';
    }

    /**
     * Spoken distance. No "About" padding, no unit when the number is 1 —
     * "a metre", "three metres" is how people actually speak.
     */
    formatDistance(estimate) {
        if (!estimate || estimate.distance === null || estimate.distance === undefined) {
            return 'Unknown';
        }

        const dist = estimate.distance;

        if (dist < 1) return 'less than a metre';
        if (dist < 2) return 'about a metre';
        if (dist < 10) return `about ${Math.round(dist)} metres`;
        return `about ${Math.round(dist / 5) * 5} metres`;
    }

    /**
     * Coarse band for risk decisions and alert de-duplication.
     *
     * The previous thresholds assumed a metres value that could never occur
     * (a chair computed at ~1200m), so every object landed in 'far' and no
     * alert ever fired.
     */
    getDistanceCategory(estimate) {
        if (!estimate || estimate.distance === null || estimate.distance === undefined) {
            return 'unknown';
        }
        const dist = estimate.distance;
        if (dist < 1.5) return 'immediate';
        if (dist < 3) return 'close';
        if (dist < 6) return 'medium';
        return 'far';
    }
}

// Global instance
window.DistanceEstimationService = new DistanceEstimationService();