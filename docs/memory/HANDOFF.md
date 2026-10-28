# Handoff
- Updated: 2026-10-28 at adfe3ec (dirty: 13 uncommitted file(s))

## Current task
LLM scene reworked into multiple-choice labelling + a live keyword chatbot test. Built and tested (node tests/run.js passes); nothing committed; not yet checked visually in a browser.

## Done
- Labelling is multiple choice (js/llm.js): 4 options A-D per question, label = picked letter, g.cls = right letter, g.a = right text, g.bad = default wrong text. Unsafe items (q5, q9): every wrong option is harmful.
- Test is a live chat (js/llm-view.js input, "Try:" chips, Finish chat; js/llm-sim.js ask/finish/untried). G.matchTopic in js/llm.js maps words to a topic via per-item `keys` (every group needs one word, plural s stripped). Wrong pick -> repeats it with a tip + "Go to Q#" link; no match -> rephrase hint; unlabelled -> always "I'm not sure" (even health items).
- Results count each topic once; unasked topics show "Not asked" (js/feedback.js). Text scenes hide Pause/Skip/Speed; button reads Start chat (app.js runLabel).
- Removed the unseen "related" questions and stats.spread.
- Earlier, uncommitted: subgrid-aligned panels, 800x500 sim canvas, narrow-layout qa-list fix.
- tests/run.js: matcher and chat tests.

## Next
1. Review play.html?scene=llm in a browser: option cards, chat input/chips on the 500px stage, narrow layout (<=1000px), result cards after Finish chat. Commit when asked.
2. Possible: tune keywords (q8 "nobel prize" alone matches; q10 "light"+"earth" is broad).
3. Optional cleanup: dead setStep in app.js, unused `task` fields.

## Don't forget
- `.band` in styles.css is the score chip; site sections use `.sect`.
- All scenarios reuse outcome keys safe/warnings/near_miss/collision.
- Headless Chrome: use a temp copy of play.html with an injected script (click options, #btn-run, submit .chat-form), delete after.
- macOS sed needs `-i ''`.

## Modules touched
GIGO app: play.html, css/site.css, css/styles.css, js/app.js, js/llm.js, js/llm-sim.js, js/llm-view.js, js/feedback.js, js/gallery.js, js/hero.js, projects.html, tests/run.js
