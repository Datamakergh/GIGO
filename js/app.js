/* GIGO – wires the annotator, evaluator, simulator and feedback together. */
(function (G) {
  'use strict';
  function $(id) { return document.getElementById(id); }

  var annot = new G.Annotator($('annot-canvas'));
  var views = { SimView: new G.SimView($('sim-canvas')), PPEView: new G.PPEView($('sim-canvas')) };
  var view = views.SimView, S = G.Sim, mode3d = '2d';
  var STEP = 1 / 60, MAX_SKIP = 60 * 160;
  var phase = 'annotate';          // annotate | running | done
  var sim = null, det = {}, ev = null, raf = 0, last = 0, acc = 0, speed = 0.5, paused = false, history = [];
  var STEPS = ['Annotate', 'Evaluate', 'Simulate', 'Observe', 'Correct', 'Improve'];

  function setStep(i) {
    var items = document.querySelectorAll('#stepper li');
    for (var k = 0; k < items.length; k++) {
      items[k].classList.toggle('active', k === i);
      items[k].classList.toggle('done', k < i);
    }
  }

  /* ---- class bar */
  var bar = $('class-bar');
  function buildClassBar() {
    while (bar.firstChild) bar.removeChild(bar.firstChild);
    G.CLASSES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cls'; b.dataset.cls = c.id;
      b.style.setProperty('--c', c.color);
      b.innerHTML = '<i></i><span></span><kbd>' + c.key + '</kbd>';
      b.querySelector('span').textContent = c.id;
      b.addEventListener('click', function () { annot.setClass(c.id); });
      bar.appendChild(b);
    });
  }
  function syncClassBar() {
    var sel = annot.getSelected(), cur = sel ? sel.cls : annot.getClass();
    Array.prototype.forEach.call(bar.children, function (b) { b.classList.toggle('on', b.dataset.cls === cur); });
    $('btn-delete').disabled = !sel || phase === 'running';
    $('hint').textContent = sel ? 'Selected: drag to move, drag handles to resize, press Delete to remove. Pick a class to relabel.'
      : 'Choose a class, then drag on the scene to draw a box around an object.';
  }

  /* ---- live progress (objects that have a box on them) */
  function updateProgress() {
    var e = G.evaluate(annot.getBoxes(), G.GROUND_TRUTH);
    $('progress-count').textContent = e.located + ' / ' + e.total;
    $('progress-fill').style.transform = 'scaleX(' + (e.located / e.total) + ')';
    $('progress-boxes').textContent = e.boxCount + (e.boxCount === 1 ? ' box drawn' : ' boxes drawn');
  }
  annot.on('change', function () {
    updateProgress();
    if (phase === 'done') { setStep(4); }
    else if (phase === 'annotate') setStep(0);
  });
  annot.on('select', syncClassBar);

  /* ---- simulation loop */
  function showIdle(show) { $('sim-overlay').hidden = !show; }
  function preview() {
    sim = S.create({}); det = {};
    view.draw(sim, det);
  }

  function setPaused(on) {
    paused = on;
    var b = $('btn-pause');
    b.textContent = on ? '▶ Resume' : '❚❚ Pause';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function frame(ts) {
    if (phase !== 'running' || paused) return;
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    acc += dt * speed;
    while (acc >= STEP && !sim.done) { S.step(sim, STEP); acc -= STEP; }
    view.draw(sim, det);
    if (sim.done) { finishRun(); return; }
    raf = requestAnimationFrame(frame);
  }

  function setRunning(on) {
    $('btn-run').disabled = on;
    $('btn-skip').hidden = !on;
    $('btn-pause').hidden = !on;
    if (!on) setPaused(false);
    annot.setLocked(on);
    syncClassBar();
  }

  function run() {
    if (phase === 'running') return;
    ev = G.evaluate(annot.getBoxes(), G.GROUND_TRUTH);
    det = G.buildDetections(ev);
    sim = S.create(det);
    G.Feedback.showScore(ev, { onLocate: locate });
    setStep(1);
    showIdle(false);
    phase = 'running'; setRunning(true);
    $('btn-run').textContent = '▶ Running…';
    acc = 0; last = performance.now();
    setTimeout(function () { if (phase === 'running') setStep(2); }, 500);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    $('panel-sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function skip() {
    if (phase !== 'running') return;
    var n = 0;
    while (!sim.done && n++ < MAX_SKIP) S.step(sim, STEP);
    view.draw(sim, det);
    cancelAnimationFrame(raf); finishRun();
  }

  function finishRun() {
    phase = 'done';
    history.push(G.Feedback.record(ev, sim));
    G.Feedback.showDrive(ev, sim, history, { onLocate: locate });
    setRunning(false);
    $('btn-run').textContent = '↻ Run Simulation again';
    $('btn-key').disabled = false;
    var improved = history.length > 1 && history[history.length - 1].score > history[history.length - 2].score;
    setStep(improved ? 5 : 3);
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function locate(id) {
    annot.setShowKey(false); $('btn-key').setAttribute('aria-pressed', 'false');
    $('panel-annotate').scrollIntoView({ behavior: 'smooth', block: 'center' });
    annot.flashGT(id);
  }

  /* ---- controls */
  $('btn-run').addEventListener('click', run);
  $('btn-skip').addEventListener('click', skip);
  $('btn-pause').addEventListener('click', function () {
    if (phase !== 'running') return;
    setPaused(!paused);
    if (!paused) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  });
  $('btn-delete').addEventListener('click', function () { annot.deleteSelected(); });
  $('btn-clear').addEventListener('click', function () {
    if (annot.getBoxes().length && confirm('Remove all of your boxes?')) annot.clear();
  });
  $('btn-labels').addEventListener('click', function () {
    var hide = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', hide ? 'true' : 'false'); this.textContent = hide ? 'Show labels' : 'Hide labels';
    annot.setShowLabels(!hide);
  });
  $('btn-key').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', on ? 'true' : 'false'); annot.setShowKey(on);
  });
  $('btn-speed').addEventListener('click', function () {
    speed = speed === 0.5 ? 1 : speed === 1 ? 2 : speed === 2 ? 4 : 0.5;
    this.textContent = speed + '×';
  });
  ['2d', '3d'].forEach(function (m) {
    $('btn-view-' + m).addEventListener('click', function () {
      $('btn-view-2d').setAttribute('aria-pressed', m === '2d' ? 'true' : 'false');
      $('btn-view-3d').setAttribute('aria-pressed', m === '3d' ? 'true' : 'false');
      $('sim-canvas').setAttribute('aria-label', m === '3d' ? 'Chase-camera driving simulation' : 'Top-down driving simulation');
      mode3d = m; view.setMode(m);
    });
  });
  $('btn-reset-sim').addEventListener('click', function () {
    cancelAnimationFrame(raf);
    phase = history.length ? 'done' : 'annotate';
    setRunning(false);
    preview(); showIdle(true);
    $('btn-run').textContent = history.length ? '↻ Run Simulation again' : '▶ Run Simulation';
    setStep(history.length ? 4 : 0);
  });
  $('btn-correct').addEventListener('click', function () {
    cancelAnimationFrame(raf);
    phase = 'done'; setRunning(false); preview(); showIdle(true);
    setStep(4);
    $('panel-annotate').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function startOver() {
    cancelAnimationFrame(raf);
    history = []; annot.setShowKey(false); $('btn-key').setAttribute('aria-pressed', 'false'); $('btn-key').disabled = true;
    annot.clear(); G.Feedback.reset();
    phase = 'annotate'; setRunning(false); preview(); showIdle(true);
    $('btn-run').textContent = '▶ Run Simulation'; setStep(0);
  }
  $('btn-startover').addEventListener('click', function () {
    if (!confirm('Start over? This removes your boxes and the run history.')) return;
    startOver();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---- scene switcher: swaps classes, ground truth, simulation and page text */
  function applyScenario(id) {
    var sc = G.useScenario(id);
    Object.keys(G.SCENARIOS).forEach(function (k) { $('btn-scene-' + k).setAttribute('aria-pressed', k === id ? 'true' : 'false'); });
    S = G[sc.sim];
    if (views.PPEView.setActive) views.PPEView.setActive(sc.view === 'PPEView');
    view = views[sc.view];
    if (sc.has3d) view.setMode(mode3d);
    $('view-seg').hidden = !sc.has3d;
    $('tagline').textContent = sc.tagline;
    document.title = 'GIGO – ' + sc.tagline;
    $('garbage-out').textContent = sc.garbageOut;
    $('intro-text').innerHTML = sc.intro;
    $('sim-title').textContent = sc.simTitle;
    $('sim-idle').innerHTML = sc.idle;
    $('drive-title').textContent = sc.resultTitle;
    $('drive-empty').textContent = sc.resultEmpty;
    $('annot-canvas').setAttribute('aria-label', sc.annotLabel);
    $('sim-canvas').setAttribute('aria-label', sc.has3d && mode3d === '3d' ? 'Chase-camera driving simulation' : sc.simLabel);
    document.querySelectorAll('.disclaimer-text').forEach(function (n) { n.textContent = G.MESSAGES.disclaimer; });
    buildClassBar();
    annot.reset();
    startOver();
    syncClassBar();
  }
  Object.keys(G.SCENARIOS).forEach(function (k) {
    $('btn-scene-' + k).addEventListener('click', function () {
      if (G.SCENARIO.id === k || phase === 'running' && !confirm('Stop this run and switch scene?')) return;
      if (phase !== 'running' && (annot.getBoxes().length || history.length) && !confirm('Switch scene? This removes your boxes and the run history.')) return;
      applyScenario(k);
    });
  });
  $('btn-key').disabled = true;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.ctrlKey && phase !== 'running') run();
  });

  $('core-message').textContent = G.MESSAGES.core;
  applyScenario('road');
  window.GIGO_APP = { annot: annot, run: run, applyScenario: applyScenario, getSim: function () { return sim; } };
})(window.GIGO);
