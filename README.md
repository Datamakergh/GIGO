# GIGO – Train the AI, Drive the Car

An interactive browser demo for the SYNAPSE AI Data Annotation Training Programme. Trainees box 10 objects in a road scene, then watch a simulated self-driving car behave according to the quality of their annotations: **Garbage In, Garbage Out**.

> Educational simulation. The driving outcome is produced by simple rules from the annotation evaluation. There is no AI model, no inference and no measured safety result.

## Run it
Double-click `index.html` (Chrome, Edge or Firefox). No server, build step, network or GPU needed. Tests (optional): `node tests/run.js`.

## How a trainee uses it
1. Pick a class (buttons or keys 1–5) and drag on the scene to draw a box. Click a box to select it: drag to move, drag the handles to resize, press Delete to remove, pick another class to relabel.
2. Press **Run Simulation**. Incomplete or sloppy work is allowed on purpose.
3. Watch the drive, read the feedback, click **Correct my annotations**, run again and compare in "Before and after". "Show answer key" appears after the first run.

## Files
| File | Role |
|---|---|
| `js/config.js` | Classes, thresholds, the 10 ground-truth objects, simulation placement, wording |
| `js/scene.js` | Draws the road scene in code (no image files) |
| `js/annotator.js` | Bounding-box tool |
| `js/evaluator.js` | IoU, matching, verdicts, score (pure functions) |
| `js/simulator.js` | Driving rules and state machine (pure, no drawing) |
| `js/sim-view.js` | Draws the simulation |
| `js/feedback.js`, `js/app.js` | Results panel and wiring |
| `tests/run.js` | Node checks for the evaluator and simulation |

Scripts are plain `<script>` tags (not ES modules) so the page works from `file://`.

## Scoring logic (`js/evaluator.js`)
- **Matching:** each ground-truth object is paired with the user box that overlaps it most (IoU ≥ 0.50), one box per object, highest IoU first.
- **Per-object verdict**
  - `good`: IoU ≥ 0.75 and right class
  - `poorBox`: 0.50 ≤ IoU < 0.75 and right class (loose)
  - `wrongClass`: located but labelled wrongly
  - `missing`: no box with IoU ≥ 0.50
- **Extra boxes:** `duplicate` (another box on an already-matched object, −3 points each) or `spurious` (a box on nothing, −4 each).
- **Credit per object:** 0 if missing; otherwise 0.5 at IoU 0.50 rising linearly to 1.0 at IoU 0.80; ×0.4 if the class is wrong.
- **Score** = sum of credits ÷ 10 × 100 − penalties, clamped to 0–100. Ten wrong boxes score 0, not 100.
- **Bands:** Excellent ≥ 90, Good ≥ 70, Partial ≥ 40, Poor < 40.

## Simulation logic (`js/simulator.js`)
`buildDetections` converts verdicts into what the simulated AI "sees": `good` → detected early, `poorBox` → detected late and weakly, `missing`/`wrongClass` → not detected.

Four objects are safety-critical and change the drive:

| Object | Detected | Detected late (loose box) | Not detected |
|---|---|---|---|
| Cyclist crossing, pedestrian on crosswalk, braking car ahead | Brakes smoothly and waits | Reacts late, brakes hard, near miss | No reaction, collision |
| Red traffic light | Stops at the line | Late stop | Runs the red light |

The other six objects (signs, parked car, oncoming car, two pavement pedestrians) never cause a crash. If missed they raise a warning during the drive. Outcome = Collision, Near miss, Completed with warnings or Completed safely. The run is deterministic, so reruns are comparable. A collision ends the run, and objects not yet reached are marked in the feedback.

Tuning knobs (speeds, brake force, detection ranges, near-miss gap) are in `P` at the top of `simulator.js`.

## Modify it
- **Different scene or objects:** edit `G.GROUND_TRUTH` in `config.js` (box, class, art, sim placement, warning text). Keep boxes non-overlapping so matching stays unambiguous.
- **Stricter or looser scoring:** edit `G.THRESHOLDS`.
- **Real detector later:** produce the same `{id: {mode: 'good'|'late'|'missed', conf, label}}` map as `G.buildDetections` returns and pass it to `G.Sim.create`. Nothing else changes.

## Open-source components and licences
None. The app has no third-party libraries, fonts, images or build tools; all art is drawn in code. The project's own licence is yours to choose.
