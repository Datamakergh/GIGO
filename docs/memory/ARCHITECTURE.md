---
coverage: lazy
layout: single
verified: none
files:
ignore:
---

# Architecture

## Stack
- Vanilla HTML/CSS/JS, no deps, no build; classic <script> tags (file:// safe), namespace window.GIGO

## Commands
- Run: open index.html
- Test: node tests/run.js (verified)

## Areas
### GIGO app
Annotate 10 fixed objects (left), rule-based top-down drive sim (right), feedback cards below.
Files: js/config.js (road ground truth, thresholds, wording, G.SCENARIOS + G.useScenario), js/warehouse.js (warehouse PPE scenario: classes, GT, art, G.drawWorker), js/ppe-sim.js + js/ppe-view.js (safety-gate sim core/renderer), js/evaluator.js (IoU, score, buildDetections), js/simulator.js (pure sim core, params P), js/sim-view.js, js/sim-3d.js (3D chase-cam renderer), js/scene.js, js/annotator.js, js/feedback.js, js/app.js, tests/run.js.
Gotchas: GT boxes must not overlap (matching); critical objects = car_ahead, ped_cross, cyclist, traffic_light; sim tuned so loose box => near miss, missing => collision.

## How modules connect

## Cross-cutting decisions

## Conventions
- 2026-10-23: Visual polish pass. scene.js art stays inside GT boxes (seeded RNG, deterministic). sim-view.js keeps per-run view state (lock-on timing, skid marks, outcome-card animation) and honours prefers-reduced-motion. Design context lives in PRODUCT.md. Annotator has zoom/pan (+/-/0, Ctrl+wheel, Space-drag).
- 2026-10-23: 2D/3D view toggle. sim-3d.js is a canvas-2D perspective renderer (no WebGL); SimView.setMode('2d'|'3d') swaps only the world layer, HUD/toasts/outcome card and detection boxes are shared (3D boxes = projected actor cuboids). Actors behind the ego's rear are culled in 3D. Sim speed defaults to 0.5x; Pause button during runs.
- 2026-10-23: Scene switcher (Road | Warehouse PPE). G.useScenario(id) swaps G.CLASSES/GROUND_TRUTH/MESSAGES.outcomes; each scenario names its sim core + view (G[sc.sim], views[sc.view]) and owns page text, stat chips and feedback wording. Warehouse GT boxes are derived from worker geometry (wGeom), so PPE boxes sit inside Person boxes (IoU < 0.4, matching unaffected). Persons are critical: missed = walks into zone unchecked (incident if missing PPE), loose = caught inside zone (near miss); unlabelled worn PPE = false alarm.
