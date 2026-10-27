/* GIGO – small drawing helpers shared by the drone and crop simulation views:
 * label pills, lock-on brackets, event toasts, the end-of-run outcome card and an idle animation loop. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var reduceMotion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function easeOut(p) { p = clamp01(p); return 1 - Math.pow(1 - p, 3); }

  function pill(ctx, text, x, y, color, size) {
    var fs = size || 11;
    ctx.font = '700 ' + fs + 'px system-ui, sans-serif';
    var w = ctx.measureText(text).width + 12, h = fs + 6;
    ctx.fillStyle = color; G.roundRect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 6, y + h / 2 + 0.5);
    return w;
  }

  function brackets(ctx, x, y, w, h, c, dashed, alpha) {
    var k = Math.min(10, w / 3, h / 3);
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = c; ctx.lineWidth = 2;
    if (dashed) { ctx.setLineDash([5, 4]); ctx.strokeRect(x, y, w, h); }
    else {
      ctx.beginPath();
      ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
      ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
      ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
      ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.12; ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  // the latest sim events as sliding toasts in the top-right corner of an area
  function toasts(ctx, s, right, maxW, still) {
    var shown = 0;
    for (var i = s.events.length - 1; i >= 0 && shown < 3; i--) {
      var ev = s.events[i], ea = s.t - ev.t;
      if (ea > 3.5) break;
      var c = ev.kind === 'ok' ? '#15803d' : ev.kind === 'warn' ? '#b45309' : '#dc2626';
      ctx.font = '600 12px system-ui';
      var tW = Math.min(maxW, ctx.measureText(ev.text).width + 30), slide = still ? 0 : (1 - easeOut(ea / 0.3)) * 40;
      var ty = 10 + shown * 30, tx = right - tW - 10 + slide;
      ctx.globalAlpha = Math.min(still ? 1 : clamp01(ea / 0.2), clamp01((3.5 - ea) * 2.5));
      ctx.fillStyle = c; G.roundRect(ctx, tx, ty, tW, 25, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(tx + 12, ty + 12.5, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(ev.text, tx + 22, ty + 13, tW - 28);
      ctx.globalAlpha = 1; shown++;
    }
  }

  function outcomeCard(ctx, W, H, s, t0, still) {
    var o = G.MESSAGES.outcomes[s.outcome], bc = o.tone === 'good' ? '#15803d' : o.tone === 'warn' ? '#b45309' : '#dc2626';
    var q = still ? 1 : easeOut((performance.now() - t0) / 450);
    ctx.fillStyle = 'rgba(15,23,42,' + 0.5 * q + ')'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = q;
    ctx.translate(W / 2, H / 2 + (1 - q) * 12); ctx.scale(0.96 + 0.04 * q, 0.96 + 0.04 * q);
    ctx.fillStyle = bc; G.roundRect(ctx, -200, -44, 400, 88, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 24px system-ui'; ctx.fillText(o.label.toUpperCase(), 0, -10, 360);
    ctx.font = '600 13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(s.summary || 'See the feedback below.', 0, 18, 360);
    ctx.restore();
  }

  /* Wraps a render(s, det, still, now, outroT0) function into the view API app.js expects:
   * draw(s, det), setMode(), setActive(on). Keeps animating while active (idle rotors, pulses). */
  G.makeView = function (render) {
    var lastS = null, lastDet = null, outro = null, raf = 0, active = false;
    function paint() { render(lastS, lastDet, reduceMotion.matches, performance.now(), outro ? outro.t0 : null); }
    function loop() {
      raf = 0;
      var intro = outro && performance.now() - outro.t0 < 460;
      if (!lastS || reduceMotion.matches || (!active && !intro)) return;
      paint(); raf = requestAnimationFrame(loop);
    }
    return {
      draw: function (s, det) {
        lastDet = det || {};
        if (s !== lastS) outro = null;
        lastS = s;
        if (s.done && !outro) outro = { t0: performance.now() };
        paint();
        if ((active || outro) && !raf) raf = requestAnimationFrame(loop);
      },
      setMode: function () {},
      setActive: function (on) {
        active = on;
        if (!on && raf) { cancelAnimationFrame(raf); raf = 0; } else if (on && lastS) this.draw(lastS, lastDet);
      }
    };
  };

  G.ViewKit = { pill: pill, brackets: brackets, toasts: toasts, outcomeCard: outcomeCard, easeOut: easeOut, clamp01: clamp01 };
})(window.GIGO);
