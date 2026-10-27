/* GIGO – draws the drone census (drone-sim.js): the survey map on the left with the drone's camera
 * footprint and lock-on boxes, and a live census panel (AI count vs true count) on the right. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var K = G.ViewKit, COL = { good: '#22c55e', late: '#f59e0b', wrong: '#f97316', missed: '#ef4444' };
  var S = 330 / 500, MW = 800 * S;   // map scale and width on the 800 x 330 canvas

  function drone(ctx, x, y, t, still) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 10, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 11, y - 11); ctx.lineTo(x + 11, y + 11); ctx.moveTo(x + 11, y - 11); ctx.lineTo(x - 11, y + 11); ctx.stroke();
    [[-11, -11], [11, -11], [11, 11], [-11, 11]].forEach(function (p, i) {
      ctx.fillStyle = 'rgba(226,232,240,.35)'; ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 7, 0, Math.PI * 2); ctx.fill();
      var a = still ? i : t / 40 + i;
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + p[0] - Math.cos(a) * 7, y + p[1] - Math.sin(a) * 7); ctx.lineTo(x + p[0] + Math.cos(a) * 7, y + p[1] + Math.sin(a) * 7); ctx.stroke();
    });
    ctx.fillStyle = '#1e293b'; G.roundRect(ctx, x - 6, y - 5, 12, 10, 3); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + 3, y, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  function panel(ctx, s, x, W, H) {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(x, 0, W - x, H);
    ctx.fillStyle = '#94a3b8'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('LIVE CENSUS', x + 16, 26);
    ctx.fillStyle = '#64748b'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'right'; ctx.fillText('AI / TRUE', W - 16, 26);
    var max = 4, y = 46;
    G.DRONE_SPECIES.forEach(function (sp) {
      var ai = s.tally[sp], tr = s.truth[sp], c = G.classColor(sp);
      ctx.textAlign = 'left'; ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px system-ui'; ctx.fillText(sp, x + 16, y + 10);
      ctx.textAlign = 'right'; ctx.font = '800 13px system-ui';
      ctx.fillStyle = s.done ? (ai === tr ? '#4ade80' : '#fbbf24') : '#fff';
      ctx.fillText(ai + ' / ' + tr, W - 16, y + 10);
      var bw = W - x - 32;
      ctx.fillStyle = '#1e293b'; G.roundRect(ctx, x + 16, y + 17, bw, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(148,163,184,.35)'; G.roundRect(ctx, x + 16, y + 17, bw * tr / max, 6, 3); ctx.fill();
      if (ai) { ctx.fillStyle = c; G.roundRect(ctx, x + 16, y + 17, bw * Math.min(ai, max) / max, 6, 3); ctx.fill(); }
      y += 38;
    });
    ctx.fillStyle = '#94a3b8'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('ALERTS', x + 16, y + 12);
    y += 22;
    G.GROUND_TRUTH.filter(function (g) { return g.critical; }).forEach(function (g) {
      var r = s.results[g.id], st = !r ? ['…', '#64748b', 'waiting'] : r === 'alert' ? ['✓', '#4ade80', 'sent'] : r === 'late_alert' ? ['!', '#fbbf24', 'late'] : ['✗', '#f87171', 'missed'];
      ctx.fillStyle = st[1]; ctx.font = '800 13px system-ui'; ctx.textAlign = 'left'; ctx.fillText(st[0], x + 16, y + 10);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '600 12px system-ui'; ctx.fillText(g.cls === 'Lion' ? 'Predator' : 'Poacher', x + 34, y + 10);
      ctx.fillStyle = st[1]; ctx.textAlign = 'right'; ctx.fillText(st[2], W - 16, y + 10);
      y += 22;
    });
  }

  G.DroneView = function (canvas) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, P = G.DroneSim.P;
    return G.makeView(function (s, det, still, now, outroT0) {
      var d = s.drone;
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, MW, H); ctx.clip();
      ctx.drawImage(G.getSceneCanvas(), 0, 0, MW, H);
      // not-yet-surveyed ground is dimmed
      ctx.fillStyle = 'rgba(15,23,42,.42)';
      P.rows.forEach(function (r, i) {
        var y0 = Math.max(0, r - P.half), y1 = Math.min(500, r + P.half);
        if (i > d.row || (i === d.row && d.turning > 0)) ctx.fillRect(0, y0 * S, MW, (y1 - y0) * S);
        else if (i === d.row) {
          var cut = Math.max(-60, Math.min(860, d.x + (d.dir > 0 ? P.half : -P.half)));
          if (d.dir > 0) ctx.fillRect(cut * S, y0 * S, MW - cut * S, (y1 - y0) * S); else ctx.fillRect(0, y0 * S, cut * S, (y1 - y0) * S);
        }
      });
      // what the AI saw
      s.objs.forEach(function (o) {
        if (o.state === 'pending') return;
        var b = o.g.box, x = b.x * S - 3, y = b.y * S - 3, w = b.w * S + 6, h = b.h * S + 6;
        var a = still ? 1 : 0.3 + 0.7 * K.easeOut((s.t - o.seenAt) / 0.35);
        if (o.state === 'missed') { K.brackets(ctx, x, y, w, h, COL.missed, true, 0.9); K.pill(ctx, 'MISSED', x, y - 15, COL.missed, 9); return; }
        var c = o.wrong ? COL.wrong : COL[o.mode];
        K.brackets(ctx, x, y, w, h, c, false, a);
        K.pill(ctx, o.label + (o.wrong ? '?' : ''), x, y - 15, c, 9);
      });
      // alert pulse
      if (s.alert && s.t - s.alert.t < 3) {
        var ag = G.GROUND_TRUTH.filter(function (g) { return g.id === s.alert.id; })[0], pb = ag.box, pul = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / 120);
        ctx.strokeStyle = 'rgba(239,68,68,' + (0.4 + 0.6 * pul) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc((pb.x + pb.w / 2) * S, (pb.y + pb.h / 2) * S, 26 + 6 * pul, 0, Math.PI * 2); ctx.stroke();
        K.pill(ctx, (s.alert.late ? 'LATE ' : '') + ag.alert.toUpperCase(), 10, H - 30, s.alert.late ? '#b45309' : '#dc2626', 11);
      }
      // camera footprint and drone
      if (d.row < P.rows.length || !s.done) {
        var fx = (d.x - P.half) * S, fy = (d.y - P.half) * S, fs = P.half * 2 * S;
        ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(fx, fy, fs, fs);
        K.brackets(ctx, fx, fy, fs, fs, '#ffffff', false, 0.8);
        drone(ctx, d.x * S, d.y * S, now, still);
      }
      K.toasts(ctx, s, MW, MW - 40, still);
      ctx.restore();
      panel(ctx, s, MW, W, H);
      if (s.done && outroT0 != null) K.outcomeCard(ctx, W, H, s, outroT0, still);
    });
  };
})(window.GIGO);
