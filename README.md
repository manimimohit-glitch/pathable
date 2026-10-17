# PathAble — Smart Indoor Navigation for Blind & Visually Impaired Users

Voice-first indoor navigation with real-time obstacle detection, powered by
on-device AI. No guessing — the app reports uncertainty honestly rather than
inventing confident answers.

## Try it

**https://manimimohit-glitch.github.io/pathable/**

Open that link on any phone. It runs entirely in the browser — nothing to
install, no account, no server.

The camera needs an **HTTPS** address, which is what the link above is. Open
it, then tap **Obstacle Detection** and allow camera access when your phone
asks. On a phone, use your browser's **Add to Home Screen** to get an app icon
for it.

Everything runs on the device. No video or images are uploaded anywhere.

## Features

**Navigation**
- A* pathfinding with three route modes: shortest, safest, accessible
- Turn-by-turn voice instructions (straight, turn, bear, U-turn, elevator, stairs)
- Automatic off-route detection with confirmation frames to avoid false alarms
- Automatic re-routing when you stray from the planned path

**Emergency**
- One-tap nearest-exit navigation
- Forces accessible routing regardless of your normal preference
- Priority voice alerts that interrupt everything else

**Obstacle detection — three layers**

| Layer | Method | Detects |
|---|---|---|
| 1 | TensorFlow.js + COCO-SSD | 25 indoor-relevant classes: person, chair, bench, table, door, couch… |
| 2 | Sobel edge analysis | Walls, with orientation and side |
| 3 | Horizontal line pattern analysis | Stairs, with direction (up/down) and step count |

Every layer uses temporal smoothing (3-of-5 frame confirmation) and non-maximum
suppression, so a single noisy frame never triggers a false alarm. The confirmed
set — not the raw per-frame set — is what reaches the user.

**Distance estimation**
Monocular distance from known object dimensions + camera geometry, computed in
pixels from the normalized bounding box. Each estimate carries an explicit
uncertainty label — `low`, `medium`, or `high` — and objects with no reliable
basis report **"Unknown"** instead of a made-up number. Walls and stairs use a
coarse apparent-size proxy and always report `medium` or higher.

**Voice**
- Speech-to-text command parsing: "navigate to room 205", "where is the
  cafeteria", "stop navigation", "emergency", "repeat"
- Text-to-speech with adjustable speed, volume, and language
- Priority-based alerts — only a `critical` warning interrupts speech in
  progress; everything else queues and plays in order
- Voice is matched to the selected language rather than falling back to the
  system default, which may be a different language entirely

**Voice design — why it isn't chatty**

A blind user walking with this in their hand turns the volume down within
seconds of constant narration, so alerts are deliberately asymmetric:

- **Escalate-only.** A thing that gets closer is announced; a thing receding
  is not. Good news doesn't need speaking.
- **Deduplicated by screen region.** "New object on my left" is a different
  event from "the same object, still there".
- **`info` is silent by default.** Distant objects appear on screen but are not
  spoken. *Settings → Speak distant objects* turns that narration on.
- **Never repeats a state.** Each risk level is announced once, not on a timer.
- **Deduplication resets** when detection stops, so a fresh session re-announces.

## Testing

```bash
node test-harness.js
```

Runs the detection → distance → risk → speech pipeline headlessly, with no
browser or camera. Covers position resolution, distance plausibility, the
alert-band thresholds, escalation-only alerting, unknown-class honesty, and
command parsing. 20 checks.

**Accessibility**
- Dark, light, and high-contrast themes
- Large-text mode
- 56px minimum touch targets
- Vibration patterns graded by risk level
- Full ARIA labelling and screen-reader support
- Respects `prefers-reduced-motion`

## Running locally

The camera requires a secure context — `localhost` or HTTPS. Opening
`index.html` directly via `file://` will block camera access.

```bash
cd smart-nav
python -m http.server 8080
```

Then open <http://localhost:8080>.

## Running on your phone

Browsers only grant camera access over HTTPS, so `localhost` on your computer
is not enough for a phone. Either:

1. **GitHub Pages** — enable Pages for this repo and open the `https://`
   URL on your phone (easiest), or
2. **Local network** — run the server bound to `0.0.0.0` and reach it at
   `http://<your-computer-ip>:8080`. Note this is plain HTTP, so the camera
   will be blocked on most phones.

## Project structure

```
smart-nav/
├── index.html              All screens
├── css/styles.css          Design system + accessibility themes
└── js/
    ├── app.js              Main controller (window.PathAble)
    └── services/
        ├── BuildingMapService.js        Buildings, locations, connections, beacons
        ├── VoiceAssistantService.js      TTS, STT, command parsing
        ├── IndoorPositioningService.js   Pluggable providers (simulated default)
        ├── RoutePlanningService.js       A* with mode-dependent costs
        ├── NavigationInstructionService.js  Turn-by-turn instruction generation
        ├── ReroutingService.js           Off-route detection
        ├── EmergencyNavigationService.js Nearest-exit routing
        ├── ObjectDetectionService.js     COCO-SSD + wall + stair detection
        ├── DistanceEstimationService.js  Monocular distance with uncertainty
        ├── ObstacleRiskService.js        Risk classification and alerts
        └── AdminService.js              Full CRUD over map data
```

Also at the project root: `test-harness.js`, the headless pipeline test
described under [Testing](#testing).

## Notes on accuracy

Positioning is **simulated** by default and the UI shows a `SIMULATED` badge so
it is never mistaken for real positioning. Swap in a real provider by
implementing the provider interface and calling `setProvider()`.

The wall and stair detectors are classical computer vision, not neural networks.
They are tuned for indoor lighting and will be less reliable in low light or
heavy visual clutter. Distance estimates for them are coarse — the uncertainty
label reflects that.