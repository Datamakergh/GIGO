/* GIGO – bottom results panel: score, detection performance, driving result, causes, advice, before/after. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  var VERDICT = {
    good: { chip: 'Detected', cls: 'ok' },
    poorBox: { chip: 'Weak', cls: 'warn' },
    wrongClass: { chip: 'Misclassified', cls: 'mid' },
    missing: { chip: 'Missed', cls: 'bad' }
  };

  function gt(id) { return G.GROUND_TRUTH.filter(function (g) { return g.id === id; })[0]; }

  /* Why did this object matter in the drive? */
  function consequence(g, r, sim) {
    var res = sim.results[g.id], S = G.SCENARIO;
    if (!g.critical && res === 'missed_warning') return 'Simulated effect: ' + g.warn;
    var t = (g.critical ? S.critical : S.minor)[res];
    return t ? t.replace(/\{short\}/g, g.short) : '';
  }

  function cause(g, r) {
    if (r.verdict === 'missing') {
      return r.bestIoU >= 0.15
        ? 'You drew a box near it, but it was too loose or shifted (overlap ' + r.bestIoU.toFixed(2) + ', needs 0.50). The model got no usable example.'
        : 'Your dataset did not include this object in the scene, so the model never learned to see it.';
    }
    if (r.verdict === 'wrongClass') return 'You labelled it "' + r.predCls + '" instead of "' + g.cls + '". A wrong label teaches the model the wrong thing.';
    if (r.verdict === 'poorBox') return 'Your box only loosely fits the object (overlap ' + r.iou.toFixed(2) + '), so the detection was weak.';
    return '';
  }

  function headline(g, r) {
    if (r.verdict === 'missing') return g.name + ': annotation missing';
    if (r.verdict === 'wrongClass') return g.name + ': wrong class';
    return g.name + ': box too loose';
  }

  function recommendations(ev) {
    var c = ev.counts, out = [];
    var crit = ev.perObject.filter(function (r) { return r.critical && r.verdict !== 'good'; });
    if (crit.length) out.push(G.SCENARIO.advice.critical);
    if (c.missing) out.push('Annotate every object in the scene, including small or partly hidden ones. Use the "Show answer key" box to compare.');
    if (c.wrongClass) out.push(G.SCENARIO.advice.wrongClass);
    if (c.poorBox) out.push('Draw tight boxes: each edge should just touch the object. Resize with the corner handles.');
    if (c.duplicate) out.push('Use exactly one box per object and delete the duplicates.');
    if (c.spurious) out.push('Only box real objects. Boxes on empty space teach the model false detections.');
    if (!out.length) out.push('Complete, accurate and consistent. This is the data quality real AI systems depend on.');
    return out;
  }

  function countUp(node, to) {
    if (!window.requestAnimationFrame || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 4);
      node.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function renderScore(ev) {
    var C = 2 * Math.PI * 52, pct = ev.score / 100, col = ev.band.color;
    var g = clear($('score-gauge'));
    g.innerHTML = '<svg viewBox="0 0 120 120" role="img" aria-label="Score ' + ev.score + ' out of 100">' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="11"/>' +
      '<circle class="gauge-arc" cx="60" cy="60" r="52" fill="none" stroke="' + col + '" stroke-width="11" stroke-linecap="round" ' +
      'stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 60 60)"' + (pct ? '' : ' stroke-opacity="0"') + '/>' +
      '<text class="gauge-num" x="60" y="62" text-anchor="middle" font-size="30" font-weight="800" fill="var(--ink)">' + ev.score + '</text>' +
      '<text x="60" y="80" text-anchor="middle" font-size="10" fill="var(--muted)">out of 100</text></svg>';
    countUp(g.querySelector('.gauge-num'), ev.score);
    var b = clear($('score-band'));
    var chip = el('span', 'band', ev.band.label); chip.style.background = col; b.appendChild(chip);
    b.appendChild(el('span', 'risk', ev.band.risk));
    var c = ev.counts, m = clear($('score-metrics'));
    [['Accurate boxes', c.good, 'ok'], ['Loose boxes (IoU < 0.75)', c.poorBox, 'warn'], ['Wrong class', c.wrongClass, 'mid'],
     ['Missing objects', c.missing, 'bad'], ['Duplicate boxes', c.duplicate, 'warn'], ['Boxes on nothing', c.spurious, 'warn']]
      .forEach(function (row) {
        var li = el('li');
        li.appendChild(el('span', null, row[0]));
        li.appendChild(el('b', row[1] ? row[2] : 'zero', String(row[1])));
        m.appendChild(li);
      });
    $('score-empty').hidden = true; $('score-body').hidden = false;
  }

  function renderDetect(ev, hooks) {
    var ul = clear($('detect-list'));
    ev.perObject.forEach(function (r) {
      var v = VERDICT[r.verdict], li = el('li');
      var b = el('button', 'det-row'); b.type = 'button';
      b.title = 'Show where this object is';
      b.appendChild(el('span', 'chip ' + v.cls, v.chip));
      var nm = el('span', 'det-name', r.name);
      if (r.critical) nm.appendChild(el('em', 'tag-crit', 'critical'));
      b.appendChild(nm);
      b.appendChild(el('span', 'det-iou', r.verdict === 'missing' ? 'no box' : 'IoU ' + r.iou.toFixed(2)));
      b.addEventListener('click', function () { hooks.onLocate(r.id); });
      li.style.animationDelay = Math.min(ul.children.length * 30, 300) + 'ms';
      li.appendChild(b); ul.appendChild(li);
    });
    $('detect-sum').textContent = ev.detected + ' of ' + ev.total + ' objects detected by the simulated AI';
    $('detect-empty').hidden = true; $('detect-body').hidden = false;
  }

  function renderDrive(ev, sim) {
    var o = G.MESSAGES.outcomes[sim.outcome];
    var head = clear($('drive-head'));
    head.className = 'outcome ' + o.tone;
    head.appendChild(el('strong', null, o.label));
    head.appendChild(el('span', null, o.text));
    var st = sim.stats, chips = clear($('drive-chips'));
    G.SCENARIO.stats.forEach(function (x) {
      var n = st[x[1]] || 0;
      var s = el('span', 'stat' + (n ? ' hot' : '')); s.appendChild(el('b', null, String(n))); s.appendChild(document.createTextNode(' ' + x[0]));
      chips.appendChild(s);
    });
    var log = clear($('drive-log'));
    sim.events.forEach(function (e) {
      var li = el('li', e.kind);
      li.appendChild(el('time', null, e.t.toFixed(1) + 's')); li.appendChild(document.createTextNode(' ' + e.text));
      log.appendChild(li);
    });
    $('drive-empty').hidden = true; $('drive-body').hidden = false;
  }

  function renderWhy(ev, sim) {
    var ul = clear($('why-list')), n = 0;
    ev.perObject.slice().sort(function (a, b) { return (b.critical ? 1 : 0) - (a.critical ? 1 : 0); }).forEach(function (r) {
      if (r.verdict === 'good') return;
      var g = gt(r.id), li = el('li', r.critical ? 'crit' : '');
      li.appendChild(el('strong', null, headline(g, r)));
      var p = el('p', null, (cause(g, r) + ' ' + consequence(g, r, sim)).trim());
      li.appendChild(p); ul.appendChild(li); n++;
    });
    ev.extras.forEach(function (x) {
      var li = el('li');
      if (x.type === 'duplicate') {
        li.appendChild(el('strong', null, 'Duplicate box on ' + x.ofName));
        li.appendChild(el('p', null, 'Two boxes on one object count as inconsistent data and cost points.'));
      } else {
        li.appendChild(el('strong', null, 'Box on nothing' + (x.nearName ? ' (near ' + x.nearName + ')' : '')));
        li.appendChild(el('p', null, 'This box does not match any object, so it would teach the model a false detection.'));
      }
      ul.appendChild(li); n++;
    });
    if (!n) {
      var li = el('li', 'allgood');
      li.appendChild(el('strong', null, 'No annotation problems found'));
      li.appendChild(el('p', null, G.SCENARIO.advice.allGood));
      ul.appendChild(li);
    }
    var rec = clear($('fix-list'));
    recommendations(ev).forEach(function (t) { rec.appendChild(el('li', null, t)); });
    $('why-empty').hidden = true; $('why-body').hidden = false;
    $('fix-empty').hidden = true; $('fix-body').hidden = false;
  }

  function renderCompare(history) {
    var tbl = clear($('compare-table')), cur = history[history.length - 1], prev = history[history.length - 2];
    if (!prev) {
      $('compare-note').textContent = 'This is run 1. Fix your annotations and run again to see a before-and-after comparison.';
    } else {
      $('compare-note').textContent = 'Run ' + (history.length - 1) + ' compared with run ' + history.length + '.';
    }
    var head = el('tr');
    ['', prev ? 'Before (run ' + (history.length - 1) + ')' : '', 'Now (run ' + history.length + ')'].forEach(function (t) { head.appendChild(el('th', null, t)); });
    if (!prev) head.removeChild(head.children[1]);
    tbl.appendChild(head);
    var rows = [
      ['Quality score', 'score', true],
      ['Objects detected', 'detected', true],
      ['Missed or misread', 'missed', false],
      ['Duplicates + extras', 'junk', false],
      [G.SCENARIO.id === 'road' ? 'Driving outcome' : 'Safety outcome', 'outcomeLabel', null]
    ];
    var show = function (k, v) { return k === 'detected' ? v + '/' + G.GROUND_TRUTH.length : String(v); };
    rows.forEach(function (r) {
      var tr = el('tr'); tr.appendChild(el('th', null, r[0]));
      if (prev) tr.appendChild(el('td', null, show(r[1], prev[r[1]])));
      var td = el('td', null, show(r[1], cur[r[1]]));
      if (prev && r[2] !== null && cur[r[1]] !== prev[r[1]]) {
        var better = r[2] ? cur[r[1]] > prev[r[1]] : cur[r[1]] < prev[r[1]];
        td.className = better ? 'better' : 'worse';
        td.textContent = show(r[1], cur[r[1]]) + (better ? '  ▲' : '  ▼');
      } else if (prev && r[2] === null && cur.outcome !== prev.outcome) {
        td.className = cur.rank < prev.rank ? 'better' : 'worse';
      }
      tr.appendChild(td); tbl.appendChild(tr);
    });
    $('compare-empty').hidden = true; $('compare-body').hidden = false;
  }

  var OUTCOME_RANK = { safe: 0, warnings: 1, near_miss: 2, collision: 3 };

  G.Feedback = {
    showScore: function (ev, hooks) { renderScore(ev); renderDetect(ev, hooks); },
    showDrive: function (ev, sim, history, hooks) {
      renderDrive(ev, sim); renderWhy(ev, sim); renderCompare(history);
    },
    record: function (ev, sim) {
      return {
        score: ev.score, detected: ev.detected, missed: ev.counts.missing + ev.counts.wrongClass,
        junk: ev.counts.duplicate + ev.counts.spurious, outcome: sim.outcome, rank: OUTCOME_RANK[sim.outcome],
        outcomeLabel: G.MESSAGES.outcomes[sim.outcome].label
      };
    },
    reset: function () {
      ['score', 'detect', 'drive', 'why', 'fix', 'compare'].forEach(function (k) {
        $(k + '-empty').hidden = false; $(k + '-body').hidden = true;
      });
    }
  };
})(window.GIGO);
