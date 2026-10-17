/**
 * Headless check of the detection → distance → risk → speak pipeline.
 * Run: node test-harness.js
 *
 * Verifies the two failure modes found in review:
 *   1. normalised bbox was compared against pixel thresholds -> everything "left"
 *   2. normalised width fed to a pixel formula -> ~1200m -> no alert ever fired
 */

// Minimal browser stubs so the services load outside a browser.
const spoken = [];
global.window = {
    speechSynthesis: null,
    navigator: { vibrate: () => {} },
    localStorage: {
        _d: {},
        getItem(k) { return this._d[k] ?? null; },
        setItem(k, v) { this._d[k] = v; }
    }
};
global.navigator = window.navigator;
global.localStorage = window.localStorage;
global.SpeechSynthesisUtterance = class {
    constructor(t) { this.text = t; }
};

const files = [
    'js/services/VoiceAssistantService.js',
    'js/services/ObjectDetectionService.js',
    'js/services/DistanceEstimationService.js',
    'js/services/ObstacleRiskService.js'
];

for (const f of files) {
    const src = require('fs').readFileSync(__dirname + '/' + f, 'utf8');
    // Services are top-level `class` declarations, not modules.
    eval(src);
}

const OD = window.ObjectDetectionService;
const DE = window.DistanceEstimationService;
const OR = window.ObstacleRiskService;

// Capture what would be spoken.
window.VoiceAssistantService.settings.sayInfo = false;
window.VoiceAssistantService.speak = (text, prio) => { spoken.push({ text, prio }); return true; };

let pass = 0, fail = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log('  PASS  ' + name); }
    else { fail++; console.log('  FAIL  ' + name + '\n         got:      ' + JSON.stringify(actual) + '\n         expected: ' + JSON.stringify(expected)); }
}

const VIDEO_W = 640, VIDEO_H = 480;

// A person filling the frame: 0.50m wide, 1.7m tall.
// bbox is normalised [x, y, w, h] as both producers emit.
const personRect = { class: 'person', score: 0.9, bbox: [0.35, 0.05, 0.30, 0.95] };

console.log('\n1. Position is judged in normalised frame space');
{
    const centre = OD.getDetectionWithPosition(personRect, VIDEO_W, VIDEO_H);
    check('object dead ahead -> "center"', centre.position, 'center');

    const left = OD.getDetectionWithPosition({ ...personRect, bbox: [0.02, 0.05, 0.20, 0.95] }, VIDEO_W, VIDEO_H);
    check('object on the left -> "left"', left.position, 'left');

    const right = OD.getDetectionWithPosition({ ...personRect, bbox: [0.78, 0.05, 0.20, 0.95] }, VIDEO_W, VIDEO_H);
    check('object on the right -> "right"', right.position, 'right');
}

console.log('\n2. Distance is computed in pixels and lands in a usable range');
{
    const d = OD.getDetectionWithPosition(personRect, VIDEO_W, VIDEO_H);
    const est = DE.estimateDistance(d, VIDEO_W);

    console.log('         width=' + d.widthPixels.toFixed(1) + 'px  -> ' +
                (est.distance === null ? 'Unknown' : est.distance + 'm') +
                ' (' + est.method + ', uncertainty=' + est.uncertainty + ')');

    check('estimate produced', est !== null, true);
    check('distance is finite and plausible (0.5 - 10m)',
        est.distance > 0.5 && est.distance < 10, true);
    check('not the old bogus ~1200m result', est.distance < 50, true);
}

console.log('\n3. Distance categories actually reach the alert bands');
{
    // Simulate a person walking closer: bounding box grows each step.
    const widths = [0.05, 0.12, 0.30, 0.55];
    const cats = widths.map(w => {
        const det = OD.getDetectionWithPosition({ class: 'person', score: 0.9, bbox: [(0.5 - w / 2), 0.05, w, 0.9] }, VIDEO_W, VIDEO_H);
        const est = DE.estimateDistance(det, VIDEO_W);
        return DE.getDistanceCategory(est);
    });
    console.log('         as the box grows: ' + cats.join(' -> '));
    check('produces at least one immediate/close hit',
        cats.some(c => c === 'immediate' || c === 'close'), true);
}

console.log('\n4. Alerts escalate instead of repeating');
{
    OR.resetCooldowns();
    spoken.length = 0;

    const det = OD.getDetectionWithPosition({ class: 'person', score: 0.9, bbox: [0.35, 0.05, 0.55, 0.95] }, VIDEO_W, VIDEO_H);
    const est = DE.estimateDistance(det, VIDEO_W);
    const risk = OR.assessRisk(det, est);
    console.log('         risk: ' + risk.level + ' / "' + risk.message + '"');

    OR.triggerAlert(risk);
    OR.triggerAlert(risk);   // same state again — must be silent
    OR.triggerAlert(risk);
    check('repeated identical state speaks once', spoken.length, 1);

    spoken.length = 0;
    // Something further away must NOT be announced.
    const far = OD.getDetectionWithPosition({ class: 'person', score: 0.9, bbox: [0.45, 0.05, 0.03, 0.06] }, VIDEO_W, VIDEO_H);
    const farRisk = OR.assessRisk(far, DE.estimateDistance(far, VIDEO_W));
    OR.triggerAlert(farRisk);
    check('receding object is silent', spoken.length, 0);

    OR.resetCooldowns();
    spoken.length = 0;
    // A wall filling the frame must be critical and must interrupt.
    const wall = OD.getDetectionWithPosition(
        { class: 'wall', score: 0.8, bbox: [0, 0, 1, 0.9], orientation: 'vertical' }, VIDEO_W, VIDEO_H);
    const wallRisk = OR.assessRisk(wall, DE.estimateDistance(wall, VIDEO_W));
    OR.triggerAlert(wallRisk);
    check('close wall is critical', wallRisk.level, 'critical');
    check('critical wall speaks', spoken.length, 1);
    check('critical priority used', spoken[0].prio, 'critical');
}

console.log('\n5. No class reports a false distance');
{
    // "tv" is in the relevant set but has no known width — must be Unknown,
    // not a fabricated number.
    const tv = OD.getDetectionWithPosition({ class: 'tv', score: 0.9, bbox: [0.3, 0.2, 0.4, 0.3] }, VIDEO_W, VIDEO_H);
    const est = DE.estimateDistance(tv, VIDEO_W);
    check('unknown class -> null', est, null);
    check('formats as Unknown', DE.formatDistance(est), 'Unknown');
    check('category is unknown', DE.getDistanceCategory(est), 'unknown');
}

console.log('\n6. Emergency no longer fires on the word "exit"');
{
    const P = window.VoiceAssistantService.parseCommand.bind(window.VoiceAssistantService);
    check('"where is the exit" -> navigate',
        P('where is the exit').action, 'navigate');
    check('"go to the cafeteria" -> navigate',
        P('go to the cafeteria').action, 'navigate');
    check('"help" alone -> emergency',
        P('help').action, 'emergency');
    check('"emergency" -> emergency',
        P('emergency').action, 'emergency');
    check('"stop navigation" -> stop',
        P('stop navigation').action, 'stop_navigation');
}

console.log('\n' + (fail === 0
    ? 'All ' + pass + ' checks passed.'
    : pass + ' passed, ' + fail + ' FAILED.') + '\n');
process.exit(fail === 0 ? 0 : 1);