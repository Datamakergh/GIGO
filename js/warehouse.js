/* GIGO – warehouse PPE scenario: classes, ground truth, wording and the warehouse scene art.
 * Worker geometry is computed once (wGeom) and used for both the ground-truth boxes and the drawing,
 * so every PPE item sits exactly inside its answer-key box. Scene is 800 x 500 like the road scene. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var CLASSES = [
    { id: 'Person', color: '#3b82f6', key: '1' },
    { id: 'Hard Hat', color: '#ca8a04', key: '2' },
    { id: 'Goggles', color: '#a855f7', key: '3' },
    { id: 'Safety Vest', color: '#ea580c', key: '4' },
    { id: 'Safety Boots', color: '#10b981', key: '5' }
  ];
  var ITEMS = [
    { key: 'hat', cls: 'Hard Hat', noun: 'hard hat' },
    { key: 'goggles', cls: 'Goggles', noun: 'safety goggles' },
    { key: 'vest', cls: 'Safety Vest', noun: 'hi-vis vest' },
    { key: 'boots', cls: 'Safety Boots', noun: 'safety boots' }
  ];

  /* The three workers. `wears` is what they actually have on: the AI gate should stop anyone missing an item. */
  var WORKERS = [
    { id: 'w1', name: 'Worker A (left)', short: 'worker A', cx: 165, top: 165, h: 300,
      skin: '#c68e6a', hair: '#2b1d14', shirt: '#1e3a5f', pants: '#334155',
      wears: { hat: '#facc15', goggles: true, vest: '#c6f432', boots: true } },
    { id: 'w2', name: 'Worker B (centre)', short: 'worker B', cx: 420, top: 185, h: 265,
      skin: '#8d5b3e', hair: '#111', shirt: '#7c2d12', pants: '#1f2937',
      wears: { hat: '#f8fafc', goggles: false, vest: '#fb923c', boots: true } },
    { id: 'w3', name: 'Worker C (right)', short: 'worker C', cx: 650, top: 200, h: 240,
      skin: '#efc39f', hair: '#8a5a2b', shirt: '#64748b', pants: '#3f3f46',
      wears: { hat: null, goggles: true, vest: null, boots: true } }
  ];

  // item and body geometry in scene pixels for a worker centred on cx, head at top, height h
  function wGeom(cx, top, h) {
    var u = h / 100;
    return {
      u: u,
      person: { x: cx - 20 * u, y: top, w: 40 * u, h: 100 * u },
      hat: { x: cx - 11 * u, y: top + 2 * u, w: 22 * u, h: 9 * u },
      goggles: { x: cx - 9 * u, y: top + 11.5 * u, w: 18 * u, h: 4.5 * u },
      vest: { x: cx - 14.5 * u, y: top + 23 * u, w: 29 * u, h: 32 * u },
      boots: { x: cx - 13 * u, y: top + 87 * u, w: 26 * u, h: 13 * u }
    };
  }
  function rbox(b) { return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }; }

  var GT = [];
  WORKERS.forEach(function (w) {
    var g = wGeom(w.cx, w.top, w.h);
    var missing = ITEMS.filter(function (it) { return !w.wears[it.key]; }).map(function (it) { return it.noun; });
    GT.push({ id: w.id, name: w.name, short: w.short, cls: 'Person', critical: true, box: rbox(g.person),
      worker: w, missingPPE: missing });
    ITEMS.forEach(function (it) {
      if (!w.wears[it.key]) return;
      GT.push({ id: w.id + '_' + it.key, name: w.name.split(' (')[0] + ': ' + it.noun, short: it.noun, cls: it.cls,
        box: rbox(g[it.key]), of: w.id, item: it.key,
        warn: 'Unlabelled, so ' + w.short + ' was wrongly flagged as missing the ' + it.noun + '.' });
    });
  });

  /* ---- drawing ---- */

  var rr = function () { return G.roundRect.apply(null, arguments); };
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return 'rgb(' + Math.round(r + (t - r) * p) + ',' + Math.round(g + (t - g) * p) + ',' + Math.round(b + (t - b) * p) + ')';
  }
  function hgrad(ctx, x0, x1, stops) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }
  function vgrad(ctx, y0, y1, stops) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }

  /* Front-facing worker. `step` (-1..1) swings the legs for walking in the sim view. */
  G.drawWorker = function (ctx, w, cx, top, h, step) {
    var g = wGeom(cx, top, h), u = g.u, W = w.wears, s = step || 0;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // shadow
    var sg = ctx.createRadialGradient(cx, top + 99 * u, 0, cx, top + 99 * u, 17 * u);
    sg.addColorStop(0, 'rgba(15,23,42,.38)'); sg.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.save(); ctx.translate(cx, top + 99 * u); ctx.scale(1, 0.18); ctx.translate(-cx, -(top + 99 * u));
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, top + 99 * u, 17 * u, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // legs
    var ll = s * 2.5 * u, rl = -s * 2.5 * u;
    ctx.strokeStyle = shade(w.pants, -0.2); ctx.lineWidth = 7 * u;
    ctx.beginPath(); ctx.moveTo(cx + 5 * u, top + 57 * u); ctx.lineTo(cx + 6.5 * u + rl, top + 89 * u); ctx.stroke();
    ctx.strokeStyle = w.pants;
    ctx.beginPath(); ctx.moveTo(cx - 5 * u, top + 57 * u); ctx.lineTo(cx - 6.5 * u + ll, top + 89 * u); ctx.stroke();
    // boots
    [[-1, ll], [1, rl]].forEach(function (p) {
      var bx = p[0] < 0 ? cx - 13 * u + p[1] : cx + 1 * u + p[1], by = top + 87 * u;
      if (W.boots) {
        rr(ctx, bx, by, 12 * u, 13 * u, 2.5 * u);
        ctx.fillStyle = vgrad(ctx, by, by + 13 * u, ['#5b3a1e', '#3b2412']); ctx.fill();
        ctx.fillStyle = '#1c1917'; rr(ctx, bx - 0.3 * u, by + 10.5 * u, 12.6 * u, 2.5 * u, 1 * u); ctx.fill();
        ctx.fillStyle = '#facc15'; rr(ctx, (p[0] < 0 ? bx : bx + 6 * u), by + 7 * u, 6 * u, 3.4 * u, 1.4 * u); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.6 * u;
        ctx.beginPath(); ctx.moveTo(bx + 3 * u, by + 2.5 * u); ctx.lineTo(bx + 9 * u, by + 2.5 * u); ctx.moveTo(bx + 3 * u, by + 4.5 * u); ctx.lineTo(bx + 9 * u, by + 4.5 * u); ctx.stroke();
      } else {
        ctx.fillStyle = '#e5e7eb'; rr(ctx, bx, by + 6 * u, 12 * u, 6 * u, 2.5 * u); ctx.fill();
      }
    });
    // arms (behind torso at the shoulder, outside it below)
    var as = -s * 2 * u;
    ctx.strokeStyle = shade(w.shirt, -0.15); ctx.lineWidth = 5.2 * u;
    ctx.beginPath(); ctx.moveTo(cx - 13 * u, top + 26 * u); ctx.lineTo(cx - 16.5 * u - as * 0.3, top + 53 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 13 * u, top + 26 * u); ctx.lineTo(cx + 16.5 * u + as * 0.3, top + 53 * u); ctx.stroke();
    ctx.fillStyle = w.skin;
    ctx.beginPath(); ctx.arc(cx - 16.5 * u - as * 0.3, top + 55.5 * u, 2.4 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 16.5 * u + as * 0.3, top + 55.5 * u, 2.4 * u, 0, Math.PI * 2); ctx.fill();
    // torso + belt
    rr(ctx, cx - 14 * u, top + 23 * u, 28 * u, 34 * u, 5 * u);
    ctx.fillStyle = hgrad(ctx, cx - 14 * u, cx + 14 * u, [shade(w.shirt, 0.12), w.shirt, shade(w.shirt, -0.22)]); ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.fillRect(cx - 13.5 * u, top + 54 * u, 27 * u, 2.6 * u);
    // hi-vis vest
    if (W.vest) {
      var vx = cx - 14.5 * u, vy = top + 23 * u, vw = 29 * u, vh = 32 * u;
      ctx.beginPath();
      ctx.moveTo(vx + 3 * u, vy); ctx.lineTo(cx - 3.5 * u, vy); ctx.lineTo(cx, vy + 11 * u); ctx.lineTo(cx + 3.5 * u, vy);
      ctx.lineTo(vx + vw - 3 * u, vy); ctx.quadraticCurveTo(vx + vw, vy, vx + vw, vy + 4 * u);
      ctx.lineTo(vx + vw, vy + vh - 2 * u); ctx.quadraticCurveTo(vx + vw, vy + vh, vx + vw - 2 * u, vy + vh);
      ctx.lineTo(vx + 2 * u, vy + vh); ctx.quadraticCurveTo(vx, vy + vh, vx, vy + vh - 2 * u);
      ctx.lineTo(vx, vy + 4 * u); ctx.quadraticCurveTo(vx, vy, vx + 3 * u, vy); ctx.closePath();
      ctx.fillStyle = hgrad(ctx, vx, vx + vw, [shade(W.vest, 0.15), W.vest, shade(W.vest, -0.18)]); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(vx, vy + 17 * u, vw, 2.6 * u); ctx.fillRect(vx, vy + 24 * u, vw, 2.6 * u);
      ctx.fillRect(cx - 9.5 * u, vy, 2.6 * u, 17 * u); ctx.fillRect(cx + 6.9 * u, vy, 2.6 * u, 17 * u);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(vx, vy + 17 * u, vw, 0.7 * u); ctx.fillRect(vx, vy + 24 * u, vw, 0.7 * u);
      ctx.restore();
      ctx.strokeStyle = 'rgba(15,23,42,.25)'; ctx.lineWidth = 0.6 * u;
      ctx.beginPath(); ctx.moveTo(cx, vy + 11 * u); ctx.lineTo(cx, vy + vh); ctx.stroke();
    }
    // neck + head
    ctx.fillStyle = shade(w.skin, -0.12); ctx.fillRect(cx - 2.8 * u, top + 19 * u, 5.6 * u, 4.5 * u);
    ctx.fillStyle = w.skin; ctx.beginPath(); ctx.ellipse(cx, top + 13 * u, 7 * u, 7.8 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(w.skin, -0.15);
    ctx.beginPath(); ctx.arc(cx - 7 * u, top + 13.5 * u, 1.3 * u, 0, Math.PI * 2); ctx.arc(cx + 7 * u, top + 13.5 * u, 1.3 * u, 0, Math.PI * 2); ctx.fill();
    if (!W.hat) {
      ctx.fillStyle = w.hair;
      ctx.beginPath(); ctx.ellipse(cx, top + 10.5 * u, 7.4 * u, 6 * u, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      ctx.fillRect(cx - 7.4 * u, top + 9.5 * u, 2 * u, 3 * u); ctx.fillRect(cx + 5.4 * u, top + 9.5 * u, 2 * u, 3 * u);
    }
    // eyes + mouth (eyes hidden by goggles when worn)
    if (!W.goggles) {
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.arc(cx - 2.8 * u, top + 13.6 * u, 0.9 * u, 0, Math.PI * 2); ctx.arc(cx + 2.8 * u, top + 13.6 * u, 0.9 * u, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = shade(w.skin, -0.35); ctx.lineWidth = 0.8 * u;
    ctx.beginPath(); ctx.moveTo(cx - 2 * u, top + 17.6 * u); ctx.lineTo(cx + 2 * u, top + 17.6 * u); ctx.stroke();
    // goggles
    if (W.goggles) {
      var gy = top + 11.5 * u;
      ctx.fillStyle = '#111827'; ctx.fillRect(cx - 9 * u, gy + 1.6 * u, 18 * u, 1.3 * u);
      rr(ctx, cx - 7.8 * u, gy, 15.6 * u, 4.5 * u, 1.8 * u); ctx.fillStyle = '#1e293b'; ctx.fill();
      rr(ctx, cx - 7 * u, gy + 0.6 * u, 6.4 * u, 3.3 * u, 1.3 * u); ctx.fillStyle = 'rgba(125,211,252,.85)'; ctx.fill();
      rr(ctx, cx + 0.6 * u, gy + 0.6 * u, 6.4 * u, 3.3 * u, 1.3 * u); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(cx - 6 * u, gy + 1 * u, 2 * u, 0.7 * u); ctx.fillRect(cx + 1.6 * u, gy + 1 * u, 2 * u, 0.7 * u);
    }
    // hard hat
    if (W.hat) {
      ctx.fillStyle = vgrad(ctx, top + 2 * u, top + 9 * u, [shade(W.hat, 0.25), W.hat, shade(W.hat, -0.15)]);
      ctx.beginPath(); ctx.ellipse(cx, top + 9.2 * u, 8.6 * u, 7.2 * u, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(W.hat, -0.1); ctx.fillRect(cx - 1 * u, top + 2.4 * u, 2 * u, 6.8 * u);
      rr(ctx, cx - 11 * u, top + 8.5 * u, 22 * u, 2.5 * u, 1.2 * u); ctx.fillStyle = shade(W.hat, -0.22); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(cx - 3.5 * u, top + 5 * u, 2.4 * u, 1.2 * u, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  function rack(ctx, x, w, top, base) {
    var levels = 4, lh = (base - top) / levels;
    ctx.fillStyle = 'rgba(15,23,42,.06)'; ctx.fillRect(x, top, w, base - top);
    for (var l = 0; l < levels; l++) {
      var y = top + l * lh;
      // stock on the shelf
      for (var bx = x + 6; bx < x + w - 24; bx += 30) {
        var bw = 22 + ((bx * 7 + l * 13) % 5), bh = lh * (0.45 + ((bx + l * 31) % 4) * 0.08);
        ctx.fillStyle = ['#c8a26b', '#b98f57', '#d4b07a'][(bx + l) % 3];
        ctx.fillRect(bx, y + lh - bh - 3, bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(bx, y + lh - bh - 3, bw, 2);
        ctx.fillStyle = 'rgba(80,50,20,.25)'; ctx.fillRect(bx + bw / 2 - 1, y + lh - bh - 3, 2, bh);
      }
      ctx.fillStyle = '#2f5a8c'; ctx.fillRect(x, y + lh - 3, w, 4);
    }
    ctx.fillStyle = '#d9822b';
    for (var ux = x; ux <= x + w; ux += w / 2) ctx.fillRect(ux - 2, top - 4, 4, base - top + 4);
  }

  function forklift(ctx, x, y) {
    // parked, facing left; x,y = rear-wheel ground point
    ctx.fillStyle = 'rgba(15,23,42,.25)'; ctx.beginPath(); ctx.ellipse(x - 20, y + 2, 52, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#374151'; ctx.fillRect(x - 78, y - 70, 5, 70);
    ctx.fillStyle = '#9ca3af'; ctx.fillRect(x - 92, y - 6, 22, 3);
    ctx.fillStyle = '#eab308'; rr(ctx, x - 70, y - 30, 66, 24, 4); ctx.fill();
    ctx.fillStyle = '#ca8a04'; rr(ctx, x - 14, y - 40, 18, 34, 3); ctx.fill();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 60, y - 30); ctx.lineTo(x - 56, y - 62); ctx.lineTo(x - 22, y - 62); ctx.lineTo(x - 18, y - 30); ctx.stroke();
    ctx.fillStyle = '#1f2937'; ctx.fillRect(x - 46, y - 40, 14, 10);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(x - 56, y - 6, 8, 0, Math.PI * 2); ctx.arc(x - 12, y - 6, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.beginPath(); ctx.arc(x - 56, y - 6, 3, 0, Math.PI * 2); ctx.arc(x - 12, y - 6, 3, 0, Math.PI * 2); ctx.fill();
  }

  function ppeSign(ctx, x, y, w, h) {
    rr(ctx, x, y, w, h, 6); ctx.fillStyle = '#1d4ed8'; ctx.fill();
    rr(ctx, x + 3, y + 3, w - 6, h - 6, 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 10px system-ui, sans-serif'; ctx.fillText('PPE REQUIRED BEYOND THIS POINT', x + w / 2, y + 13, w - 12);
    // pictograms: hat, goggles, vest, boot
    var cy = y + h - 15, step = w / 5;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    var px = x + step;
    ctx.beginPath(); ctx.ellipse(px, cy + 2, 8, 7, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(px - 10, cy + 1, 20, 3);
    px += step; rr(ctx, px - 9, cy - 3, 8, 7, 2); ctx.fill(); rr(ctx, px + 1, cy - 3, 8, 7, 2); ctx.fill();
    px += step; ctx.beginPath(); ctx.moveTo(px - 8, cy - 7); ctx.lineTo(px - 3, cy - 7); ctx.lineTo(px, cy - 1); ctx.lineTo(px + 3, cy - 7); ctx.lineTo(px + 8, cy - 7); ctx.lineTo(px + 8, cy + 8); ctx.lineTo(px - 8, cy + 8); ctx.closePath(); ctx.fill();
    px += step; ctx.beginPath(); ctx.moveTo(px - 6, cy - 8); ctx.lineTo(px + 1, cy - 8); ctx.lineTo(px + 1, cy + 2); ctx.lineTo(px + 9, cy + 4); ctx.lineTo(px + 9, cy + 8); ctx.lineTo(px - 6, cy + 8); ctx.closePath(); ctx.fill();
  }

  function drawScene(ctx) {
    var W = 800, H = 500, base = 235, i;
    // back wall: insulated steel panels
    ctx.fillStyle = vgrad(ctx, 0, base, ['#cfd6de', '#b9c3cd']); ctx.fillRect(0, 0, W, base);
    ctx.strokeStyle = 'rgba(60,75,95,.14)'; ctx.lineWidth = 1;
    for (i = 0; i < W; i += 22) { ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, base); ctx.stroke(); }
    // clerestory windows
    for (i = 30; i < W; i += 150) {
      ctx.fillStyle = '#e8f3fb'; ctx.fillRect(i, 14, 110, 26);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(i + 4, 18, 30, 18);
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(i, 14, 110, 26);
      ctx.beginPath(); ctx.moveTo(i + 55, 14); ctx.lineTo(i + 55, 40); ctx.stroke();
    }
    // roof beam + hanging lights
    ctx.fillStyle = '#64748b'; ctx.fillRect(0, 0, W, 8);
    [120, 400, 680].forEach(function (lx) {
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, 8); ctx.lineTo(lx, 50); ctx.stroke();
      ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.moveTo(lx - 16, 60); ctx.lineTo(lx - 6, 50); ctx.lineTo(lx + 6, 50); ctx.lineTo(lx + 16, 60); ctx.closePath(); ctx.fill();
      var lg = ctx.createRadialGradient(lx, 62, 0, lx, 62, 90);
      lg.addColorStop(0, 'rgba(255,250,220,.55)'); lg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = lg; ctx.fillRect(lx - 90, 60, 180, 90);
    });
    // racking
    rack(ctx, 8, 300, 70, base - 4);
    rack(ctx, 500, 290, 70, base - 4);
    // roller door
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(330, 92, 150, base - 92);
    ctx.fillStyle = vgrad(ctx, 100, base, ['#f1f5f9', '#dbe7f0']); ctx.fillRect(338, 100, 134, base - 100);
    ctx.fillStyle = 'rgba(100,116,139,.35)';
    for (i = 100; i < 150; i += 6) ctx.fillRect(338, i, 134, 2);
    ppeSign(ctx, 328, 46, 154, 46);
    // wall base hazard stripe
    ctx.save(); ctx.beginPath(); ctx.rect(0, base - 8, W, 8); ctx.clip();
    ctx.fillStyle = '#facc15'; ctx.fillRect(0, base - 8, W, 8);
    ctx.fillStyle = '#111827';
    for (i = -10; i < W; i += 16) { ctx.beginPath(); ctx.moveTo(i, base); ctx.lineTo(i + 8, base); ctx.lineTo(i + 16, base - 8); ctx.lineTo(i + 8, base - 8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // concrete floor
    ctx.fillStyle = vgrad(ctx, base, H, ['#a9adb2', '#bfc3c7', '#cdd0d3']); ctx.fillRect(0, base, W, H - base);
    var vx = 405, vy = 150;
    ctx.strokeStyle = 'rgba(70,80,95,.18)'; ctx.lineWidth = 1;
    for (i = -600; i <= 1400; i += 110) {
      var x0 = vx + (i - vx) * (base - vy) / (H - vy);
      ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(i, H); ctx.stroke();
    }
    for (var t = 0.1; t < 1; t += 0.16) { var yy = base + (H - base) * t * t; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    // reflections of the lights
    [120, 400, 680].forEach(function (lx) {
      var rg = ctx.createRadialGradient(lx, 300, 0, lx, 300, 120);
      rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(lx - 120, base, 240, 160);
    });
    // green pedestrian walkway with yellow edges, leading to the door
    function walk(xb) { return vx + (xb - vx) * (base - vy) / (H - vy); }
    ctx.fillStyle = 'rgba(34,197,94,.22)';
    ctx.beginPath(); ctx.moveTo(walk(250), base); ctx.lineTo(walk(560), base); ctx.lineTo(560, H); ctx.lineTo(250, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#eab308'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(walk(250), base); ctx.lineTo(250, H); ctx.moveTo(walk(560), base); ctx.lineTo(560, H); ctx.stroke();
    // zone line across the floor in front of the door
    ctx.fillStyle = '#eab308'; ctx.fillRect(walk(250), base + 10, walk(560) - walk(250), 4);
    // floor scuffs (deterministic)
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (i = 0; i < 500; i++) {
      var sy = base + (H - base) * Math.sqrt(rnd()), sx = rnd() * W;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
      ctx.fillRect(sx, sy, 1 + rnd() * 2, 1);
    }
    // parked forklift (background, not an annotation target) and a pallet
    forklift(ctx, 795, 262);
    ctx.fillStyle = '#a16207'; ctx.fillRect(250, 300, 70, 6); ctx.fillRect(250, 312, 70, 5);
    ctx.fillStyle = '#854d0e'; ctx.fillRect(252, 306, 8, 6); ctx.fillRect(281, 306, 8, 6); ctx.fillRect(310, 306, 8, 6);
    ctx.fillStyle = '#c8a26b'; ctx.fillRect(256, 262, 28, 38); ctx.fillRect(286, 270, 30, 30);
    ctx.fillStyle = 'rgba(80,50,20,.25)'; ctx.fillRect(269, 262, 2, 38); ctx.fillRect(300, 270, 2, 30);
    // workers, far to near
    WORKERS.slice().sort(function (a, b) { return (a.top + a.h) - (b.top + b.h); })
      .forEach(function (w) { G.drawWorker(ctx, w, w.cx, w.top, w.h, 0); });
    var vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.45, W / 2, H * 0.55, W * 0.75);
    vg.addColorStop(0, 'rgba(15,23,42,0)'); vg.addColorStop(1, 'rgba(15,23,42,.14)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  G.PPE_ITEMS = ITEMS;
  G.SCENARIOS.warehouse = {
    id: 'warehouse', label: 'Warehouse PPE', tagline: 'Train the AI, Keep the Floor Safe',
    classes: CLASSES, groundTruth: GT, drawScene: drawScene,
    sim: 'PPESim', view: 'PPEView', has3d: false,
    card: { issue: 'Workplace safety', title: 'Warehouse PPE gate', place: 'Distribution centre', blurb: 'Check workers for hard hats, goggles, vests and boots.',
      tags: ['Object detection', 'Safety'] },
    outcomes: {
      safe: { label: 'All checks correct', tone: 'good', text: 'Everyone checked, unsafe workers stopped.' },
      warnings: { label: 'Checked with warnings', tone: 'warn', text: 'No one unsafe got in, but there were false alarms or late checks.' },
      near_miss: { label: 'Near miss', tone: 'bad', text: 'An unequipped worker was caught inside the zone.' },
      collision: { label: 'Safety incident', tone: 'bad', text: 'An unequipped worker walked in unseen.' }
    },
    outcomeLabel: 'Safety outcome',
    disclaimer: 'Educational simulation driven by simple rules, not a real AI model.',
    task: 'Box every worker and only the PPE they really wear (12 objects), then run the gate.',
    annotLabel: 'Warehouse scene to annotate',
    simTitle: 'AI safety gate',
    simLabel: 'Warehouse PPE safety-gate simulation',
    idle: '<strong>The gate is waiting.</strong><p>It only sees what you labelled.</p>',
    resultTitle: 'Safety gate result', resultEmpty: 'Run to see the gate.',
    stats: [['Safety incidents', 'incidents'], ['Near misses', 'nearMisses'], ['False alarms', 'falseAlarms'], ['Late checks', 'lateChecks'], ['Unchecked entries', 'unchecked']],
    critical: {
      incident: 'Never seen, so {short} walked into the zone without full PPE.',
      near_miss: 'Loose box: {short} was spotted only inside the zone, without full PPE.',
      late_check: 'Loose box: {short} was checked inside the zone, not at the gate.',
      unchecked: 'Never seen, so {short} walked in unchecked (luckily in full PPE).'
    },
    minor: { not_checked: 'The worker was never seen, so this item was never checked.' },
    advice: {
      critical: 'Box the workers first. If the AI cannot see a person, it cannot check their PPE.',
      wrongClass: 'Check each class: hard hats, goggles and vests sit close together.',
      allGood: 'Every worker and item found. The gate stopped everyone missing PPE.'
    }
  };
})(window.GIGO);
