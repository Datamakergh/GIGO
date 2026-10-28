/* GIGO – draws the maize field timelapse (crop-sim.js): a top-down field of plants on the left, the scout's
 * scan line and diagnosis tags, spray mist, spreading disease, and a day counter + harvest panel on the right. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var K = G.ViewKit, CELL = 80, FW = 560, OY = 5;   // CELL is the plant spacing across a row; row spacing stretches to fill the canvas height
  var LEAF = { healthy: '#4f9a2c', treated: '#4f9a2c', sick: '#b59a2c', lost: '#7a5a32' };

  function plant(ctx, x, y, st, disease, t, still) {
    var col = LEAF[st], n = 7, sway = still ? 0 : Math.sin(t / 700 + x * 0.05) * 0.06;
    if (st === 'sick') col = disease === 'Fall Armyworm' || disease === 'Lethal Necrosis' ? '#c2a23a' : '#9aa23a';
    ctx.fillStyle = 'rgba(40,25,10,.3)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 5, 24, 20, 0, 0, Math.PI * 2); ctx.fill();
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + sway, len = st === 'lost' ? 16 : 26;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -6, len, 0); ctx.quadraticCurveTo(len * 0.5, 6, 0, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len - 3, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = st === 'lost' ? '#5a3f22' : '#3f7a22'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    if (st === 'sick') { ctx.fillStyle = G.classColor(disease); ctx.beginPath(); ctx.arc(x + 12, y - 12, 4, 0, Math.PI * 2); ctx.fill(); }
  }

  function panel(ctx, s, x, W, H) {
    var P = G.CropSim.P, total = s.plants.length;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(x, 0, W - x, H);
    var day = s.t <= P.scanT ? 0 : Math.min(21, Math.round((s.t - P.scanT) / P.weekT * 7));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#94a3b8'; ctx.font = '800 11px system-ui'; ctx.fillText(s.t <= P.scanT ? 'AI SCOUT SCANNING' : 'TIMELAPSE', x + 16, 26);
    ctx.fillStyle = '#fff'; ctx.font = '800 30px system-ui'; ctx.fillText('Day ' + day, x + 16, 62);
    ctx.fillStyle = '#1e293b'; G.roundRect(ctx, x + 16, 72, W - x - 32, 6, 3); ctx.fill();
    ctx.fillStyle = '#22c55e'; G.roundRect(ctx, x + 16, 72, (W - x - 32) * day / 21, 6, 3); ctx.fill();
    var lost = s.plants.filter(function (p) { return p.status === 'lost'; }).length;
    var sick = s.plants.filter(function (p) { return p.status === 'sick'; }).length;
    var rows = [
      ['Healthy plants', total - lost - sick, '#4ade80'],
      ['Sick plants', sick, sick ? '#fbbf24' : '#64748b'],
      ['Plants lost', lost, lost ? '#f87171' : '#64748b'],
      ['Wasted sprays', s.stats.wasted, s.stats.wasted ? '#fbbf24' : '#64748b'],
      ['Wrong treatments', s.stats.wrongTx, s.stats.wrongTx ? '#fbbf24' : '#64748b']
    ];
    rows.forEach(function (r, i) {
      var y = 108 + i * 28;
      ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'left'; ctx.fillText(r[0], x + 16, y);
      ctx.fillStyle = r[2]; ctx.font = '800 14px system-ui'; ctx.textAlign = 'right'; ctx.fillText(String(r[1]), W - 16, y);
    });
    if (s.done) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('YIELD SAVED', x + 16, 266);
      ctx.fillStyle = s.yieldPct >= 95 ? '#4ade80' : s.yieldPct >= 80 ? '#fbbf24' : '#f87171'; ctx.font = '800 34px system-ui'; ctx.fillText(s.yieldPct + '%', x + 16, 304);
    }
  }

  G.CropView = function (canvas) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, P = G.CropSim.P;
    return G.makeView(function (s, det, still, now, outroT0) {
      ctx.clearRect(0, 0, W, H);
      var CY = (H - 2 * OY) / P.rows;
      // soil with furrows
      ctx.fillStyle = '#6b4a2c'; ctx.fillRect(0, 0, FW, H);
      for (var r = 0; r < P.rows; r++) { ctx.fillStyle = 'rgba(40,25,10,.28)'; ctx.fillRect(0, OY + r * CY + CY / 2 - 14, FW, 28); }
      s.plants.forEach(function (p) {
        var x = p.c * CELL + CELL / 2, y = OY + p.r * CY + CY / 2;
        plant(ctx, x, y, p.status, p.disease, now, still);
        if (p.spreadAt != null && s.t - p.spreadAt < 1.2) {
          ctx.strokeStyle = 'rgba(239,68,68,' + (1 - (s.t - p.spreadAt) / 1.2) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.stroke();
        }
        var sprayT = p.treatAt != null ? p.treatAt : p.sprayAt;
        if (sprayT != null && s.t - sprayT < 1.4) {
          var q = (s.t - sprayT) / 1.4;
          ctx.fillStyle = 'rgba(125,211,252,' + 0.45 * (1 - q) + ')'; ctx.beginPath(); ctx.arc(x, y, 18 + 22 * q, 0, Math.PI * 2); ctx.fill();
        }
        if (p.gt && p.scanned) {
          var good = p.tag && p.tag === p.gt.cls, unsure = p.tag && /\?$/.test(p.tag) && p.mode === 'late';
          var c = good ? '#22c55e' : unsure ? '#f59e0b' : p.tag ? '#f97316' : '#ef4444';
          var a = still ? 1 : 0.3 + 0.7 * K.easeOut((s.t - p.scanAt) / 0.35);
          K.brackets(ctx, x - 34, y - 34, 68, 68, c, !p.tag, a);
          ctx.globalAlpha = a; K.pill(ctx, p.tag || 'NOT SEEN', x - 34, y + 22, c, 9); ctx.globalAlpha = 1;
        }
      });
      if (s.t <= P.scanT && !s.done) {
        var sx = s.scanX * FW;
        var g = ctx.createLinearGradient(sx - 60, 0, sx, 0);
        g.addColorStop(0, 'rgba(56,189,248,0)'); g.addColorStop(1, 'rgba(56,189,248,.28)');
        ctx.fillStyle = g; ctx.fillRect(sx - 60, 0, 60, H);
        ctx.fillStyle = '#38bdf8'; ctx.fillRect(sx - 2, 0, 3, H);
      }
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FW, H); ctx.clip(); K.toasts(ctx, s, FW, FW - 40, still); ctx.restore();
      panel(ctx, s, FW, W, H);
      if (s.done && outroT0 != null) K.outcomeCard(ctx, W, H, s, outroT0, still);
    });
  };
})(window.GIGO);
