# Handoff
- Updated: 2026-10-28 at 037638e (dirty: 17 uncommitted file(s))

## Current task
Simulator page polish: label/sim panels aligned (all scenes incl. LLM), header subheading removed, LLM scene gets "unseen questions" test. Tests pass; nothing committed; awaiting user review in a real browser.

## Done
- Pages: index.html, projects.html, learn.html, play.html (?scene=road|warehouse|drone|crop|llm). Shared nav js/nav.js; cards js/gallery.js; css/site.css; hero js/hero.js.
- play.html panels: CSS subgrid (css/styles.css, 4 rows: head, class-bar/legend, stage, .panel-foot) so label and sim stages align horizontally. Stacked layout (<=1000px) falls back to flex. LLM: #label-list is a direct panel child in the stage row (contain: size, scrolls), chat is absolute inset 0 in the sim stage.
- Removed the `#task` subheading under the project title (play.html + app.js). `sc.task` field still exists in scenario files, unused.
- app.js sets #sim-hint per scene kind (text vs boxes).
- LLM scene (js/llm.js, llm-sim.js, llm-view.js): each item has `related` (an unseen question, not labelled by the user); sim asks them after the 10, bad labels leak (stats.spread, "Spread to new questions" chip), msgs flagged `fresh`, view tags "New question". Test added in tests/run.js.
- Sim canvas 800x500; views translate the 330-tall world by (H-330)/2.

## Next
1. User reviews in a browser; commit when asked (index.html -> play.html rename staged, rest unstaged incl. assets/).
2. Check LLM end-of-run result cards/feedback wording with the 20 messages (not screenshot-verified), road 3D view, narrow stacked layout.
3. Optional: LLM third label "Unsure" + ambiguous items; remove dead setStep in app.js and unused `task` fields.

## Don't forget
- `.band` in styles.css is the score chip; site sections use `.sect`.
- All scenarios reuse outcome keys safe/warnings/near_miss/collision.
- Headless Chrome min window 500px. Run-state screenshots: temp copy of play.html with a script clicking #btn-run (delete after).
- macOS sed needs `-i ''`.

## Modules touched
GIGO app: play.html, css/styles.css, js/app.js, js/llm.js, js/llm-sim.js, js/llm-view.js, tests/run.js
