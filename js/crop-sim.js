/* GIGO – maize field simulation core. Pure state machine (no DOM): drawn by crop-view.js.
 * A 7 x 4 field; the 10 annotated leaves are plants in it, the rest start healthy.
 * Day 0 the AI scout scans the field and treats what it diagnosed. Then three weekly ticks:
 *   critical disease untreated (missed / wrong label) -> spreads to its neighbours every week (outbreak)
 *   loose box (late)                                  -> treated a week late (critical: plant lost)
 *   other disease untreated or wrongly treated        -> that plant is lost
 *   healthy leaf unlabelled or labelled as a disease  -> sprayed for nothing (wasted) */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var P = { cols: 7, rows: 4, scanT: 3.5, weekT: 2.4, weeks: 3, endHold: 1 };

  function note(s, kind, text, id) { s.events.push({ t: s.t, kind: kind, text: text, id: id || null }); }

  function create(det) {
    det = det || {};
    var s = { t: 0, done: false, endAt: null, events: [], results: {}, outcome: null, summary: '', week: 0, scanX: 0,
      plants: [], stats: { outbreaks: 0, late: 0, lost: 0, wrongTx: 0, wasted: 0 } };
    for (var r = 0; r < P.rows; r++) for (var c = 0; c < P.cols; c++) s.plants.push({ c: c, r: r, status: 'healthy', disease: null, gt: null });
    G.GROUND_TRUTH.forEach(function (g) {
      var p = cell(s, g.cell[0], g.cell[1]), d = det[g.id] || { mode: 'missed' };
      p.gt = g; p.mode = d.mode; p.wrong = !!d.wrong; p.label = d.wrong ? d.label : d.mode === 'missed' ? null : g.cls;
      if (g.cls !== 'Healthy') { p.status = 'sick'; p.disease = g.cls; }
    });
    return s;
  }
  function cell(s, c, r) { return c < 0 || r < 0 || c >= P.cols || r >= P.rows ? null : s.plants[r * P.cols + c]; }

  // day 0: the scout reaches each annotated plant
  function scan(s, p) {
    var g = p.gt; p.scanned = true; p.scanAt = s.t;
    if (g.cls === 'Healthy') {
      if (p.mode === 'missed' && !p.wrong) { p.tag = 'Diseased?'; spray(s, p, 'missed_warning', 'Healthy plant sprayed: the AI never saw a healthy example.'); }
      else if (p.wrong) { p.tag = p.label; spray(s, p, 'wasted', 'Wasted spray: healthy plant treated for ' + p.label + '.'); }
      else { p.tag = 'Healthy'; s.results[g.id] = 'ok'; }
      return;
    }
    if (p.mode === 'good') { p.tag = g.cls; p.status = 'treated'; p.treatAt = s.t; s.results[g.id] = 'ok'; note(s, 'ok', 'Treated ' + g.cls.toLowerCase() + ' early.', g.id); }
    else if (p.mode === 'late') { p.tag = g.cls + '?'; p.lateTreat = true; }
    else if (p.wrong) {
      p.tag = p.label;
      if (p.label !== 'Healthy') { s.stats.wrongTx += 1; p.treatAt = s.t; p.wrongTx = true; }
      note(s, 'warn', g.cls + ' read as ' + p.label + (p.label === 'Healthy' ? ': not treated.' : ': wrong treatment.'), g.id);
    } else p.tag = null;
  }
  function spray(s, p, res, text) { s.stats.wasted += 1; s.results[p.gt.id] = res; p.sprayAt = s.t; note(s, 'warn', text, p.gt.id); }

  function weekTick(s) {
    s.week += 1;
    var spreaders = s.plants.filter(function (p) { return p.status === 'sick' && G.CROP_CRITICAL[p.disease] && !p.lateTreat; });
    spreaders.forEach(function (p) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var n = cell(s, p.c + o[0], p.r + o[1]);
        if (n && (n.status === 'healthy' || n.status === 'treated' && n.gt && n.gt.cls === 'Healthy')) { n.status = 'sick'; n.disease = p.disease; n.spreadAt = s.t; }
      });
      if (p.gt && !s.results[p.gt.id]) { s.results[p.gt.id] = 'outbreak'; s.stats.outbreaks += 1; note(s, 'bad', p.gt.cls + ' is spreading through the field.', p.gt.id); }
    });
    s.plants.forEach(function (p) {
      if (p.lateTreat && s.week === 1) {
        p.lateTreat = false; p.treatAt = s.t; s.stats.late += 1;
        if (p.gt.critical) { p.status = 'lost'; s.results[p.gt.id] = 'late_treat'; note(s, 'bad', 'Late: ' + p.gt.cls.toLowerCase() + ' treated a week late, plant lost.', p.gt.id); }
        else { p.status = 'treated'; s.results[p.gt.id] = 'late'; note(s, 'warn', 'Late treatment: ' + p.gt.cls.toLowerCase() + '.', p.gt.id); }
      }
    });
  }

  function step(s, dt) {
    if (s.done) return;
    s.t += dt;
    if (s.t <= P.scanT + dt) {
      s.scanX = Math.min(1, s.t / P.scanT);
      s.plants.forEach(function (p) { if (p.gt && !p.scanned && (p.c + 0.5) / P.cols <= s.scanX) scan(s, p); });
    } else if (s.week < P.weeks) {
      if (s.t >= P.scanT + (s.week + 1) * P.weekT) weekTick(s);
    } else if (s.endAt == null) s.endAt = s.t;
    if (s.endAt != null && s.t - s.endAt >= P.endHold) finish(s);
  }

  function finish(s) {
    s.done = true;
    s.plants.forEach(function (p) {
      if (p.status === 'sick') p.status = 'lost';
      if (p.gt && p.gt.cls !== 'Healthy' && !G.CROP_CRITICAL[p.gt.cls] && !s.results[p.gt.id]) s.results[p.gt.id] = p.wrongTx ? 'wrong_tx' : 'missed_warning';
      if (p.gt && G.CROP_CRITICAL[p.gt.cls] && !s.results[p.gt.id]) { s.results[p.gt.id] = 'outbreak'; s.stats.outbreaks += 1; }
    });
    s.stats.lost = s.plants.filter(function (p) { return p.status === 'lost'; }).length;
    var st = s.stats;
    if (st.outbreaks) s.outcome = 'collision';
    else if (s.plants.some(function (p) { return p.gt && s.results[p.gt.id] === 'late_treat'; })) s.outcome = 'near_miss';
    else if (st.lost || st.wasted || st.wrongTx || st.late) s.outcome = 'warnings';
    else s.outcome = 'safe';
    s.yieldPct = Math.round((s.plants.length - st.lost) / s.plants.length * 100);
    s.summary = 'Yield saved: ' + s.yieldPct + '% (' + st.lost + ' of ' + s.plants.length + ' plants lost).';
    note(s, s.outcome === 'safe' ? 'ok' : s.outcome === 'warnings' ? 'warn' : 'bad', G.MESSAGES.outcomes[s.outcome].label + '. ' + s.summary);
  }

  G.CropSim = { P: P, create: create, step: step };
})(window.GIGO);
