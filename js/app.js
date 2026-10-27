/* GIGO – wires the annotator, evaluator, simulator and feedback together. */
(function (G) {
  'use strict';
  function $(id) { return document.getElementById(id); }

  var boxAnnot = new G.Annotator($('annot-canvas')), textAnnot = new G.TextLabeler($('label-list')), annot = boxAnnot;
  var cv = $('sim-canvas');
  var views = { SimView: new G.SimView(cv), PPEView: new G.PPEView(cv), DroneView: new G.DroneView(cv), CropView: new G.CropView(cv), LLMView: new G.LLMView($('chat')) };
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
    $('hint').textContent = G.SCENARIO.kind === 'text' ? 'Tap a button to label; tap again to clear.'
      : sel ? 'Drag to move, handles to resize, Delete to remove.' : 'Pick a class, then drag a box around an object.';
  }

  /* ---- live progress (objects that have a box on them) */
  function evaluate() { return (G.SCENARIO.evaluate || G.evaluate)(annot.getBoxes(), G.GROUND_TRUTH); }
  function updateProgress() {
    var e = evaluate();
    $('progress-count').textContent = e.located + ' / ' + e.total;
    $('progress-fill').style.transform = 'scaleX(' + (e.located / e.total) + ')';
    $('progress-boxes').textContent = G.SCENARIO.kind === 'text' ? '' : e.boxCount + (e.boxCount === 1 ? ' box drawn' : ' boxes drawn');
  }
  [boxAnnot, textAnnot].forEach(function (a) {
    a.on('change', function () {
      if (a !== annot) return;
      updateProgress();
      if (phase === 'done') { setStep(4); }
      else if (phase === 'annotate') setStep(0);
    });
    a.on('select', function () { if (a === annot) syncClassBar(); });
  });

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
    ev = evaluate();
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

  /* ---- scene setup: play.html?scene=<id> picks the scenario (classes, ground truth, sim, view, page text) */
  function applyScenario(id) {
    var sc = G.useScenario(id), text = sc.kind === 'text';
    S = G[sc.sim];
    Object.keys(views).forEach(function (k) { if (views[k].setActive) views[k].setActive(k === sc.view); });
    view = views[sc.view];
    if (sc.has3d) view.setMode(mode3d);
    annot = text ? textAnnot : boxAnnot;
    $('view-seg').hidden = !sc.has3d;
    speed = text ? 1 : 0.5; $('btn-speed').textContent = speed + '×';
    ['annot-stage', 'class-bar', 'btn-delete', 'btn-labels', 'sim-canvas', 'legend'].forEach(function (n) { $(n).hidden = text; });
    $('label-list').hidden = !text; $('chat').hidden = !text;
    $('progress-label').textContent = text ? 'Answers labelled' : 'Objects labelled';
    $('scene-title').textContent = sc.card.title;
    $('task').textContent = sc.task;
    document.title = sc.card.title + ' – GIGO';
    $('sim-title').textContent = sc.simTitle;
    $('sim-idle').innerHTML = sc.idle;
    $('drive-title').textContent = sc.resultTitle;
    $('drive-empty').textContent = sc.resultEmpty;
    if (!text) {
      $('annot-canvas').setAttribute('aria-label', sc.annotLabel);
      $('sim-canvas').setAttribute('aria-label', sc.has3d && mode3d === '3d' ? 'Chase-camera driving simulation' : sc.simLabel);
    }
    document.querySelectorAll('.disclaimer-text').forEach(function (n) { n.textContent = G.MESSAGES.disclaimer; });
    buildClassBar();
    annot.reset();
    startOver();
    syncClassBar();
  }
  $('btn-key').disabled = true;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.ctrlKey && phase !== 'running') run();
  });

  $('core-message').textContent = G.MESSAGES.core;
  var want = (/[?&]scene=([a-z0-9]+)/.exec(location.search) || [])[1];
  applyScenario(G.SCENARIOS[want] ? want : 'road');
  window.GIGO_APP = { annot: annot, run: run, applyScenario: applyScenario, getSim: function () { return sim; } };
})(window.GIGO);
