# GIGO – Garbage In, Garbage Out

An interactive browser demo for AI data-annotation training. Trainees label a scene, then watch a simulated AI act on their labels. Every missed, loose or wrong label shows up in the outcome.

> Educational simulation. Outcomes come from simple rules, not a real AI model, real inference or measured safety results.

## Run it
Double-click `index.html`, or serve the folder (`python3 -m http.server`). No build step, dependencies or network needed. Tests: `node tests/run.js`.

**GitHub Pages:** push the repo and enable Pages on the branch root. All paths are relative and `.nojekyll` is included, so it works as-is.

## Pages
| Page | What it is |
|---|---|
| `index.html` | Overview: hero, how it works, scene teaser |
| `projects.html` | Gallery of all scenes |
| `learn.html` | Scoring, scene summary, glossary |
| `play.html?scene=<id>` | The simulator (`road`, `warehouse`, `drone`, `crop`, `llm`) |

## Scenes
| Scene | Labels | Simulation | Critical items |
|---|---|---|---|
| Self-driving car (`road`) | 10 boxes, 5 classes | Car drives the street (2D/3D) | Lead car, pedestrian, cyclist, red light |
| Warehouse PPE (`warehouse`) | 12 boxes | AI safety gate checks workers | Workers |
| Drone census (`drone`), Maasai Mara | 12 boxes, 6 classes | Drone flies transects, live species tally, alerts | Lion near the boma, person setting snares |
| Maize scout (`crop`), Kenya | 10 leaves, 5 classes | 21-day field timelapse: treatment, spread, yield | Fall Armyworm, Lethal Necrosis |
| LLM answers (`llm`) | 10 answers, Correct/Wrong | Chatbot answers the same questions | Two unsafe health answers |

Across all scenes: good label = handled well, loose box = late, missing or wrong = not handled. Missing a critical item gives the worst outcome. In the LLM scene, approving a wrong answer makes the bot repeat it (hallucination or unsafe advice), rejecting a right one makes it invent an alternative, and leaving one unlabelled gives "I'm not sure".

## Files
| File | Role |
|---|---|
| `js/config.js` | Road scene data, thresholds, `G.SCENARIOS` + `G.useScenario` |
| `js/scene.js` | Road art; shared helpers (`roundRect`, `rng`, `getSceneCanvas`) |
| `js/warehouse.js`, `ppe-sim.js`, `ppe-view.js` | Warehouse scene, sim, renderer |
| `js/drone.js`, `drone-sim.js`, `drone-view.js` | Drone scene, sim, renderer |
| `js/crop.js`, `crop-sim.js`, `crop-view.js` | Maize scene, sim, renderer |
| `js/llm.js`, `llm-sim.js`, `llm-view.js` | LLM items, label evaluator + text labeller, chat sim + view |
| `js/view-kit.js` | Shared canvas helpers for the newer views |
| `js/annotator.js`, `evaluator.js` | Box tool; IoU, matching, score |
| `js/simulator.js`, `sim-view.js`, `sim-3d.js` | Road sim and renderers |
| `js/feedback.js`, `app.js` | Results cards and play-page wiring |
| `js/nav.js`, `gallery.js` | Site nav and scene cards |
| `css/styles.css`, `css/site.css` | Simulator styles; site pages and new components |
| `tests/run.js` | Node checks for every scene |

Scripts are plain `<script>` tags (not ES modules) so pages work from `file://`.

## Add a scene
Add a file that registers `G.SCENARIOS.<id>` with `classes`, `groundTruth`, `drawScene`, `card`, `outcomes` (keys `safe`, `warnings`, `near_miss`, `collision`), `stats`, `critical`, `minor`, `advice`, and the names of its `sim` and `view`. Then include it in `play.html` and `js/gallery.js`'s order list. Keep ground-truth boxes non-overlapping.

## Scoring logic (`js/evaluator.js`)
**In simple terms:** IoU (shown in the app as "fit") says how well your box sits on the object: 100% is exact, 0% is not touching. Under 30% the AI misses the object; 30–75% it sees it late or unsure and you score less; 75%+ it sees it reliably; 80%+ earns full points. Tighter boxes score higher.

- **Matching:** each ground-truth object is paired with the user box that overlaps it most (IoU ≥ 0.30), one box per object, highest IoU first.
- **Per-object verdict**
  - `good`: IoU ≥ 0.75 and right class
  - `poorBox`: 0.30 ≤ IoU < 0.75 and right class (loose)
  - `wrongClass`: located but labelled wrongly
  - `missing`: no box with IoU ≥ 0.30
- **Extra boxes:** `duplicate` (another box on an already-matched object, −3 points each) or `spurious` (a box on nothing, −4 each).
- **Credit per object:** 0 if missing; otherwise 0.3 at IoU 0.30 rising linearly to 1.0 at IoU 0.80; ×0.4 if the class is wrong.
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
- **Road objects:** edit `G.GROUND_TRUTH` in `config.js`. Keep boxes non-overlapping so matching stays unambiguous.
- **Stricter or looser scoring:** edit `G.THRESHOLDS`.
- **Real detector later:** produce the same `{id: {mode: 'good'|'late'|'missed', conf, label}}` map as `G.buildDetections` returns and pass it to `G.Sim.create`. Nothing else changes.
