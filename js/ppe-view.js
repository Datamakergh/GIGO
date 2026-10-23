/* GIGO – draws the warehouse safety-gate simulation (ppe-sim.js) on the shared sim canvas.
 * Side-on corridor: workers walk right towards the PPE zone; the AI camera above the gate boxes
 * what it can see and shows its PPE checklist. Honours prefers-reduced-motion. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var reduceMotion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var COL = { good: '#22c55e', late: '#f59e0b', missed: '#ef4444' };
  var FLOOR = 300, WH = 118;   // feet line and worker height on screen
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function easeOut(p) { p = clamp01(p); return 1 - Math.pow(1 - p, 3); }

  function pill(ctx, text, x, y, color) {
    ctx.font = '700 11px system-ui, sans-serif';
    var w = ctx.measureText(text).width + 12, h = 17;
    ctx.fillStyle = color; G.roundRect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 6, y + h / 2 + 0.5);
    return w;
  }

  function brackets(ctx, x, y, w, h, c, dashed, alpha) {
    var k = Math.min(10, w / 3, h / 3);
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = c; ctx.lineWidth = 2.5;
    if (dashed) { ctx.setLineDash([5, 4]); ctx.strokeRect(x, y, w, h); }
    else {
      ctx.beginPath();
      ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
      ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
      ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
      ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.1; ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function backdrop(ctx, W, H, s, still, now) {
    var P = G.PPESim.P, i;
    // wall
    ctx.fillStyle = '#c3ccd5'; ctx.fillRect(0, 0, W, 205);
    ctx.strokeStyle = 'rgba(60,75,95,.12)'; ctx.lineWidth = 1;
    for (i = 0; i < W; i += 22) { ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, 205); ctx.stroke(); }
    // racking in the zone
    for (var rx = P.zoneX + 40; rx < W; rx += 130) {
      ctx.fillStyle = '#d9822b'; ctx.fillRect(rx, 60, 4, 145); ctx.fillRect(rx + 110, 60, 4, 145);
      for (var ry = 95; ry <= 200; ry += 35) {
        ctx.fillStyle = '#2f5a8c'; ctx.fillRect(rx, ry, 114, 4);
        ctx.fillStyle = ['#c8a26b', '#b98f57'][(rx + ry) % 2]; ctx.fillRect(rx + 10, ry - 22, 40, 22); ctx.fillRect(rx + 60, ry - 18, 40, 18);
      }
    }
    // corridor side: lockers / PPE station
    ctx.fillStyle = '#475569'; G.roundRect(ctx, 40, 110, 120, 95, 4); ctx.fill();
    for (i = 0; i < 4; i++) { ctx.fillStyle = '#64748b'; ctx.fillRect(46 + i * 29, 116, 25, 83); ctx.fillStyle = '#cbd5e1'; ctx.fillRect(66 + i * 29, 150, 2, 10); }
    ctx.fillStyle = '#1d4ed8'; G.roundRect(ctx, 52, 82, 96, 22, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PPE STATION', 100, 93);
    // floor
    ctx.fillStyle = '#b3b8bd'; ctx.fillRect(0, 205, W, H - 205);
    ctx.fillStyle = 'rgba(234,179,8,.16)'; ctx.fillRect(P.zoneX, 205, W - P.zoneX, H - 205);
    ctx.strokeStyle = 'rgba(234,179,8,.35)'; ctx.lineWidth = 6;
    ctx.save(); ctx.beginPath(); ctx.rect(P.zoneX, 205, W - P.zoneX, H - 205); ctx.clip();
    for (i = P.zoneX - 200; i < W + 200; i += 34) { ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + 125, 205); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(15,23,42,.55)'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('PPE ZONE: forklifts operating', P.zoneX + 14, H - 18);
    ctx.fillText('Corridor', 14, H - 18);
    // zone line
    ctx.save(); ctx.beginPath(); ctx.rect(P.zoneX - 5, 205, 10, H - 205); ctx.clip();
    ctx.fillStyle = '#facc15'; ctx.fillRect(P.zoneX - 5, 205, 10, H - 205);
    ctx.fillStyle = '#111827';
    for (i = 205; i < H; i += 16) { ctx.beginPath(); ctx.moveTo(P.zoneX - 5, i); ctx.lineTo(P.zoneX + 5, i + 8); ctx.lineTo(P.zoneX + 5, i + 16); ctx.lineTo(P.zoneX - 5, i + 8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // forklift patrolling in the zone
    var fx = still ? 690 : 650 + Math.sin(now / 1600) * 70;
    ctx.save(); ctx.translate(fx, 232);
    ctx.fillStyle = 'rgba(15,23,42,.22)'; ctx.beginPath(); ctx.ellipse(0, 4, 46, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eab308'; G.roundRect(ctx, -30, -26, 56, 22, 4); ctx.fill();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-24, -26); ctx.lineTo(-20, -54); ctx.lineTo(10, -54); ctx.lineTo(14, -26); ctx.stroke();
    ctx.fillStyle = '#374151'; ctx.fillRect(-38, -64, 5, 62); ctx.fillStyle = '#9ca3af'; ctx.fillRect(-52, -5, 18, 3);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-20, -4, 7, 0, Math.PI * 2); ctx.arc(16, -4, 7, 0, Math.PI * 2); ctx.fill();
    if (!still && Math.floor(now / 300) % 2) { ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(-4, -57, 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function camera(ctx, s, still, now) {
    var P = G.PPESim.P, cx = 330, cy = 26;
    // scan cone over the approach
    var g = ctx.createLinearGradient(0, cy, 0, FLOOR);
    var a = still ? 0.16 : 0.12 + 0.06 * Math.sin(now / 260);
    g.addColorStop(0, 'rgba(56,189,248,' + (a + 0.08) + ')'); g.addColorStop(1, 'rgba(56,189,248,' + a * 0.4 + ')');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.lineTo(P.seeAt.good - 20, FLOOR + 6); ctx.lineTo(P.zoneX, FLOOR + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.fillRect(cx - 2, 0, 4, cy);
    ctx.fillStyle = '#1f2937'; G.roundRect(ctx, cx - 18, cy - 8, 36, 18, 5); ctx.fill();
    ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.arc(cx + 10, cy + 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444'; if (still || Math.floor(now / 500) % 2) { ctx.beginPath(); ctx.arc(cx - 11, cy - 3, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#0f172a'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('AI CAMERA', cx + 24, cy + 1);
  }

  function signal(ctx, s, still, now) {
    var P = G.PPESim.P, x = P.zoneX, top = 108;
    ctx.fillStyle = '#4b5563'; ctx.fillRect(x - 3, top + 60, 6, FLOOR - top - 60);
    ctx.fillStyle = '#111827'; G.roundRect(ctx, x - 26, top, 52, 62, 8); ctx.fill();
    var st = s.signal, blink = still || Math.floor(now / 250) % 2;
    var red = st === 'stop' || (st === 'alarm' && blink), green = st === 'go', amber = st === 'scan' || st === 'idle';
    [[red, '#ef4444', '#3f1d1d', 18], [amber, '#f59e0b', '#3d2f12', 44]].forEach(function (L) {
      ctx.save();
      if (L[0]) { ctx.shadowColor = L[1]; ctx.shadowBlur = 14; }
      ctx.fillStyle = L[0] ? L[1] : L[2]; ctx.beginPath(); ctx.arc(x, top + L[3], 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    if (green) {
      ctx.save(); ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 14; ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(x, top + 44, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    var txt = { idle: 'WAITING', scan: 'SCANNING', go: 'GO', stop: 'STOP', alarm: 'ALARM' }[st];
    var c = { idle: '#64748b', scan: '#0369a1', go: '#15803d', stop: '#dc2626', alarm: '#dc2626' }[st];
    ctx.font = '800 11px system-ui'; var tw = ctx.measureText(txt).width + 14;
    ctx.fillStyle = c; G.roundRect(ctx, x - tw / 2, top - 22, tw, 18, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, top - 12.5);
  }

  function checklist(ctx, w, x, y, p) {
    var rows = w.checks, H = 18 + rows.length * 16, Wd = 140;
    if (x + Wd > 795) x = 795 - Wd;
    ctx.save(); ctx.globalAlpha = easeOut(p);
    ctx.fillStyle = 'rgba(15,23,42,.88)'; G.roundRect(ctx, x, y, Wd, H, 7); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('PPE CHECK', x + 8, y + 10);
    rows.forEach(function (r, i) {
      var ry = y + 24 + i * 16, ok = r.status === 'ok', fake = r.status === 'false';
      ctx.fillStyle = ok ? '#22c55e' : fake ? '#f97316' : '#ef4444';
      ctx.font = '800 11px system-ui'; ctx.fillText(ok ? '✓' : '✗', x + 8, ry);
      ctx.fillStyle = '#fff'; ctx.font = '600 11px system-ui';
      ctx.fillText(r.cls + (ok ? '' : fake ? ' (not seen)' : ' MISSING'), x + 22, ry, Wd - 28);
    });
    ctx.restore();
  }

  G.PPEView = function (canvas) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var lastS = null, lastDet = null, outro = null;

    function render(s, det) {
      var still = reduceMotion.matches, now = performance.now(), P = G.PPESim.P;
      ctx.clearRect(0, 0, W, H);
      backdrop(ctx, W, H, s, still, now);
      camera(ctx, s, still, now);
      signal(ctx, s, still, now);

      s.workers.forEach(function (w) {
        if (w.state === 'queue' || w.state === 'gone') return;
        var top = FLOOR - WH, step = (w.state === 'walk' || w.state === 'pass' || w.state === 'back') && !still ? Math.sin(w.phase) : 0;
        G.drawWorker(ctx, w.spec, w.x, top, WH, step);
        var u = WH / 100, bx = w.x - 20 * u - 4, by = top - 4, bw = 40 * u + 8, bh = WH + 8;
        var inView = w.x > P.seeAt.good - 30 && w.x < P.exitX - 40;
        if (w.seen) {
          var p = still ? 1 : easeOut((s.t - w.seenAt) / 0.35);
          brackets(ctx, bx, by, bw, bh, COL[w.mode], false, 0.3 + 0.7 * p);
          pill(ctx, 'Person ' + Math.round(w.conf * 100) + '%', bx, by - 19, COL[w.mode]);
          if (w.checks && w.state !== 'back') {
            // boxes on the PPE items the AI recognised
            w.checks.forEach(function (r) {
              if (r.status !== 'ok') return;
              var g = { hat: [-11, 2, 22, 9], goggles: [-9, 11.5, 18, 4.5], vest: [-14.5, 23, 29, 32], boots: [-13, 87, 26, 13] }[r.key];
              ctx.strokeStyle = G.classColor(r.cls); ctx.lineWidth = 1.5;
              ctx.strokeRect(w.x + g[0] * u, top + g[1] * u, g[2] * u, g[3] * u);
            });
          }
          if (w.checks && (w.state === 'check' || (w.decided && s.t - w.checkAt < P.checkT + 2.2))) {
            checklist(ctx, w, bx + bw + 6, by + 6, still ? 1 : (s.t - w.checkAt) / 0.3);
          }
        } else if (inView && w.mode === 'missed') {
          brackets(ctx, bx, by, bw, bh, COL.missed, true, 0.85);
          pill(ctx, 'NOT DETECTED', bx, by - 19, COL.missed);
        }
      });

      // incident alarm over the zone
      if (s.alarmAt != null) {
        var age = s.t - s.alarmAt, pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / 140);
        ctx.fillStyle = 'rgba(220,38,38,' + (0.08 + 0.14 * pulse) * Math.max(0, 1 - age / 6) + ')';
        ctx.fillRect(P.zoneX, 0, W - P.zoneX, H);
      }

      // HUD: workers checked
      var done = s.workers.filter(function (w) { return w.decided || w.entered; }).length;
      ctx.fillStyle = 'rgba(15,23,42,.82)'; G.roundRect(ctx, 10, 10, 150, 34, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(done + '/' + s.workers.length, 20, 32);
      ctx.fillStyle = '#cbd5e1'; ctx.font = '600 11px system-ui'; ctx.fillText('workers at gate', 52, 32);

      // event toasts
      var shown = 0;
      for (var i = s.events.length - 1; i >= 0 && shown < 3; i--) {
        var ev = s.events[i], ea = s.t - ev.t;
        if (ea > 3.5) break;
        var c = ev.kind === 'ok' ? '#15803d' : ev.kind === 'warn' ? '#b45309' : '#dc2626';
        ctx.font = '600 12px system-ui';
        var tW = Math.min(W - 190, ctx.measureText(ev.text).width + 30), slide = still ? 0 : (1 - easeOut(ea / 0.3)) * 40;
        var ty = 10 + shown * 30, tx = W - tW - 10 + slide;
        ctx.globalAlpha = Math.min(still ? 1 : clamp01(ea / 0.2), clamp01((3.5 - ea) * 2.5));
        ctx.fillStyle = 'rgba(15,23,42,.25)'; G.roundRect(ctx, tx + 1, ty + 2, tW, 25, 7); ctx.fill();
        ctx.fillStyle = c; G.roundRect(ctx, tx, ty, tW, 25, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(tx + 12, ty + 12.5, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(ev.text, tx + 22, ty + 13, tW - 28);
        ctx.globalAlpha = 1; shown++;
      }

      if (s.done) {
        var o = G.MESSAGES.outcomes[s.outcome], bc = o.tone === 'good' ? '#15803d' : o.tone === 'warn' ? '#b45309' : '#dc2626';
        var q = still ? 1 : easeOut((now - outro.t0) / 450);
        ctx.fillStyle = 'rgba(15,23,42,' + 0.5 * q + ')'; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = q;
        ctx.translate(W / 2, H / 2 + (1 - q) * 12); ctx.scale(0.96 + 0.04 * q, 0.96 + 0.04 * q);
        ctx.fillStyle = bc; G.roundRect(ctx, -200, -44, 400, 88, 14); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '800 24px system-ui'; ctx.fillText(o.label.toUpperCase(), 0, -10, 360);
        ctx.font = '600 13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText('Simulated outcome. See the feedback below.', 0, 18, 360);
        ctx.restore();
      }
    }

    // keep the forklift and lights moving while idle or paused
    var idleRaf = 0;
    function idleLoop() {
      idleRaf = 0;
      var intro = outro && performance.now() - outro.t0 < 460;
      if (!lastS || reduceMotion.matches || (!active && !intro)) return;
      render(lastS, lastDet);
      idleRaf = requestAnimationFrame(idleLoop);
    }
    var active = false;

    function draw(s, det) {
      lastDet = det || {};
      if (s !== lastS) outro = null;
      lastS = s;
      if (s.done && !outro) outro = { t0: performance.now() };
      render(s, lastDet);
      if ((active || outro) && !idleRaf) idleRaf = requestAnimationFrame(idleLoop);
    }
    this.draw = draw;
    this.setMode = function () {};
    this.setActive = function (on) { active = on; if (!on && idleRaf) { cancelAnimationFrame(idleRaf); idleRaf = 0; } else if (on && lastS) draw(lastS, lastDet); };
  };
})(window.GIGO);
