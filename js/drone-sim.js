/* GIGO – drone census simulation core. Pure state machine (no DOM): drawn by drone-view.js.
 * The drone flies three lawnmower rows over the 800 x 500 scene. As its camera passes an object:
 *   good   -> counted / alert sent straight away
 *   late   -> counted with low confidence / alert sent late (loose box)
 *   missed -> not counted / no alert
 *   wrong  -> counted as the class you gave it (species mix-up, or a missed alert) */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var P = { rows: [85, 250, 415], half: 85, speed: 240, x0: -60, x1: 860, turnT: 0.8, lateBy: 140, endHold: 1, maxTime: 60 };

  function note(s, kind, text, id) { s.events.push({ t: s.t, kind: kind, text: text, id: id || null }); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function rowOf(g) {
    var cy = g.box.y + g.box.h / 2, best = 0;
    P.rows.forEach(function (r, i) { if (Math.abs(cy - r) < Math.abs(cy - P.rows[best])) best = i; });
    return best;
  }

  function create(det) {
    det = det || {};
    var s = {
      t: 0, done: false, endAt: null, events: [], results: {}, outcome: null, summary: '',
      drone: { x: P.x0, y: P.rows[0], row: 0, dir: 1, turning: 0 },
      objs: [], tally: {}, truth: {}, alert: null,
      stats: { alertsMissed: 0, lateAlerts: 0, missed: 0, mixups: 0, uncertain: 0 }
    };
    G.DRONE_SPECIES.forEach(function (sp) { s.tally[sp] = 0; s.truth[sp] = 0; });
    G.GROUND_TRUTH.forEach(function (g) {
      var d = det[g.id] || { mode: 'missed' };
      if (s.truth[g.cls] != null) s.truth[g.cls] += 1;
      s.objs.push({ id: g.id, g: g, row: rowOf(g), cx: g.box.x + g.box.w / 2, mode: d.mode, wrong: !!d.wrong, label: d.label || g.cls,
        conf: d.conf || 0, state: 'pending', seenAt: null });
    });
    return s;
  }

  function resolve(s, o, late) {
    var g = o.g;
    o.state = o.mode === 'missed' && !o.wrong ? 'missed' : 'seen'; o.seenAt = s.t;
    if (o.state === 'missed') {
      if (g.critical) { s.results[g.id] = 'alert_missed'; s.stats.alertsMissed += 1; note(s, 'bad', 'Unseen: ' + g.short + '. No alert sent.', g.id); }
      else { s.results[g.id] = 'missed_warning'; s.stats.missed += 1; note(s, 'warn', cap(g.cls.toLowerCase()) + ' not counted.', g.id); }
      return;
    }
    if (o.wrong) {
      if (s.tally[o.label] != null) s.tally[o.label] += 1;
      if (g.critical) { s.results[g.id] = 'alert_missed'; s.stats.alertsMissed += 1; note(s, 'bad', 'Seen as "' + o.label + '": no alert for the ' + g.short + '.', g.id); }
      else {
        s.results[g.id] = 'mixup'; s.stats.mixups += 1;
        note(s, 'warn', (o.label === 'Person' ? 'False poaching alert: ' : 'Mix-up: ') + g.cls.toLowerCase() + ' counted as ' + o.label.toLowerCase() + '.', g.id);
      }
      return;
    }
    if (s.tally[g.cls] != null) s.tally[g.cls] += 1;
    if (g.critical) {
      s.alert = { id: g.id, t: s.t, late: late };
      if (late) { s.results[g.id] = 'late_alert'; s.stats.lateAlerts += 1; note(s, 'bad', 'Late ' + g.alert + ': ' + g.short + '.', g.id); }
      else { s.results[g.id] = 'alert'; note(s, 'ok', cap(g.alert) + ' sent.', g.id); }
    } else if (late) { s.results[g.id] = 'uncertain'; s.stats.uncertain += 1; note(s, 'warn', 'Unsure count: ' + g.cls.toLowerCase() + '.', g.id); }
    else s.results[g.id] = 'counted';
  }

  function step(s, dt) {
    if (s.done) return;
    s.t += dt;
    var d = s.drone;
    if (d.turning > 0) {
      d.turning -= dt;
      var to = P.rows[d.row];
      d.y += (to - d.y) * Math.min(1, dt * 6);
      if (d.turning <= 0) d.y = to;
    } else if (d.row < P.rows.length) {
      d.x += d.dir * P.speed * dt;
      s.objs.forEach(function (o) {
        if (o.state !== 'pending' || o.row !== d.row) return;
        var past = (d.x - o.cx) * d.dir;
        var lateNow = o.mode === 'late' && (past >= P.lateBy || d.x > P.x1 || d.x < P.x0);
        if (past >= 0 && (o.mode !== 'late' || lateNow)) resolve(s, o, o.mode === 'late');
      });
      if ((d.dir > 0 && d.x >= P.x1) || (d.dir < 0 && d.x <= P.x0)) {
        d.row += 1;
        if (d.row < P.rows.length) { d.dir = -d.dir; d.turning = P.turnT; }
        else if (s.endAt == null) s.endAt = s.t;
      }
    }
    if ((s.endAt != null && s.t - s.endAt >= P.endHold) || s.t >= P.maxTime) finish(s);
  }

  function finish(s) {
    s.done = true;
    s.objs.forEach(function (o) { if (o.state === 'pending') resolve(s, o, o.mode === 'late'); });
    var st = s.stats;
    if (st.alertsMissed) s.outcome = 'collision';
    else if (st.lateAlerts) s.outcome = 'near_miss';
    else if (st.missed || st.mixups || st.uncertain) s.outcome = 'warnings';
    else s.outcome = 'safe';
    var counted = 0, total = 0;
    G.DRONE_SPECIES.forEach(function (sp) { total += s.truth[sp]; });
    s.objs.forEach(function (o) { if (!o.g.critical || o.g.cls === 'Lion') { if (s.results[o.id] === 'counted' || s.results[o.id] === 'uncertain' || s.results[o.id] === 'alert' || s.results[o.id] === 'late_alert') counted++; } });
    s.summary = 'Correct counts: ' + counted + ' of ' + total + ' animals.';
    note(s, s.outcome === 'safe' ? 'ok' : s.outcome === 'warnings' ? 'warn' : 'bad', G.MESSAGES.outcomes[s.outcome].label + '. ' + s.summary);
  }

  G.DroneSim = { P: P, create: create, step: step };
})(window.GIGO);
