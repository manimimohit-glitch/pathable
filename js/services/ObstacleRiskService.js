/**
 * ObstacleRiskService — Classifies obstacle risk levels and manages alerts.
 * Priority: Critical > High > Normal > Info
 * Includes cooldowns to prevent alert fatigue.
 */
class ObstacleRiskService {
    constructor() {
        this.alertCooldowns = {};
        this.cooldownDuration = 3000; // ms between alerts for same object
        this.vibrationEnabled = true;
        this.audioAlertsEnabled = true;
        this._lastAlertTime = 0;
        this._minAlertInterval = 1500; // minimum ms between any alerts
    }

    /**
     * Assess risk for a detected object.
     * @param {Object} detection — { class, confidence, position }
     * @param {Object} distanceEstimate — From DistanceEstimationService
     * @returns {Object} { level, priority, message, action }
     */
    assessRisk(detection, distanceEstimate) {
        if (!detection) return null;

        const category = window.DistanceEstimationService.getDistanceCategory(distanceEstimate);
        const className = detection.class;
        const position = detection.position || 'center';

        // Determine risk level based on distance and object type
        let level, priority, message, action;

        // Special handling for walls
        if (className === 'wall') {
            if (category === 'immediate') {
                level = 'critical'; priority = 1;
                message = `Wall directly ahead! Stop or turn.`;
                action = 'stop';
            } else if (category === 'close') {
                level = 'high'; priority = 2;
                message = `Wall very close on your ${position}.`;
                action = 'caution';
            } else if (category === 'medium') {
                level = 'normal'; priority = 3;
                message = `Wall on your ${position}.`;
                action = 'aware';
            } else {
                level = 'info'; priority = 4;
                message = `Wall visible on your ${position}.`;
                action = 'none';
            }
            return { level, priority, message, action, object: className, position };
        }

        // Special handling for stairs
        if (className === 'stairs') {
            const dir = detection.direction || 'up';
            if (category === 'immediate') {
                level = 'critical'; priority = 1;
                message = `Stairs going ${dir} directly ahead! Watch your step!`;
                action = 'stop';
            } else if (category === 'close') {
                level = 'high'; priority = 2;
                message = `Stairs going ${dir} very close. ${detection.stepCount || 'Several'} steps.`;
                action = 'caution';
            } else if (category === 'medium') {
                level = 'normal'; priority = 3;
                message = `Stairs going ${dir} ahead.`;
                action = 'aware';
            } else {
                level = 'info'; priority = 4;
                message = `Stairs going ${dir} in the distance.`;
                action = 'none';
            }
            return { level, priority, message, action, object: className, position };
        }

        if (category === 'immediate') {
            level = 'critical';
            priority = 1;
            message = `Warning! ${className} directly ahead!`;
            action = 'stop';
        } else if (category === 'close') {
            if (this._isHighRiskObject(className)) {
                level = 'high';
                priority = 2;
                message = `${className} very close on your ${position}.`;
                action = 'caution';
            } else {
                level = 'normal';
                priority = 3;
                message = `${className} nearby on your ${position}.`;
                action = 'aware';
            }
        } else if (category === 'medium') {
            level = 'normal';
            priority = 3;
            message = `${className} detected ahead on your ${position}.`;
            action = 'aware';
        } else {
            level = 'info';
            priority = 4;
            message = `${className} visible in the distance.`;
            action = 'none';
        }

        return { level, priority, message, action, object: className, position };
    }

    /**
     * Process all detections and return the highest priority risk.
     */
    processDetections(detections, videoWidth) {
        if (!detections || detections.length === 0) return null;

        let highestRisk = null;

        for (const det of detections) {
            const detWithPos = window.ObjectDetectionService.getDetectionWithPosition(det, videoWidth);
            const distanceEst = window.DistanceEstimationService.estimateDistance(det, videoWidth);
            const risk = this.assessRisk(detWithPos, distanceEst);

            if (risk && (!highestRisk || risk.priority < highestRisk.priority)) {
                highestRisk = risk;
            }
        }

        return highestRisk;
    }

    /**
     * Trigger alert for a risk (with cooldown check).
     */
    triggerAlert(risk, onAlert) {
        if (!risk) return false;

        const now = Date.now();

        // Check global minimum interval
        if (now - this._lastAlertTime < this._minAlertInterval) {
            return false;
        }

        // Check per-object cooldown
        const cooldownKey = `${risk.object}_${risk.level}`;
        if (this.alertCooldowns[cooldownKey] && now - this.alertCooldowns[cooldownKey] < this.cooldownDuration) {
            return false;
        }

        this.alertCooldowns[cooldownKey] = now;
        this._lastAlertTime = now;

        // Vibration
        if (this.vibrationEnabled) {
            this._vibrate(risk.level);
        }

        // Audio alert
        if (this.audioAlertsEnabled && risk.level !== 'info') {
            window.VoiceAssistantService.speak(risk.message, risk.level === 'critical' ? 'critical' : 'normal');
        }

        // Callback
        if (onAlert) {
            onAlert(risk);
        }

        return true;
    }

    /**
     * Vibrate device with pattern based on risk level.
     */
    _vibrate(level) {
        if (!navigator.vibrate) return;

        const patterns = {
            critical: [200, 100, 200, 100, 200],
            high: [150, 50, 150],
            normal: [100],
            info: [50]
        };

        const pattern = patterns[level] || [50];
        navigator.vibrate(pattern);
    }

    /**
     * Check if object type is inherently high-risk.
     */
    _isHighRiskObject(className) {
        const highRisk = ['person', 'chair', 'table', 'bench', 'stairs', 'door', 'wall'];
        return highRisk.includes(className);
    }

    /**
     * Get CSS class for warning banner.
     */
    getWarningClass(level) {
        const classes = {
            critical: 'critical',
            high: 'high',
            normal: 'normal',
            info: 'info'
        };
        return classes[level] || 'normal';
    }

    /**
     * Reset all cooldowns.
     */
    resetCooldowns() {
        this.alertCooldowns = {};
        this._lastAlertTime = 0;
    }
}

// Global instance
window.ObstacleRiskService = new ObstacleRiskService();
