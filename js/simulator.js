/* GIGO – driving simulation core. Pure state machine (no DOM, no canvas): drawn by sim-view.js.
 * Top-down 2D world; the ego car drives left to right in the lower lane.
 * Each critical object is "detected" according to the annotation verdict:
 *   good   -> seen early, comfortable braking
 *   late   -> seen late (loose box), delayed reaction, hard braking
 *   missed -> never seen, no reaction */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var ROAD = { top: 100, bottom: 260, mid: 180, egoY: 220, swTop: 70, swBot: 290 };
  var P = {
    cruise: 170, accel: 85, comfDecel: 100, maxDecel: 320,
    egoLen: 70, egoW: 36, margin: 45, nearMiss: 28,
    range: { good: 380, late: 130 }, delay: { good: 0, late: 0.35 },
    finishX: 3850, crashHold: 2.2, lightWait: 2, maxTime: 150
  };

  function rectOf(a) { return { l: a.x - a.w / 2, r: a.x + a.w / 2, t: a.y - a.h / 2, b: a.y + a.h / 2 }; }
  function egoRect(s) { return { l: s.ego.x - P.egoLen / 2, r: s.ego.x + P.egoLen / 2, t: ROAD.egoY - P.egoW / 2, b: ROAD.egoY + P.egoW / 2 }; }
  function overlap(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }
  function rectGap(a, b) {
    var dx = Math.max(0, b.l - a.r, a.l - b.r), dy = Math.max(0, b.t - a.b, a.t - b.b);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function front(s) { return s.ego.x + P.egoLen / 2; }
  function refX(a) { return a.type === 'light' ? a.x : a.x - a.w / 2; }
  function note(s, kind, text, id) { s.events.push({ t: s.t, kind: kind, text: text, id: id || null }); }

  function create(det) {
    det = det || {};
    var s = {
      t: 0, done: false, ending: null, crashId: null, crashAt: null,
      ego: { x: 0, v: 0, braking: false, crashed: false },
      actors: [], events: [], det: det,
      stats: { collisions: 0, nearMisses: 0, violations: 0, lateBrakes: 0, warnings: 0 },
      results: {}, outcome: null
    };
    G.GROUND_TRUTH.forEach(function (g) {
      var sp = g.sim, d = det[g.id] || { mode: 'missed' };
      var a = {
        id: g.id, name: g.name, short: g.short, warn: g.warn || '', art: g.art, cls: g.cls,
        type: sp.type, critical: !!g.critical, mode: d.mode, sp: sp,
        w: sp.w || 18, h: sp.h || 18, x: sp.x || 0, y: sp.y || ROAD.egoY, vx: 0,
        state: 'idle', perceived: false, percAt: null, minGap: Infinity, noted: false,
        spawned: sp.type !== 'oncoming', waitT: 0, stopT: 0, violated: false, lateNoted: false
      };
      if (sp.type === 'lead') a.state = 'stopped';
      if (sp.type === 'light') a.state = 'red';
      if (sp.type === 'crosser') a.y = sp.y0;
      s.actors.push(a);
    });
    return s;
  }

  function updateActors(s, dt) {
    var f = front(s);
    s.actors.forEach(function (a) {
      if (s.crashId === a.id) return; // whatever was hit stays where it was hit
      switch (a.type) {
        case 'crosser':
          if (a.state === 'idle' && a.x > f && a.x - f <= a.sp.trigger) a.state = 'crossing';
          if (a.state === 'crossing') {
            a.y += a.sp.speed * dt;
            if (a.y >= a.sp.y1) { a.y = a.sp.y1; a.state = 'done'; }
          }
          break;
        case 'walker':
          a.x += a.sp.vx * dt;
          break;
        case 'lead':
          if (a.state === 'stopped') {
            var near = (a.x - a.w / 2) - f < 140 && s.ego.v < 15;
            a.waitT = near ? a.waitT + dt : 0;
            if (a.waitT >= 1.5) a.state = 'moving';
          } else {
            a.vx = Math.min(a.vx + 60 * dt, 150);
            a.x += a.vx * dt;
          }
          break;
        case 'oncoming':
          if (!a.spawned && s.ego.x >= a.sp.spawnAfter) { a.spawned = true; a.x = s.ego.x + a.sp.offset; }
          if (a.spawned) a.x -= a.sp.speed * dt;
          break;
        case 'light':
          if (a.state === 'red') {
            if (f >= a.x - 40 && f <= a.x + 2 && s.ego.v < 2) a.stopT += dt; else a.stopT = 0;
            if (a.stopT >= P.lightWait) a.state = 'green';
            if (f > a.x + 4 && !a.violated) {
              a.violated = true; s.stats.violations += 1;
              note(s, 'bad', 'Ran the red light!', a.id);
            }
            if (f > a.x + 150) a.state = 'green';
          }
          break;
      }
    });
  }

  function perceive(s) {
    var f = front(s);
    s.actors.forEach(function (a) {
      if (!a.critical || a.perceived) return;
      var d = refX(a) - f;
      if (a.mode !== 'missed') {
        if (d <= P.range[a.mode] && d > -20) {
          a.perceived = true; a.percAt = s.t;
          if (a.mode === 'good') note(s, 'ok', 'Detected: ' + a.short, a.id);
        }
      } else if (!a.noted && d <= P.range.late && d > -20) {
        a.noted = true;
        note(s, 'bad', 'No detection: ' + a.short, a.id);
      }
    });
  }

  function blocking(a, f) {
    if (a.type === 'crosser') return a.state === 'crossing' && a.y < ROAD.bottom + a.h / 2 + 8 && f < a.x + a.w / 2;
    if (a.type === 'lead') return f < a.x - a.w / 2 + 2;
    if (a.type === 'light') return a.state === 'red' && f < a.x + 2;
    return false;
  }
  function target(a) {
    if (a.type === 'light') return a.x - 6;
    return a.x - a.w / 2 - P.margin;
  }

  function step(s, dt) {
    if (s.done) return;
    s.t += dt;
    var e = s.ego;
    updateActors(s, dt);
    if (e.crashed) {
      e.v = 0; e.braking = true;
      if (s.t - s.crashAt >= P.crashHold) finish(s, 'crash');
      return;
    }
    perceive(s);

    var f = front(s), vAllow = P.cruise;
    s.actors.forEach(function (a) {
      if (!a.critical || !a.perceived) return;
      if (s.t < a.percAt + P.delay[a.mode]) return;
      if (a.mode === 'late' && !a.lateNoted) {
        a.lateNoted = true; s.stats.lateBrakes += 1;
        note(s, 'warn', 'Late detection: ' + a.short + ' (hard braking)', a.id);
      }
      if (!blocking(a, f)) return;
      var gap = Math.max(0, target(a) - f), vl = a.type === 'lead' ? Math.max(0, a.vx) : 0;
      var va = gap < 0.3 ? vl : Math.sqrt(vl * vl + 2 * P.comfDecel * gap);
      vAllow = Math.min(vAllow, va);
    });

    var prev = e.v;
    if (e.v > vAllow) e.v = Math.max(vAllow, e.v - P.maxDecel * dt);
    else e.v = Math.min(vAllow, e.v + P.accel * dt);
    e.braking = e.v < prev - 0.01;
    e.x += e.v * dt;
    f = front(s);

    var er = egoRect(s);
    for (var i = 0; i < s.actors.length; i++) {
      var a = s.actors[i];
      if (a.type === 'light' || (a.type === 'oncoming' && !a.spawned)) continue;
      var r = rectOf(a);
      if (a.critical && (a.type === 'lead' || (a.type === 'crosser' && a.state === 'crossing')) &&
          f > a.x - a.w / 2 - 150 && er.l < r.r) {
        a.minGap = Math.min(a.minGap, rectGap(er, r));
      }
      if (overlap(er, r)) {
        e.crashed = true; e.v = 0; s.crashId = a.id; s.crashAt = s.t; s.stats.collisions = 1;
        note(s, 'bad', 'COLLISION with ' + a.short + '!', a.id);
        return;
      }
    }

    s.actors.forEach(function (a) {
      if (a.critical || a.noted || a.mode !== 'missed' || !a.warn) return;
      var close = a.type === 'oncoming' ? (a.spawned && Math.abs(a.x - s.ego.x) < 160) : f >= a.x - 60;
      if (close) { a.noted = true; s.stats.warnings += 1; note(s, 'warn', 'Warning: ' + a.warn, a.id); }
    });

    if (f >= P.finishX) finish(s, 'finish');
    else if (s.t > P.maxTime) finish(s, 'timeout');
  }

  function finish(s, why) {
    s.done = true; s.ending = why;
    var f = front(s), res = s.results;
    s.actors.forEach(function (a) {
      var r = 'safe';
      if (a.critical) {
        if (s.crashId === a.id) r = 'collision';
        else if (s.ego.crashed && f < refX(a)) r = 'not_reached';
        else if (a.type === 'light' && a.violated) r = 'violation';
        else if (a.minGap < P.nearMiss) r = 'near_miss';
        else if (a.mode === 'late' && a.perceived) r = 'late_brake';
        if (r === 'near_miss') s.stats.nearMisses += 1;
      } else if (a.mode === 'missed') {
        r = a.noted ? 'missed_warning' : 'not_reached';
      }
      res[a.id] = r;
    });
    var vals = Object.keys(res).map(function (k) { return res[k]; });
    var has = function (x) { return vals.indexOf(x) >= 0; };
    if (s.crashId) s.outcome = 'collision';
    else if (has('near_miss') || has('violation')) s.outcome = 'near_miss';
    else if (has('late_brake') || s.stats.warnings > 0) s.outcome = 'warnings';
    else s.outcome = 'safe';
  }

  G.Sim = { ROAD: ROAD, P: P, create: create, step: step, rectOf: rectOf, refX: refX, front: front };
})(window.GIGO);
