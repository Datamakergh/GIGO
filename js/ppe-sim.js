/* GIGO – warehouse safety-gate simulation core. Pure state machine (no DOM): drawn by ppe-view.js.
 * Workers walk left to right towards the PPE zone; an AI camera checks them before the zone line.
 * Person detection follows the annotation verdict:
 *   good   -> seen early, stopped at the gate for a PPE check
 *   late   -> seen late (loose box), only after stepping into the zone
 *   missed -> never seen, walks into the zone unchecked
 * During a check each required item is confirmed only if the worker wears it AND its class was learned
 * (good/late box). Worn items the AI cannot see become false alarms. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var P = {
    speed: 120, startX: -40, zoneX: 480, stopX: 440, seeAt: { good: 220, late: 520 },
    checkT: 1.1, gap: 0.8, exitX: 860, backX: -60, incidentX: 600, endHold: 0.8, maxTime: 90
  };

  function note(s, kind, text, id) { s.events.push({ t: s.t, kind: kind, text: text, id: id || null }); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  function create(det) {
    det = det || {};
    var s = {
      t: 0, done: false, endAt: null, workers: [], events: [], det: det, alarmAt: null,
      signal: 'idle', signalAt: 0, nextAt: 0.3,
      stats: { incidents: 0, nearMisses: 0, falseAlarms: 0, lateChecks: 0, unchecked: 0 },
      results: {}, outcome: null
    };
    G.GROUND_TRUTH.forEach(function (g) {
      if (g.cls !== 'Person' || !g.worker) return;
      var d = det[g.id] || { mode: 'missed' };
      s.workers.push({
        id: g.id, name: g.name, short: g.short, spec: g.worker, mode: d.mode, conf: d.conf || 0,
        x: P.startX, state: 'queue', seen: false, seenAt: null, checkAt: null, decided: false, entered: false,
        checks: null, phase: 0
      });
    });
    return s;
  }

  // what the AI concludes for each required item once it can see the worker
  function runChecks(s, w) {
    return G.PPE_ITEMS.map(function (it) {
      var worn = !!w.spec.wears[it.key], d = s.det[w.id + '_' + it.key], seen = worn && d && (d.mode === 'good' || d.mode === 'late');
      return { key: it.key, noun: it.noun, cls: it.cls, worn: worn, seen: seen, status: seen ? 'ok' : (worn ? 'false' : 'missing') };
    });
  }

  function decide(s, w) {
    var c = w.checks = runChecks(s, w), late = w.mode === 'late';
    var missing = c.filter(function (k) { return k.status === 'missing'; }).map(function (k) { return k.noun; });
    var fake = c.filter(function (k) { return k.status === 'false'; });
    w.decided = true; s.nextAt = s.t + P.gap;
    fake.forEach(function (k) { s.results[w.id + '_' + k.key] = 'missed_warning'; });
    s.stats.falseAlarms += fake.length;
    if (missing.length || fake.length) {
      w.state = 'back'; s.signal = 'stop'; s.signalAt = s.t;
      if (missing.length && late) {
        s.results[w.id] = 'near_miss'; s.stats.nearMisses += 1;
        note(s, 'bad', 'Near miss: ' + w.short + ' was already in the zone without ' + list(missing) + '.', w.id);
      } else if (missing.length) {
        s.results[w.id] = 'stopped';
        note(s, 'ok', 'Stopped ' + w.short + ' at the gate: no ' + list(missing) + '.', w.id);
      } else {
        s.results[w.id] = late ? 'late_check' : 'false_alarm';
        if (late) s.stats.lateChecks += 1;
      }
      fake.forEach(function (k) { note(s, 'warn', 'False alarm: AI could not see ' + w.short + '’s ' + k.noun + '.', w.id + '_' + k.key); });
    } else {
      w.state = 'pass'; s.signal = 'go'; s.signalAt = s.t;
      if (late) { s.results[w.id] = 'late_check'; s.stats.lateChecks += 1; note(s, 'warn', 'Late check: ' + w.short + ' was cleared only inside the zone.', w.id); }
      else { s.results[w.id] = 'cleared'; note(s, 'ok', cap(w.short) + ' cleared: full PPE confirmed.', w.id); }
    }
  }

  function step(s, dt) {
    if (s.done) return;
    s.t += dt;
    var active = s.workers.filter(function (w) { return w.state !== 'queue' && w.state !== 'gone'; });
    var busy = s.workers.some(function (w) { return w.state !== 'queue' && w.state !== 'gone' && !w.decided && !w.entered; });
    if (!busy && s.t >= s.nextAt) {
      var nx = s.workers.filter(function (w) { return w.state === 'queue'; })[0];
      if (nx) { nx.state = 'walk'; active.push(nx); s.signal = 'scan'; s.signalAt = s.t; }
    }
    active.forEach(function (w) {
      if (w.state === 'walk') {
        w.x += P.speed * dt; w.phase += dt * 7;
        if (!w.seen && w.mode !== 'missed' && w.x >= P.seeAt[w.mode]) {
          w.seen = true; w.seenAt = s.t;
          if (w.mode === 'late') note(s, 'warn', 'Weak detection: ' + w.short + ' spotted late.', w.id);
        }
        var stopAt = w.mode === 'late' ? P.seeAt.late : P.stopX;
        if (w.seen && w.x >= stopAt) { w.x = Math.max(w.x, stopAt); w.state = 'check'; w.checkAt = s.t; w.checks = runChecks(s, w); }
        if (w.mode === 'missed' && w.x >= P.zoneX && !w.entered) {
          w.entered = true; s.nextAt = s.t + P.gap;
          var miss = G.PPE_ITEMS.filter(function (it) { return !w.spec.wears[it.key]; }).map(function (it) { return it.noun; });
          G.PPE_ITEMS.forEach(function (it) { if (w.spec.wears[it.key]) s.results[w.id + '_' + it.key] = 'not_checked'; });
          if (miss.length) {
            s.results[w.id] = 'incident'; s.stats.incidents += 1; w.danger = true;
            note(s, 'bad', 'Unseen: ' + w.short + ' walked into the zone without ' + list(miss) + '.', w.id);
          } else {
            s.results[w.id] = 'unchecked'; s.stats.unchecked += 1;
            note(s, 'warn', 'Unchecked entry: the AI never saw ' + w.short + '.', w.id);
          }
        }
        if (w.danger && !w.alarmed && w.x >= P.incidentX) { w.alarmed = true; s.alarmAt = s.t; s.signal = 'alarm'; s.signalAt = s.t; }
        if (w.x >= P.exitX) w.state = 'gone';
      } else if (w.state === 'check') {
        if (s.t - w.checkAt >= P.checkT) decide(s, w);
      } else if (w.state === 'pass') {
        w.x += P.speed * dt; w.phase += dt * 7;
        if (w.x >= P.exitX) w.state = 'gone';
      } else if (w.state === 'back') {
        w.x -= P.speed * 1.2 * dt; w.phase += dt * 8;
        if (w.x <= P.backX) w.state = 'gone';
      }
    });
    var allGone = s.workers.every(function (w) { return w.state === 'gone'; });
    if (allGone && s.endAt == null) s.endAt = s.t;
    if ((s.endAt != null && s.t - s.endAt >= P.endHold) || s.t >= P.maxTime) finish(s);
  }

  function finish(s) {
    s.done = true;
    var st = s.stats;
    if (st.incidents) s.outcome = 'collision';
    else if (st.nearMisses) s.outcome = 'near_miss';
    else if (st.falseAlarms || st.lateChecks || st.unchecked) s.outcome = 'warnings';
    else s.outcome = 'safe';
    note(s, s.outcome === 'safe' ? 'ok' : s.outcome === 'warnings' ? 'warn' : 'bad', G.MESSAGES.outcomes[s.outcome].label + '.');
  }

  G.PPESim = { P: P, create: create, step: step };
})(window.GIGO);
