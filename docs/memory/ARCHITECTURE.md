---
coverage: lazy
layout: single
verified: 037638e
files:
ignore:
---

# Architecture

## Stack
- Vanilla HTML/CSS/JS, no deps, no build; classic <script> tags (file:// safe), namespace window.GIGO

## Commands
- Run: open index.html (Overview); simulator is play.html?scene=road|warehouse|drone|crop|llm
- Test: node tests/run.js (verified)

## Areas
### GIGO app
Annotate 10 fixed objects (left), rule-based top-down drive sim (right), feedback cards below.
Pages: index.html (overview), projects.html (gallery, js/gallery.js), learn.html, play.html (simulator); js/nav.js injects the top nav. css/site.css = site pages + text-label/chat UI.
Scenes added 2026-10-27: drone.js/drone-sim.js/drone-view.js, crop.js/crop-sim.js/crop-view.js, llm.js/llm-sim.js/llm-view.js; view-kit.js = shared canvas helpers + G.makeView.
Files: js/config.js (road ground truth, thresholds, wording, G.SCENARIOS + G.useScenario), js/warehouse.js (warehouse PPE scenario: classes, GT, art, G.drawWorker), js/ppe-sim.js + js/ppe-view.js (safety-gate sim core/renderer), js/evaluator.js (IoU, score, buildDetections), js/simulator.js (pure sim core, params P), js/sim-view.js, js/sim-3d.js (3D chase-cam renderer), js/scene.js, js/annotator.js, js/feedback.js, js/app.js, tests/run.js.
Gotchas: GT boxes must not overlap (matching); critical objects = car_ahead, ped_cross, cyclist, traffic_light; sim tuned so loose box => near miss, missing => collision.

## How modules connect

## Cross-cutting decisions

## Conventions
- 2026-10-23: Visual polish pass. scene.js art stays inside GT boxes (seeded RNG, deterministic). sim-view.js keeps per-run view state (lock-on timing, skid marks, outcome-card animation) and honours prefers-reduced-motion. Design context lives in PRODUCT.md. Annotator has zoom/pan (+/-/0, Ctrl+wheel, Space-drag).
- 2026-10-23: 2D/3D view toggle. sim-3d.js is a canvas-2D perspective renderer (no WebGL); SimView.setMode('2d'|'3d') swaps only the world layer, HUD/toasts/outcome card and detection boxes are shared (3D boxes = projected actor cuboids). Actors behind the ego's rear are culled in 3D. Sim speed defaults to 0.5x; Pause button during runs.
- 2026-10-23: Scene switcher (Road | Warehouse PPE). G.useScenario(id) swaps G.CLASSES/GROUND_TRUTH/MESSAGES.outcomes; each scenario names its sim core + view (G[sc.sim], views[sc.view]) and owns page text, stat chips and feedback wording. Warehouse GT boxes are derived from worker geometry (wGeom), so PPE boxes sit inside Person boxes (IoU < 0.4, matching unaffected). Persons are critical: missed = walks into zone unchecked (incident if missing PPE), loose = caught inside zone (near miss); unlabelled worn PPE = false alarm.
- 2026-10-27: Multi-page site (GitHub Pages safe: relative paths, .nojekyll). Scene chosen by ?scene= in play.html; no in-page switcher. Every scenario reuses outcome keys safe/warnings/near_miss/collision so feedback.js ranks them; it carries card{issue,title,place,blurb,tags}, task, outcomeLabel. LLM scene sets kind:'text' + evaluate:G.evaluateLabels (same shape as G.evaluate); app.js swaps G.Annotator for G.TextLabeler and the canvas for #chat. CSS gotcha: `.band` is the score chip in styles.css, so site sections use `.sect`.
- 2026-10-27: Overview hero is a slideshow (js/hero.js, G.initHero): one live-drawn canvas per scene, 2 s interval, pauses on hover/focus, no autoplay under prefers-reduced-motion. Road slide keeps hand-picked objects; other box scenes pick critical objects and a non-overlapping loose box.
- 2026-10-27: Branding: datamaker logo (assets/logo.png) in shared nav, favicon assets/favicon.png on every page. New pages must add the <link rel="icon"> lines.
- 2026-10-27: play.html panels are equal width (1fr 1fr); sim stage flex-fills its panel on a dark backdrop with the 800x330 canvas centred, so both stages and bottom toolbars line up.
- 2026-10-27: Answer key draws each GT box in its class colour with a class tag under it (keyLabels in annotator.js: biggest boxes first, smaller ones step aside so nested PPE tags don't overlap).
- 2026-10-28: Sim canvas is now 800x500 (no dark bars). Views keep the 330-tall logical world and translate by (H-330)/2, extending scenery; drone census is a bottom strip over a full-bleed map, crop rows stretch to H. Legend sits above the sim stage (aligned with the class bar); stage is flex:none, aspect 800/500.
- 2026-10-28: play.html panels use CSS subgrid (4 rows: head, class-bar/legend, stage, .panel-foot) so the label and sim stages align horizontally; stacked layout (<=1000px) falls back to flex.
- 2026-10-28: LLM test appends one unseen 'related' question per item (fresh msgs); approved wrong labels leak into them (stats.spread). #label-list sits in the stage grid row; chat is absolutely positioned in the sim stage.
