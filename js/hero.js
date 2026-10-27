/* GIGO – Overview hero slideshow. One slide per scene, drawn live from the scene's own art with a good,
 * a sloppy and a missed label on top. Advances every 2 s; pauses on hover/focus and under reduced motion. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var ORDER = ['road', 'warehouse', 'drone', 'crop', 'llm'], INTERVAL = 2000;
  var OK = '#16a34a', WARN = '#d97706', BAD = '#dc2626';

  function tag(ctx, b, text, col, dashed) {
    ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = col; if (dashed) ctx.setLineDash([10, 7]);
    ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore();
    chip(ctx, b.x - 2, b.y - 27, text, col);
  }
  function chip(ctx, x, y, text, col) {
    ctx.font = '700 17px system-ui'; var w = ctx.measureText(text).width + 14;
    ctx.fillStyle = col; G.roundRect(ctx, x, y, w, 24, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 7, y + 13);
  }
  function loose(b) {
    var x = Math.max(4, b.x - 22), y = Math.max(30, b.y - 26);
    return { x: x, y: y, w: Math.min(b.w + 50, 796 - x), h: Math.min(b.h + 40, 496 - y) };
  }

  // road keeps its hand-picked objects; other box scenes use their critical objects first
  function drawBoxes(ctx, id, gt) {
    ctx.drawImage(G.getSceneCanvas(), 0, 0);
    if (id === 'road') {
      var by = function (k) { return gt.filter(function (g) { return g.id === k; })[0].box; };
      tag(ctx, by('car_ahead'), 'Car 96%', OK);
      tag(ctx, by('traffic_light'), 'Light', OK);
      tag(ctx, loose(by('cyclist')), 'Bicycle 41%', WARN);
      tag(ctx, by('ped_cross'), 'MISSED', BAD, true);
      return;
    }
    var crit = gt.filter(function (g) { return g.critical; }), rest = gt.filter(function (g) { return !g.critical; });
    var pick = crit.concat(rest), good = pick[0], miss = pick[1];
    // the loose box must not sit on the other two (warehouse PPE boxes live inside Person boxes)
    var l = rest.concat(pick).filter(function (g) {
      var b = loose(g.box);
      return [good, miss].every(function (o) {
        var p = o.box;
        return g !== o && (b.x > p.x + p.w + 8 || b.x + b.w + 8 < p.x || b.y > p.y + p.h + 30 || b.y + b.h + 30 < p.y);
      });
    })[0];
    tag(ctx, good.box, good.cls, OK);
    if (l) tag(ctx, loose(l.box), l.cls + ' 44%', WARN);
    tag(ctx, miss.box, 'MISSED', BAD, true);
  }

  function wrap(ctx, text, maxW) {
    var lines = [], line = '';
    text.split(' ').forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    lines.push(line);
    return lines;
  }
  function bubble(ctx, text, right, y, fill, ink) {
    ctx.font = '500 19px system-ui';
    var lines = wrap(ctx, text, 440), w = 0;
    lines.forEach(function (s) { w = Math.max(w, ctx.measureText(s).width); });
    w += 32; var h = lines.length * 26 + 20, x = right ? 760 - w : 40;
    ctx.fillStyle = fill; G.roundRect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.fillStyle = ink; ctx.textBaseline = 'middle';
    lines.forEach(function (s, i) { ctx.fillText(s, x + 16, y + 23 + i * 26); });
    return { x: x, y: y, w: w, h: h };
  }

  // LLM: a chat mock with a correctly approved answer, a caught wrong one and a missed unsafe one
  function drawChat(ctx, gt) {
    var g = ctx.createLinearGradient(0, 0, 800, 500);
    g.addColorStop(0, '#1e293b'); g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 500);
    var get = function (k) { return gt.filter(function (x) { return x.id === k; })[0]; };
    var rows = [[get('q1'), 'Correct', OK, false], [get('q4'), 'Wrong', OK, false], [get('q5'), 'MISSED', BAD, true]];
    var y = 28;
    rows.forEach(function (r) {
      var q = bubble(ctx, r[0].q, true, y, '#2563eb', '#fff');
      y = q.y + q.h + 30;
      var a = bubble(ctx, r[0].a, false, y, r[3] ? '#7f1d1d' : '#334155', r[3] ? '#fecaca' : '#e2e8f0');
      ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = r[2]; if (r[3]) ctx.setLineDash([9, 6]);
      G.roundRect(ctx, a.x - 4, a.y - 4, a.w + 8, a.h + 8, 16); ctx.stroke(); ctx.restore();
      chip(ctx, a.x + a.w + 14, a.y + a.h / 2 - 12, r[1], r[2]);
      y = a.y + a.h + 22;
    });
  }

  function slide(id) {
    var sc = G.useScenario(id), c = document.createElement('canvas');
    c.width = 800; c.height = 500;
    var ctx = c.getContext('2d');
    if (sc.kind === 'text') drawChat(ctx, sc.groundTruth); else drawBoxes(ctx, id, sc.groundTruth);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', sc.card.title + ' scene with a good, a sloppy and a missed label');
    return c;
  }

  G.initHero = function (root) {
    var stage = root.querySelector('.hs-stage'), label = root.querySelector('.hs-label'),
        dots = root.querySelector('.hs-dots'), slides = [], at = 0, timer = null, held = false;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    ORDER.forEach(function (id, i) {
      var c = slide(id);
      if (i) c.className = 'off';
      stage.appendChild(c);
      var d = document.createElement('button');
      d.type = 'button'; d.setAttribute('aria-label', 'Show ' + G.SCENARIOS[id].card.title);
      d.addEventListener('click', function () { go(i); restart(); });
      dots.appendChild(d);
      slides.push({ id: id, canvas: c, dot: d });
    });
    G.useScenario('road');

    function go(i) {
      slides[at].canvas.className = 'off'; slides[at].dot.removeAttribute('aria-current');
      at = (i + slides.length) % slides.length;
      var s = slides[at], k = G.SCENARIOS[s.id].card;
      s.canvas.className = ''; s.dot.setAttribute('aria-current', 'true');
      label.href = 'play.html?scene=' + s.id;
      label.innerHTML = '';
      var b = document.createElement('b'); b.textContent = k.title;
      label.appendChild(b); label.appendChild(document.createTextNode(' ' + k.place + ' →'));
    }
    function restart() {
      clearInterval(timer); timer = null;
      if (!still && !held) timer = setInterval(function () { go(at + 1); }, INTERVAL);
    }
    function hold(v) { return function () { held = v; restart(); }; }
    root.addEventListener('mouseenter', hold(true));
    root.addEventListener('mouseleave', hold(false));
    root.addEventListener('focusin', hold(true));
    root.addEventListener('focusout', hold(false));

    go(0); restart();
  };
})(window.GIGO);
