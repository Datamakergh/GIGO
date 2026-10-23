/* GIGO – renders the driving simulation (state comes from simulator.js): top-down 2D, or the 3D chase camera in sim-3d.js. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var R = G.Sim.ROAD, EGO_SCREEN_X = 200;
  var COL = { good: '#22c55e', late: '#f59e0b', missed: '#ef4444', wrong: '#f97316' };
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function easeOut(p) { return 1 - Math.pow(1 - clamp01(p), 4); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return 'rgb(' + Math.round(r + (t - r) * p) + ',' + Math.round(g + (t - g) * p) + ',' + Math.round(b + (t - b) * p) + ')';
  }

  // asphalt grain, rendered once and tiled with the camera
  var grain = (function () {
    var c = document.createElement('canvas'); c.width = 256; c.height = R.bottom - R.top;
    var g = c.getContext('2d'), seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    g.fillStyle = '#3f454e'; g.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < 1400; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.12)';
      g.fillRect(rnd() * c.width, rnd() * c.height, 1 + rnd() * 1.4, 1 + rnd() * 1.4);
    }
    return c;
  })();

  /* ---- top-down sprites ---- */

  function carTop(ctx, cx, cy, len, wid, color, o) {
    o = o || {};
    ctx.save(); ctx.translate(cx, cy);
    if (o.flip) ctx.scale(-1, 1);
    // ground shadow
    ctx.fillStyle = 'rgba(15,23,42,.28)'; G.roundRect(ctx, -len / 2 + 3, -wid / 2 + 5, len, wid, 9); ctx.fill();
    // wheels
    ctx.fillStyle = '#121418';
    [[-len * 0.3, -wid / 2 - 1.5], [len * 0.24, -wid / 2 - 1.5], [-len * 0.3, wid / 2 - 3.5], [len * 0.24, wid / 2 - 3.5]].forEach(function (p) {
      G.roundRect(ctx, p[0] - 6, p[1], 13, 5, 2); ctx.fill();
    });
    // body
    var bg = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
    bg.addColorStop(0, shade(color, -0.2)); bg.addColorStop(0.5, shade(color, 0.14)); bg.addColorStop(1, shade(color, -0.25));
    G.roundRect(ctx, -len / 2, -wid / 2, len, wid, 9); ctx.fillStyle = bg; ctx.fill();
    // mirrors
    ctx.fillStyle = shade(color, -0.3);
    G.roundRect(ctx, len * 0.08, -wid / 2 - 3, 6, 4, 1.5); ctx.fill(); G.roundRect(ctx, len * 0.08, wid / 2 - 1, 6, 4, 1.5); ctx.fill();
    // windscreen, roof, rear window
    var glass = ctx.createLinearGradient(len * 0.04, 0, len * 0.28, 0);
    glass.addColorStop(0, '#1d2d3d'); glass.addColorStop(1, '#4b6a86');
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.moveTo(len * 0.04, -wid / 2 + 5); ctx.lineTo(len * 0.27, -wid / 2 + 3); ctx.quadraticCurveTo(len * 0.31, 0, len * 0.27, wid / 2 - 3); ctx.lineTo(len * 0.04, wid / 2 - 5); ctx.closePath(); ctx.fill();
    G.roundRect(ctx, -len * 0.25, -wid / 2 + 5, len * 0.29, wid - 10, 4); ctx.fillStyle = shade(color, 0.06); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-len * 0.22, -wid / 2 + 7, len * 0.23, 3);
    ctx.fillStyle = '#22364a';
    ctx.beginPath(); ctx.moveTo(-len * 0.26, -wid / 2 + 5); ctx.lineTo(-len * 0.38, -wid / 2 + 6); ctx.quadraticCurveTo(-len * 0.41, 0, -len * 0.38, wid / 2 - 6); ctx.lineTo(-len * 0.26, wid / 2 - 5); ctx.closePath(); ctx.fill();
    // hood crease
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(len * 0.31, -wid * 0.18); ctx.lineTo(len * 0.47, -wid * 0.14); ctx.moveTo(len * 0.31, wid * 0.18); ctx.lineTo(len * 0.47, wid * 0.14); ctx.stroke();
    // headlights
    ctx.fillStyle = '#fff3c4';
    G.roundRect(ctx, len / 2 - 4, -wid / 2 + 3, 4, 8, 1.5); ctx.fill(); G.roundRect(ctx, len / 2 - 4, wid / 2 - 11, 4, 8, 1.5); ctx.fill();
    // sensor dome on the autonomous car
    if (o.ego) {
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(-len * 0.1, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(-len * 0.1, 0, 2, 0, Math.PI * 2); ctx.fill();
    }
    // tail lights
    ctx.save();
    if (o.braking) { ctx.shadowColor = 'rgba(255,20,20,.95)'; ctx.shadowBlur = 14; }
    ctx.fillStyle = o.braking ? '#ff2d2d' : '#7f1d1d';
    G.roundRect(ctx, -len / 2, -wid / 2 + 3, 4, 8, 1.5); ctx.fill(); G.roundRect(ctx, -len / 2, wid / 2 - 11, 4, 8, 1.5); ctx.fill();
    ctx.restore();
    // hazard lights after a crash
    if (o.hazard) {
      ctx.save(); ctx.shadowColor = 'rgba(251,191,36,.95)'; ctx.shadowBlur = 12; ctx.fillStyle = '#fbbf24';
      [[len / 2 - 3, -wid / 2 + 1], [len / 2 - 3, wid / 2 - 1], [-len / 2 + 3, -wid / 2 + 1], [-len / 2 + 3, wid / 2 - 1]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }
    ctx.restore();
  }

  function person(ctx, x, y, w, h, shirt, vertical, phase) {
    var s = Math.min(w, h) / 18;
    ctx.save(); ctx.translate(x, y);
    if (vertical) ctx.rotate(Math.PI / 2);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(15,23,42,.25)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 7, 9.5, 0, 0, Math.PI * 2); ctx.fill();
    // legs swing along the walking direction
    var sw = Math.sin(phase) * 4;
    ctx.fillStyle = '#2b3442';
    ctx.beginPath(); ctx.ellipse(sw, -3.2, 3.2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-sw, 3.2, 3.2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    // shoulders
    var g = ctx.createLinearGradient(-5, 0, 5, 0);
    g.addColorStop(0, shade(shirt, 0.12)); g.addColorStop(1, shade(shirt, -0.25));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.fillStyle = '#e8b892'; ctx.beginPath(); ctx.arc(0.5, 0, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.arc(-0.6, 0, 4.2, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    ctx.restore();
  }

  function bikeTop(ctx, x, y, art) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(15,23,42,.25)'; G.roundRect(ctx, -2, -16, 8, 36, 4); ctx.fill();
    ctx.fillStyle = '#1b1f24';
    G.roundRect(ctx, -1.8, -18, 3.6, 12, 1.8); ctx.fill();
    G.roundRect(ctx, -1.8, 6, 3.6, 12, 1.8); ctx.fill();
    ctx.strokeStyle = art.color || '#10b981'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, 9); ctx.lineTo(7, 9); ctx.stroke();
    var g = ctx.createLinearGradient(-8, 0, 8, 0);
    g.addColorStop(0, shade(art.shirt, 0.12)); g.addColorStop(1, shade(art.shirt, -0.25));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 1, 8.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(0, 2.5, 4.4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-1, 0, 2, 4.5);
    ctx.restore();
  }

  function trafficLight(ctx, lx, state) {
    ctx.fillStyle = 'rgba(15,23,42,.25)'; G.roundRect(ctx, lx - 7, 273, 18, 46, 4); ctx.fill();
    ctx.fillStyle = '#59616b'; ctx.fillRect(lx - 2, 262, 4, 10);
    G.roundRect(ctx, lx - 9, 270, 18, 46, 4); ctx.fillStyle = '#161b21'; ctx.fill();
    var on = state === 'red' ? 0 : 2;
    ['#ff3b30', '#f5b301', '#22c55e'].forEach(function (c, i) {
      ctx.save();
      if (i === on) { ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillStyle = c; }
      else ctx.fillStyle = shade(c, -0.72);
      ctx.beginPath(); ctx.arc(lx, 280 + i * 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function signTop(ctx, x, y, art) {
    var onTop = y < 100;
    ctx.fillStyle = '#6b7280'; ctx.fillRect(x - 1.5, y, 3, onTop ? 10 : -10);
    ctx.fillStyle = 'rgba(15,23,42,.22)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, 12, 0, Math.PI * 2); ctx.fill();
    if (art.sign === 'speed') {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d42626'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('50', x, y + 0.5);
    } else {
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.moveTo(x, y - 12.5); ctx.lineTo(x + 12.5, y); ctx.lineTo(x, y + 12.5); ctx.lineTo(x - 12.5, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.moveTo(x, y - 10.5); ctx.lineTo(x + 10.5, y); ctx.lineTo(x, y + 10.5); ctx.lineTo(x - 10.5, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x - 2, y - 2.5, 1.6, 0, Math.PI * 2); ctx.arc(x + 2.5, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 2.8, y - 0.8, 1.6, 5); ctx.fillRect(x + 1.8, y + 0.4, 1.4, 4);
    }
  }

  /* ---- overlays ---- */

  function pill(ctx, text, x, y, color, above) {
    ctx.font = '700 11px system-ui, sans-serif';
    var w = ctx.measureText(text).width + 12, h = 17, ty = above ? y - h - 2 : y;
    ctx.fillStyle = color; G.roundRect(ctx, x, ty, w, h, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 6, ty + h / 2 + 0.5);
  }

  // corner-bracket detection box; `p` (0..1) drives the lock-on as it first appears
  function detBox(ctx, r, mode, text, p) {
    var e = easeOut(p), pad = 5 + (1 - e) * 14;
    var x = r.l - pad, y = r.t - pad, w = r.r - r.l + pad * 2, h = r.b - r.t + pad * 2, c = COL[mode];
    var dashed = mode === 'missed' || mode === 'wrong', k = Math.min(10, w / 3, h / 3);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.75 * e;
    ctx.fillStyle = c + '1a'; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 1.5; ctx.strokeStyle = c + 'aa';
    if (dashed) ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
    ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
    ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
    ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
    ctx.stroke();
    ctx.globalAlpha = e;
    pill(ctx, text, x, y, mode === 'late' ? '#b45309' : mode === 'good' ? '#15803d' : mode === 'wrong' ? '#c2410c' : '#dc2626', y > 20);
    ctx.restore();
  }

  function impact(ctx, x, y, age, still) {
    var p = still ? 1 : clamp01(age / 0.6);
    ctx.save();
    if (!still && p < 1) {
      ctx.strokeStyle = 'rgba(254,202,202,' + (1 - p) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 8 + 46 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + 0.7 * (1 - p) + ')';
      ctx.beginPath(); ctx.arc(x, y, 16 * (1 - p) + 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(253,186,116,' + (1 - p) + ')'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var i = 0; i < 9; i++) {
        var a = i / 9 * Math.PI * 2 + 0.3, r0 = 10 + 20 * easeOut(p), r1 = r0 + 10;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
      }
    }
    // lasting impact marker
    var s = 0.6 + 0.4 * easeOut(Math.min(1, p * 2));
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#dc2626'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (var j = 0; j < 16; j++) { var rr = j % 2 ? 7 : 15, an = j / 16 * Math.PI * 2; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1);
    ctx.restore();
  }

  function outcomeIcon(ctx, x, y, tone) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (tone === 'good') { ctx.moveTo(-8, 0); ctx.lineTo(-2, 6); ctx.lineTo(9, -6); }
    else if (tone === 'warn') { ctx.moveTo(0, -8); ctx.lineTo(0, 3); ctx.moveTo(0, 9); ctx.lineTo(0, 9.2); }
    else { ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7); }
    ctx.stroke(); ctx.restore();
  }

  G.SimView = function (canvas) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var lastS = null, lastDet = null, seen = {}, skids = [], prevV = 0, prevT = 0, outro = null;
    var treeXs = null, mode = '2d';

    function trees(s) {
      if (treeXs) return treeXs;
      var avoid = s.actors.map(function (a) { return a.type === 'oncoming' ? -9999 : a.x; });
      treeXs = [];
      for (var x = 120; x < G.Sim.P.finishX + 900; x += 210) {
        var tx = x + (hash(x) - 0.5) * 60;
        var clear = avoid.every(function (ax) { return Math.abs(ax - tx) > 70; });
        if (clear) treeXs.push({ x: tx, top: hash(x + 1) < 0.5, r: 11 + hash(x + 2) * 4 });
      }
      return treeXs;
    }

    function track(s) {
      if (s !== lastS) { seen = {}; skids = []; prevV = s.ego.v; prevT = s.t; outro = null; }
      var dt = s.t - prevT;
      if (dt > 0) {
        var decel = (prevV - s.ego.v) / dt;
        if (decel > 180 && s.ego.v > 5) skids.push(s.ego.x - G.Sim.P.egoLen * 0.3);
        prevV = s.ego.v; prevT = s.t;
      }
    }

    function render(s, det) {
      var camX = s.ego.x - EGO_SCREEN_X, f = G.Sim.front(s), still = reduceMotion.matches;
      var sx = function (wx) { return wx - camX; };
      var shake = 0;
      if (!still && s.ego.crashed && s.crashAt != null) shake = Math.max(0, 1 - (s.t - s.crashAt) / 0.6) * 6;
      ctx.save();
      if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

      var blink = still || Math.floor(s.t * 2.5) % 2 === 0;
      if (mode === '3d') {
        G.Sim3D.world(ctx, W, H, s, { still: still, skids: skids, trees: trees(s), blink: blink, impact: impact });
      } else {
        // rooftops
        ctx.fillStyle = '#8fa0b4'; ctx.fillRect(-10, -10, W + 20, 52);
        for (var k = Math.floor(camX / 110) - 1; k * 110 - camX < W + 110; k++) {
          var bx = k * 110 - camX, bw = 96 + hash(k) * 10, tone = ['#a3b2c3', '#97a7ba', '#adbac9', '#9badc0'][Math.floor(hash(k + 9) * 4)];
          ctx.fillStyle = tone; ctx.fillRect(bx, -4, bw, 42);
          ctx.strokeStyle = 'rgba(15,23,42,.18)'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, -4, bw - 2, 42);
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillRect(bx + 10 + hash(k + 3) * 40, 8, 18, 12);
          ctx.fillStyle = 'rgba(15,23,42,.15)'; ctx.fillRect(bx + 12 + hash(k + 3) * 40, 20, 18, 3);
        }
        ctx.fillStyle = 'rgba(15,23,42,.18)'; ctx.fillRect(-10, 38, W + 20, 5);

        // pavements with scrolling slabs
        ctx.fillStyle = '#d7dbe0'; ctx.fillRect(-10, 40, W + 20, 60); ctx.fillRect(-10, 260, W + 20, 60);
        ctx.strokeStyle = 'rgba(100,110,125,.2)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var px = -(camX % 40) - 40; px < W + 40; px += 40) { ctx.moveTo(px, 43); ctx.lineTo(px, 95); ctx.moveTo(px, 265); ctx.lineTo(px, 320); }
        ctx.moveTo(-10, 70); ctx.lineTo(W + 10, 70); ctx.moveTo(-10, 292); ctx.lineTo(W + 10, 292);
        ctx.stroke();
        ctx.fillStyle = '#b4bbc4'; ctx.fillRect(-10, 95, W + 20, 5); ctx.fillRect(-10, 260, W + 20, 5);
        ctx.fillStyle = '#86bb7b'; ctx.fillRect(-10, 320, W + 20, 20);
        ctx.fillStyle = '#6fa868'; ctx.fillRect(-10, 320, W + 20, 3);

        // road
        for (var gx = -(camX % 256) - 256; gx < W + 256; gx += 256) ctx.drawImage(grain, gx, R.top);
        ctx.fillStyle = 'rgba(15,23,42,.12)'; ctx.fillRect(-10, R.top, W + 20, 6);
        ctx.fillStyle = 'rgba(15,23,42,.08)'; ctx.fillRect(-10, R.egoY - 12, W + 20, 6); ctx.fillRect(-10, R.egoY + 8, W + 20, 6);
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-10, R.top + 3, W + 20, 3); ctx.fillRect(-10, R.bottom - 6, W + 20, 3);
        ctx.fillStyle = '#f5c518';
        for (var dx = -(camX % 80) - 80; dx < W + 80; dx += 80) ctx.fillRect(dx, R.mid - 2, 40, 4);

        // skid marks from hard braking
        ctx.fillStyle = 'rgba(17,19,23,.35)';
        skids.forEach(function (wx) {
          var x = sx(wx);
          if (x < -20 || x > W + 20) return;
          ctx.fillRect(x - 3, R.egoY - G.Sim.P.egoW / 2 + 0.5, 6, 4); ctx.fillRect(x - 3, R.egoY + G.Sim.P.egoW / 2 - 4.5, 6, 4);
        });

        // fixed furniture: crosswalk, stop line, finish
        var cw = G.GROUND_TRUTH.filter(function (g) { return g.id === 'ped_cross'; })[0].sim.x;
        ctx.fillStyle = 'rgba(245,247,250,.9)';
        for (var cy = R.top + 8; cy < R.bottom - 10; cy += 24) ctx.fillRect(sx(cw) - 24, cy, 48, 13);
        s.actors.forEach(function (a) {
          if (a.type !== 'light') return;
          ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(sx(a.x) - 3, R.mid + 2, 6, R.bottom - R.mid - 6);
        });
        var fx = sx(G.Sim.P.finishX);
        for (var ky = R.top; ky < R.bottom; ky += 10) for (var kx = 0; kx < 2; kx++) {
          ctx.fillStyle = ((ky / 10 + kx) % 2) ? '#111' : '#fff'; ctx.fillRect(fx + kx * 10, ky, 10, 10);
        }

        // trees on the pavements
        trees(s).forEach(function (t) {
          var x = sx(t.x), y = t.top ? 52 : 308;
          if (x < -30 || x > W + 30) return;
          ctx.fillStyle = 'rgba(15,23,42,.2)'; ctx.beginPath(); ctx.arc(x + 4, y + 4, t.r, 0, Math.PI * 2); ctx.fill();
          var g = ctx.createRadialGradient(x - t.r * 0.35, y - t.r * 0.35, 1, x, y, t.r);
          g.addColorStop(0, '#73c07f'); g.addColorStop(1, '#3f8a4e');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, t.r, 0, Math.PI * 2); ctx.fill();
        });

        // the car's sensor field: what it can "see"
        if (!s.ego.crashed) {
          var ox = EGO_SCREEN_X + G.Sim.P.egoLen / 2 - 6, rg = G.Sim.P.range.good;
          var fan = ctx.createRadialGradient(ox, R.egoY, 0, ox, R.egoY, rg);
          fan.addColorStop(0, 'rgba(125,211,252,.22)'); fan.addColorStop(1, 'rgba(125,211,252,0)');
          ctx.fillStyle = fan;
          ctx.beginPath(); ctx.moveTo(ox, R.egoY); ctx.arc(ox, R.egoY, rg, -0.42, 0.42); ctx.closePath(); ctx.fill();
        }

        // actors
        s.actors.forEach(function (a) {
          if (a.type === 'oncoming' && !a.spawned) return;
          var x = sx(a.x);
          if (x < -120 || x > W + 120) return;
          if (a.type === 'light') trafficLight(ctx, x + 8, a.state);
          else if (a.type === 'static' && a.art.kind === 'sign') signTop(ctx, x, a.y, a.art);
          else if (a.type === 'static' || a.type === 'lead') carTop(ctx, x, a.y, a.w, a.h, a.art.color, { braking: a.type === 'lead' && a.state === 'stopped' });
          else if (a.type === 'oncoming') carTop(ctx, x, a.y, a.w, a.h, a.art.color, { flip: true });
          else if (a.art.kind === 'bike') bikeTop(ctx, x, a.y, a.art);
          else person(ctx, x, a.y, a.w, a.h, a.art.shirt, a.type === 'crosser', still ? 0 : (a.x + a.y) * 0.35);
        });

        // ego car
        carTop(ctx, EGO_SCREEN_X, R.egoY, G.Sim.P.egoLen, G.Sim.P.egoW, '#2563eb', { braking: s.ego.braking, ego: true, hazard: s.ego.crashed && blink });
        if (s.ego.crashed) impact(ctx, EGO_SCREEN_X + G.Sim.P.egoLen / 2 + 4, R.egoY, s.t - s.crashAt, still);
      }

      // detection overlays
      s.actors.forEach(function (a) {
        if (a.type === 'oncoming' && !a.spawned) return;
        var d = det[a.id] || { mode: 'missed', label: a.cls, conf: 0 };
        var dist = (a.type === 'light' ? a.x : a.x - a.w / 2) - f;
        if (dist > G.Sim.P.range.good || dist < -30) return;
        var r;
        if (mode === '3d') {
          r = G.Sim3D.screenRect(a, s, W, H);
          if (!r) return;
        } else {
          r = G.Sim.rectOf(a);
          if (a.type === 'light') r = { l: a.x + 8 - 9, r: a.x + 8 + 9, t: 270, b: 316 };
          else if (a.type === 'static' && a.art.kind === 'sign') r = { l: a.x - 12, r: a.x + 12, t: a.y - 12, b: a.y + 12 };
          r = { l: sx(r.l), r: sx(r.r), t: r.t, b: r.b };
        }
        var pct = Math.round(d.conf * 100);
        if (a.critical && !a.perceived && d.mode !== 'missed') return;
        if (a.critical && d.mode === 'missed' && dist > 200) return;
        if (seen[a.id] == null) seen[a.id] = s.t;
        var p = still ? 1 : (s.t - seen[a.id]) / 0.3;
        if (d.mode === 'good') detBox(ctx, r, 'good', d.label + ' ' + pct + '%', p);
        else if (d.mode === 'late') detBox(ctx, r, 'late', d.label + ' ' + pct + '% (weak)', p);
        else if (d.wrong) detBox(ctx, r, 'wrong', 'Misread as ' + d.label + '?', p);
        else detBox(ctx, r, 'missed', 'NOT DETECTED', p);
      });

      ctx.restore();

      // HUD: speed
      var kmh = Math.round(s.ego.v * 0.3);
      ctx.fillStyle = 'rgba(15,23,42,.82)'; G.roundRect(ctx, 10, 10, 132, 34, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(kmh), 20, 32);
      var nw = ctx.measureText(String(kmh)).width;
      ctx.fillStyle = '#cbd5e1'; ctx.font = '600 11px system-ui'; ctx.fillText('km/h', 24 + nw, 32);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; G.roundRect(ctx, 76, 23, 56, 6, 3); ctx.fill();
      ctx.fillStyle = s.ego.braking ? '#f87171' : '#38bdf8'; G.roundRect(ctx, 76, 23, Math.max(6, 56 * clamp01(kmh / 60)), 6, 3); ctx.fill();

      // HUD: route progress with hazards marked
      var tx0 = 10, tw = W - 20, prog = clamp01(f / G.Sim.P.finishX);
      ctx.fillStyle = 'rgba(15,23,42,.4)'; G.roundRect(ctx, tx0, H - 12, tw, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#38bdf8'; G.roundRect(ctx, tx0, H - 12, Math.max(5, tw * prog), 5, 2.5); ctx.fill();
      s.actors.forEach(function (a) {
        if (!a.critical) return;
        var mx = tx0 + tw * clamp01(a.x / G.Sim.P.finishX);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, H - 9.5, 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx0 + tw * prog, H - 9.5, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // event toasts: slide in, fade out
      var shown = 0;
      for (var i = s.events.length - 1; i >= 0 && shown < 3; i--) {
        var ev = s.events[i], age = s.t - ev.t;
        if (age > 3.5) break;
        var c = ev.kind === 'ok' ? '#15803d' : ev.kind === 'warn' ? '#b45309' : '#dc2626';
        ctx.font = '600 12px system-ui';
        var tW = ctx.measureText(ev.text).width + 30, slide = still ? 0 : (1 - easeOut(age / 0.3)) * 40;
        var ty = 10 + shown * 30, tx = W - tW - 10 + slide;
        ctx.globalAlpha = Math.min(still ? 1 : clamp01(age / 0.2), clamp01((3.5 - age) * 2.5));
        ctx.fillStyle = 'rgba(15,23,42,.25)'; G.roundRect(ctx, tx + 1, ty + 2, tW, 25, 7); ctx.fill();
        ctx.fillStyle = c; G.roundRect(ctx, tx, ty, tW, 25, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(tx + 12, ty + 12.5, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(ev.text, tx + 22, ty + 13);
        ctx.globalAlpha = 1; shown++;
      }

      // outcome card
      if (s.done) {
        var o = G.MESSAGES.outcomes[s.outcome], bc = o.tone === 'good' ? '#15803d' : o.tone === 'warn' ? '#b45309' : '#dc2626';
        var q = still ? 1 : easeOut((performance.now() - outro.t0) / 450);
        ctx.fillStyle = 'rgba(15,23,42,' + 0.5 * q + ')'; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.globalAlpha = q;
        ctx.translate(W / 2, H / 2 + (1 - q) * 12); ctx.scale(0.96 + 0.04 * q, 0.96 + 0.04 * q);
        ctx.fillStyle = 'rgba(15,23,42,.35)'; G.roundRect(ctx, -198, -40, 396, 88, 14); ctx.fill();
        ctx.fillStyle = bc; G.roundRect(ctx, -200, -44, 400, 88, 14); ctx.fill();
        outcomeIcon(ctx, -158, 0, o.tone);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = '800 24px system-ui'; ctx.fillText(o.label.toUpperCase(), -126, -10, 310);
        ctx.font = '600 13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText('Simulated outcome. See the feedback below.', -126, 18, 310);
        ctx.restore();
      }
    }

    function draw(s, det) {
      det = det || {};
      track(s);
      lastS = s; lastDet = det;
      if (s.done && !outro) {
        outro = { t0: performance.now() };
        (function tick() {
          if (lastS !== s || !outro || G.SCENARIO.view !== 'SimView') return;
          render(s, lastDet);
          if (performance.now() - outro.t0 < 460 && !reduceMotion.matches) requestAnimationFrame(tick);
        })();
        return;
      }
      render(s, det);
    }
    this.draw = draw;
    this.setMode = function (m) {
      mode = m;
      if (lastS) render(lastS, lastDet);
    };
  };
})(window.GIGO);
