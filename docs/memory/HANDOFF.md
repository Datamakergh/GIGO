# Handoff
- Updated: 2026-10-27 at 339f887 (dirty: 28 uncommitted file(s))

## Current task
Multi-page site, 3 new scenes, hero slideshow and datamaker branding done and verified headless. Awaiting user review in a real browser; nothing committed.

## Done
- Pages: index.html (Overview), projects.html (gallery), learn.html, play.html (simulator, was index.html; ?scene=road|warehouse|drone|crop|llm). Shared nav js/nav.js; cards js/gallery.js; styles css/site.css. .nojekyll for GitHub Pages.
- Scenes: drone (drone*.js), crop (crop*.js), llm (llm*.js, DOM chat). js/view-kit.js shared canvas helpers + G.makeView.
- Hero slideshow: js/hero.js (G.initHero), 5 live-drawn slides, 2 s interval, dots + scene link, pauses on hover/focus, no autoplay under reduced motion. Float captions reworded generic (good/sloppy/no label).
- Branding: assets/logo.png in nav (js/nav.js, `.logo img` 28px, plus small "GIGO" `.logo-app`); assets/favicon.png linked as icon + apple-touch-icon in all 4 pages. Images came from user's paste (originals weren't in repo).
- Tests pass (node tests/run.js).

## Next
1. User reviews in a browser (slideshow speed, logo size, keep/drop "GIGO" next to logo).
2. Commit when asked (index.html -> play.html rename staged via git mv; rest unstaged, incl. new assets/).
3. Optional: mobile pass on play.html; tune drone/crop timings; pause button on slideshow.

## Don't forget
- `.band` in styles.css is the score chip; site sections use `.sect`.
- All scenarios reuse outcome keys safe/warnings/near_miss/collision.
- Headless Chrome min window is 500px: narrower screenshots look clipped but aren't.
- Hero float offsets (f2/f3 bottom) account for the dots row under the stage.

## Modules touched
GIGO app: site pages, js/hero.js, js/nav.js, css/site.css, assets/
