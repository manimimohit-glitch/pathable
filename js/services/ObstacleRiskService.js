/**
 * ObstacleRiskService — Classifies obstacle risk and manages alerts.
 *
 * Design goal: a blind user walking with this in their pocket will turn the
 * volume down within seconds if it narrates constantly. So the rule is
 * escalate-only, dedupe by position, and go silent when nothing changes.
 * The user is told when something gets closer — not that something exists.
 */
class ObstacleRiskService {
    constructor() {
        this.alertCooldowns = {};
        this.cooldownDuration = 3000;
        this.vibrationEnabled = true;
        this.audioAlertsEnabled = true;

        this._lastAlertTime = 0;
        this._minAlertInterval = 1800;

        // What we last announced, so we only speak on a change.
        this._active = new Map();   // key -> { level, category }
    }

    /**
     * Assess risk for a detected object.
     * @returns {Object} { level, priority, message, action, key }
     */
    assessRisk(detection, distanceEstimate) {
        if (!detection) return null;

        const category = window.DistanceEstimationService.getDistanceCategory(distanceEstimate);
        const className = detection.class;
        const position = detection.position || 'center';
        const bucket = detection.bucket || 'C';

        // Dedup key includes screen region, so "new thing on my left" is a
        // different event from "same thing still there".
        const key = `${className}_${bucket}`;
        const where = position === 'center' ? 'ahead' : `on your ${position}`;

        const RANK = { critical: 1, high: 2, normal: 3, info: 4 };

        let level = 'info';
        let message = null;
        let action = 'none';

        if (className === 'wall') {
            const orientation = detection.orientation;
            const kind = orientation === 'horizontal' ? 'Wall ahead' : 'Wall';

            if (category === 'immediate') {
                level = 'critical';
                message = 'Wall directly ahead. Stop.';
            } else if (category === 'close') {
                level = 'high';
                message = `Wall close, ${where}.`;
            } else if (category === 'medium') {
                level = 'normal';
                message = `Wall ${where}.`;
            } else {
                level = 'info';
                message = `${kind} ${where}.`;
            }
        } else if (className === 'stairs') {
            const dir = detection.direction === 'down' ? 'down' : 'up';
            const steps = detection.stepCount;

            if (category === 'immediate') {
                level = 'critical';
                message = `Stairs going ${dir}, right in front of you.`;
            } else if (category === 'close') {
                level = 'high';
                message = `Stairs going ${dir}, ${where}${steps ? `, ${steps} steps` : ''}.`;
            } else {
                level = 'info';
                message = `Stairs going ${dir} ${where}.`;
            }
        } else {
            // Plain objects. Only immediate/close are worth speaking at all.
            if (category === 'immediate') {
                level = 'critical';
                message = `${this._cap(className)} directly ahead. Stop.`;
            } else if (category === 'close') {
                if (this._isHighRiskObject(className)) {
                    level = 'high';
                    message = `${this._cap(className)} close, ${where}.`;
                } else {
                    level = 'normal';
                    message = `${this._cap(className)} ${where}.`;
                }
            } else if (category === 'medium') {
                level = 'info';
                message = `${this._cap(className)} ${where}.`;
            } else {
                level = 'info';
                message = `${this._cap(className)} ahead.`;
            }
        }

        action = level === 'critical' ? 'stop'
               : level === 'high' ? 'caution'
               : level === 'normal' ? 'aware' : 'none';

        return { level, priority: RANK[level], message, action, object: className, position, key, category };
    }

    _cap(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    /**
     * Pick the risk worth acting on from everything in frame.
     */
    processDetections(detections, videoWidth, videoHeight) {
        if (!detections || detections.length === 0) return null;

        let highestRisk = null;

        for (const det of detections) {
            const detWithPos = window.ObjectDetectionService.getDetectionWithPosition(det, videoWidth, videoHeight);
            if (!detWithPos) continue;

            const distanceEst = window.DistanceEstimationService.estimateDistance(detWithPos, videoWidth);
            const risk = this.assessRisk(detWithPos, distanceEst);

            if (risk && (!highestRisk || risk.priority < highestRisk.priority)) {
                highestRisk = risk;
            }
        }

        return highestRisk;
    }

    /**
     * Speak only when something changes for the worse.
     *
     * Returns true if an alert was emitted.
     */
    triggerAlert(risk, onAlert) {
        if (!risk) return false;

        const prev = this._active.get(risk.key);
        const RANK = { critical: 1, high: 2, normal: 3, info: 4 };

        // Never repeat the same state.
        if (prev && prev.level === risk.level) return false;

        // Only speak when escalating. Something receding into the distance is
        // good news — it does not need announcing.
        if (prev && RANK[risk.level] >= RANK[prev.level]) {
            this._active.set(risk.key, { level: risk.level, category: risk.category });
            return false;
        }

        const now = Date.now();
        if (now - this._lastAlertTime < this._minAlertInterval) {
            return false;
        }

        this._active.set(risk.key, { level: risk.level, category: risk.category });
        this._lastAlertTime = now;

        if (this.vibrationEnabled) this._vibrate(risk.level);

        // 'info' is off by default — that is the chatter users switch off.
        const speakInfo = window.VoiceAssistantService?.settings?.sayInfo;
        if (this.audioAlertsEnabled && (risk.level !== 'info' || speakInfo)) {
            window.VoiceAssistantService.speak(
                risk.message,
                risk.level === 'critical' ? 'critical' : 'normal'
            );
        }

        if (onAlert) onAlert(risk);
        return true;
    }

    _vibrate(level) {
        if (!navigator.vibrate) return;
        const patterns = {
            critical: [200, 100, 200, 100, 200],
            high: [150, 50, 150],
            normal: [100],
            info: [50]
        };
        navigator.vibrate(patterns[level] || [50]);
    }

    _isHighRiskObject(className) {
        return ['person', 'chair', 'dining table', 'bench', 'couch',
                'stairs', 'door', 'wall', 'suitcase'].includes(className);
    }

    getWarningClass(level) {
        return ['critical', 'high', 'normal', 'info'].includes(level) ? level : 'normal';
    }

    /**
     * Call when the detection loop stops so the next session re-announces.
     */
    resetCooldowns() {
        this.alertCooldowns = {};
        this._lastAlertTime = 0;
        this._active.clear();
    }
}

// Global instance
window.ObstacleRiskService = new ObstacleRiskService();