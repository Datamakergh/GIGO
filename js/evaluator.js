/* GIGO – annotation evaluator. Pure functions: no DOM, so it can be unit-tested in Node
 * and later swapped for / combined with a real detector. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  G.iou = function (a, b) {
    var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    var inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    var union = a.w * a.h + b.w * b.h - inter;
    return union > 0 ? inter / union : 0;
  };

  function boxCredit(iou) {
    var T = G.THRESHOLDS;
    var q = 0.3 + 0.7 * (iou - T.match) / (T.fullCredit - T.match);
    return Math.max(0, Math.min(1, q));
  }

  G.bandFor = function (score) {
    var bands = G.THRESHOLDS.bands;
    for (var i = 0; i < bands.length; i++) if (score >= bands[i].min) return bands[i];
    return bands[bands.length - 1];
  };

  /* boxes: [{id, x, y, w, h, cls}]  gt: G.GROUND_TRUTH */
  G.evaluate = function (boxes, gt) {
    var T = G.THRESHOLDS, pairs = [], i;
    gt.forEach(function (g, gi) {
      boxes.forEach(function (b, bi) {
        var v = G.iou(g.box, b);
        if (v >= T.match) pairs.push({ gi: gi, bi: bi, iou: v, same: g.cls === b.cls });
      });
    });
    pairs.sort(function (p, q) { return (q.iou + (q.same ? 0.02 : 0)) - (p.iou + (p.same ? 0.02 : 0)); });

    var usedG = {}, usedB = {}, matchOfG = {};
    pairs.forEach(function (p) {
      if (usedG[p.gi] || usedB[p.bi]) return;
      usedG[p.gi] = true; usedB[p.bi] = true; matchOfG[p.gi] = p;
    });

    var perObject = [], creditSum = 0;
    var counts = { good: 0, poorBox: 0, wrongClass: 0, missing: 0, duplicate: 0, spurious: 0 };
    gt.forEach(function (g, gi) {
      var m = matchOfG[gi], r = { id: g.id, name: g.name, cls: g.cls, critical: !!g.critical, iou: 0, boxId: null, predCls: null };
      if (!m) {
        var best = 0;
        boxes.forEach(function (b) { best = Math.max(best, G.iou(g.box, b)); });
        r.verdict = 'missing'; r.bestIoU = best; r.mode = 'missed'; r.credit = 0;
      } else {
        var b = boxes[m.bi];
        r.iou = m.iou; r.boxId = b.id; r.predCls = b.cls;
        if (b.cls !== g.cls) { r.verdict = 'wrongClass'; r.mode = 'missed'; r.credit = boxCredit(m.iou) * T.wrongClassFactor; }
        else if (m.iou >= T.good) { r.verdict = 'good'; r.mode = 'good'; r.credit = boxCredit(m.iou); }
        else { r.verdict = 'poorBox'; r.mode = 'late'; r.credit = boxCredit(m.iou); }
      }
      counts[r.verdict] += 1;
      creditSum += r.credit;
      perObject.push(r);
    });

    var extras = [];
    boxes.forEach(function (b, bi) {
      if (usedB[bi]) return;
      var dupOf = null, bestV = 0, bestG = null;
      gt.forEach(function (g) {
        var v = G.iou(g.box, b);
        if (v >= T.match && (!dupOf || v > bestV)) { dupOf = g; }
        if (v > bestV) { bestV = v; bestG = g; }
      });
      if (dupOf) { extras.push({ boxId: b.id, type: 'duplicate', ofId: dupOf.id, ofName: dupOf.name }); counts.duplicate += 1; }
      else { extras.push({ boxId: b.id, type: 'spurious', nearName: bestV >= 0.15 ? bestG.name : null, iou: bestV }); counts.spurious += 1; }
    });

    var penalty = counts.duplicate * T.duplicatePenalty + counts.spurious * T.spuriousPenalty;
    var raw = creditSum / gt.length * 100 - penalty;
    var score = Math.max(0, Math.min(100, Math.round(raw)));

    var byId = {};
    perObject.forEach(function (r) { byId[r.id] = r; });
    return {
      perObject: perObject, byId: byId, extras: extras, counts: counts,
      score: score, band: G.bandFor(score),
      total: gt.length,
      located: gt.length - counts.missing,                 // objects that have a box on them
      detected: counts.good + counts.poorBox,              // objects the simulated AI can detect
      boxCount: boxes.length
    };
  };

  /* Turn an evaluation into the per-object detection info the simulator uses.
   * This is the single seam where a real detector's output could be plugged in. */
  G.buildDetections = function (ev) {
    var det = {};
    ev.perObject.forEach(function (r) {
      var d = { mode: r.mode, verdict: r.verdict, iou: r.iou, label: r.cls, conf: 0, wrong: false };
      if (r.verdict === 'good') d.conf = Math.min(0.99, 0.5 + 0.5 * r.iou);
      else if (r.verdict === 'poorBox') d.conf = 0.3 + 0.45 * r.iou;
      else if (r.verdict === 'wrongClass') { d.wrong = true; d.label = r.predCls; d.conf = 0.4; }
      det[r.id] = d;
    });
    return det;
  };
})(window.GIGO);
