/* GIGO – draws the predefined road scene (programmatic art: no image files, no licences).
 * Each object is drawn inside its ground-truth box so the answer key is exact. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  G.roundRect = rr;
  G.rng = function (seed) { return rng(seed); };
  G.shade = function (hex, amt) { return shade(hex, amt); };

  // deterministic noise so the scene is identical on every load
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function vgrad(ctx, y0, y1, stops) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }
  function hgrad(ctx, x0, x1, stops) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }

  function shadow(ctx, cx, y, rx) {
    var g = ctx.createRadialGradient(cx, y, 0, cx, y, rx);
    g.addColorStop(0, 'rgba(15,23,42,.42)'); g.addColorStop(0.7, 'rgba(15,23,42,.18)'); g.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.save(); ctx.translate(cx, y); ctx.scale(1, 0.2); ctx.translate(-cx, -y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, y, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function shade(hex, amt) {
    // amt > 0 lightens, < 0 darkens
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return 'rgb(' + Math.round(r + (t - r) * p) + ',' + Math.round(g + (t - g) * p) + ',' + Math.round(b + (t - b) * p) + ')';
  }

  /* ---- objects ---- */

  function drawCar(ctx, b, art) {
    var x = b.x, y = b.y, w = b.w, h = b.h, c = art.color || '#c0392b';
    shadow(ctx, x + w / 2, y + h * 0.96, w * 0.56);
    // wheels (behind body)
    ctx.fillStyle = '#16181c';
    rr(ctx, x + w * 0.05, y + h * 0.78, w * 0.17, h * 0.22, 3); ctx.fill();
    rr(ctx, x + w * 0.78, y + h * 0.78, w * 0.17, h * 0.22, 3); ctx.fill();
    // cabin
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.44);
    ctx.lineTo(x + w * 0.2, y + h * 0.06);
    ctx.quadraticCurveTo(x + w * 0.22, y, x + w * 0.3, y);
    ctx.lineTo(x + w * 0.7, y);
    ctx.quadraticCurveTo(x + w * 0.78, y, x + w * 0.8, y + h * 0.06);
    ctx.lineTo(x + w * 0.88, y + h * 0.44);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, y, y + h * 0.44, [shade(c, 0.08), shade(c, -0.25)]); ctx.fill();
    // glass
    ctx.beginPath();
    ctx.moveTo(x + w * 0.19, y + h * 0.4);
    ctx.lineTo(x + w * 0.25, y + h * 0.1);
    ctx.quadraticCurveTo(x + w * 0.26, y + h * 0.07, x + w * 0.31, y + h * 0.07);
    ctx.lineTo(x + w * 0.69, y + h * 0.07);
    ctx.quadraticCurveTo(x + w * 0.74, y + h * 0.07, x + w * 0.75, y + h * 0.1);
    ctx.lineTo(x + w * 0.81, y + h * 0.4);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, y + h * 0.07, y + h * 0.4, ['#5b7a95', '#22374b']); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.moveTo(x + w * 0.36, y); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.36, y + h * 0.45); ctx.lineTo(x + w * 0.22, y + h * 0.45); ctx.fill();
    ctx.restore();
    // mirrors
    ctx.fillStyle = shade(c, -0.3);
    rr(ctx, x + w * 0.04, y + h * 0.33, w * 0.1, h * 0.09, 2); ctx.fill();
    rr(ctx, x + w * 0.86, y + h * 0.33, w * 0.1, h * 0.09, 2); ctx.fill();
    // body
    rr(ctx, x, y + h * 0.4, w, h * 0.46, h * 0.12);
    ctx.fillStyle = vgrad(ctx, y + h * 0.4, y + h * 0.86, [shade(c, 0.18), c, shade(c, -0.28)]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x + w * 0.06, y + h * 0.43, w * 0.88, h * 0.025);
    // lamps
    var front = art.front, braking = art.braking;
    var lamp = front ? '#fff7d6' : (braking ? '#ff3030' : '#8f1d1d');
    ctx.save();
    if (front || braking) { ctx.shadowColor = front ? 'rgba(255,240,180,.95)' : 'rgba(255,30,30,.95)'; ctx.shadowBlur = 16; }
    ctx.fillStyle = lamp;
    rr(ctx, x + w * 0.05, y + h * 0.5, w * 0.19, h * 0.11, 3); ctx.fill();
    rr(ctx, x + w * 0.76, y + h * 0.5, w * 0.19, h * 0.11, 3); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(x + w * 0.08, y + h * 0.52, w * 0.06, h * 0.03); ctx.fillRect(x + w * 0.79, y + h * 0.52, w * 0.06, h * 0.03);
    // grille or plate
    if (front) {
      rr(ctx, x + w * 0.32, y + h * 0.53, w * 0.36, h * 0.09, 2); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    }
    rr(ctx, x + w * 0.38, y + h * 0.66, w * 0.24, h * 0.09, 2); ctx.fillStyle = '#f2f2ee'; ctx.fill();
    ctx.fillStyle = '#3b3f46'; ctx.fillRect(x + w * 0.42, y + h * 0.695, w * 0.16, h * 0.025);
    // bumper
    rr(ctx, x + w * 0.02, y + h * 0.79, w * 0.96, h * 0.07, h * 0.03); ctx.fillStyle = shade(c, -0.45); ctx.fill();
  }

  function drawPed(ctx, b, art) {
    var cx = b.x + b.w / 2, w = b.w, h = b.h, y = b.y;
    shadow(ctx, cx, y + h * 0.985, w * 0.6);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // legs
    ctx.strokeStyle = art.pants; ctx.lineWidth = w * 0.19;
    ctx.beginPath(); ctx.moveTo(cx - w * 0.11, y + h * 0.58); ctx.lineTo(cx - w * 0.18, y + h * 0.93); ctx.stroke();
    ctx.strokeStyle = shade(art.pants, -0.25);
    ctx.beginPath(); ctx.moveTo(cx + w * 0.11, y + h * 0.58); ctx.lineTo(cx + w * 0.2, y + h * 0.93); ctx.stroke();
    // shoes
    ctx.fillStyle = '#1f2328';
    rr(ctx, cx - w * 0.32, y + h * 0.935, w * 0.24, h * 0.055, 2); ctx.fill();
    rr(ctx, cx + w * 0.1, y + h * 0.935, w * 0.24, h * 0.055, 2); ctx.fill();
    // back arm
    ctx.strokeStyle = shade(art.shirt, -0.25); ctx.lineWidth = w * 0.14;
    ctx.beginPath(); ctx.moveTo(cx + w * 0.26, y + h * 0.27); ctx.lineTo(cx + w * 0.38, y + h * 0.5); ctx.stroke();
    // torso
    rr(ctx, cx - w * 0.3, y + h * 0.2, w * 0.6, h * 0.42, w * 0.2);
    ctx.fillStyle = hgrad(ctx, cx - w * 0.3, cx + w * 0.3, [shade(art.shirt, 0.15), art.shirt, shade(art.shirt, -0.22)]); ctx.fill();
    // front arm + hands
    ctx.strokeStyle = art.shirt; ctx.lineWidth = w * 0.14;
    ctx.beginPath(); ctx.moveTo(cx - w * 0.26, y + h * 0.27); ctx.lineTo(cx - w * 0.38, y + h * 0.5); ctx.stroke();
    ctx.fillStyle = '#e8b892';
    ctx.beginPath(); ctx.arc(cx - w * 0.39, y + h * 0.53, w * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + w * 0.39, y + h * 0.53, w * 0.07, 0, Math.PI * 2); ctx.fill();
    // neck + head
    ctx.fillStyle = '#d9a47e'; ctx.fillRect(cx - w * 0.07, y + h * 0.17, w * 0.14, h * 0.05);
    ctx.fillStyle = '#efc39f';
    ctx.beginPath(); ctx.arc(cx, y + h * 0.11, w * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = art.hair;
    ctx.beginPath(); ctx.arc(cx, y + h * 0.1, w * 0.27, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(cx - w * 0.08, y + h * 0.06, w * 0.08, 0, Math.PI * 2); ctx.fill();
  }

  function wheel(ctx, x, y, r) {
    ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r - 3.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(154,163,173,.7)'; ctx.lineWidth = 0.8;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3.5), y + Math.sin(a) * (r - 3.5)); ctx.stroke();
    }
    ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawBike(ctx, b, art) {
    var wr = b.h * 0.27, y0 = b.y + b.h - wr - 2;
    var lx = b.x + b.w * 0.27, rx = b.x + b.w * 0.73;
    var seat = { x: b.x + b.w * 0.44, y: y0 - wr * 1.05 }, ped = { x: b.x + b.w * 0.5, y: y0 }, bar = { x: b.x + b.w * 0.68, y: y0 - wr * 1.2 };
    shadow(ctx, b.x + b.w / 2, b.y + b.h - 1, b.w * 0.52);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // back leg
    var sh = { x: b.x + b.w * 0.58, y: b.y + b.h * 0.3 };
    ctx.strokeStyle = shade(art.pants, -0.3); ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(seat.x, seat.y); ctx.lineTo(ped.x - 5, ped.y + 4); ctx.stroke();
    wheel(ctx, lx, y0, wr); wheel(ctx, rx, y0, wr);
    // frame
    ctx.strokeStyle = art.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(lx, y0); ctx.lineTo(seat.x, seat.y); ctx.lineTo(bar.x, bar.y); ctx.lineTo(ped.x, ped.y); ctx.lineTo(seat.x, seat.y);
    ctx.moveTo(lx, y0); ctx.lineTo(ped.x, ped.y);
    ctx.moveTo(bar.x, bar.y); ctx.lineTo(rx, y0); ctx.stroke();
    ctx.fillStyle = '#1f2937'; rr(ctx, seat.x - 6, seat.y - 4, 12, 4, 2); ctx.fill();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(bar.x - 2, bar.y - 2); ctx.lineTo(bar.x + 5, bar.y - 4); ctx.stroke();
    ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.arc(ped.x, ped.y, 3, 0, Math.PI * 2); ctx.fill();
    // front leg
    ctx.strokeStyle = art.pants; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(seat.x, seat.y); ctx.lineTo(ped.x + 4, ped.y - 7); ctx.lineTo(ped.x + 6, ped.y + 1); ctx.stroke();
    // torso + arm
    ctx.strokeStyle = art.shirt; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(seat.x, seat.y - 2); ctx.lineTo(sh.x, sh.y); ctx.stroke();
    ctx.strokeStyle = shade(art.shirt, -0.15); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y + 2); ctx.lineTo(bar.x, bar.y); ctx.stroke();
    // head + helmet
    var hx = b.x + b.w * 0.63, hy = b.y + b.h * 0.15;
    ctx.fillStyle = '#efc39f'; ctx.beginPath(); ctx.arc(hx, hy, b.h * 0.085, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.ellipse(hx - 1, hy - 2, b.h * 0.1, b.h * 0.075, -0.15, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(hx - 4, hy - 7, 5, 1.5);
  }

  function drawLight(ctx, b) {
    var cx = b.x + b.w / 2;
    // pole
    ctx.fillStyle = hgrad(ctx, cx - 3.5, cx + 3.5, ['#7b838d', '#4b525b']); ctx.fillRect(cx - 3.5, b.y + b.h - 2, 7, 100);
    // backplate + housing
    rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fillStyle = '#12161b'; ctx.fill();
    rr(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 5); ctx.fillStyle = hgrad(ctx, b.x, b.x + b.w, ['#2b323b', '#1b2027']); ctx.fill();
    var cols = ['#ff3b30', '#3d3315', '#10301a'], r = b.w * 0.27;
    for (var i = 0; i < 3; i++) {
      var ly = b.y + b.h * (0.19 + i * 0.31);
      ctx.fillStyle = '#0b0e12'; ctx.beginPath(); ctx.arc(cx, ly, r + 2, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      if (i === 0) { ctx.shadowColor = 'rgba(255,59,48,.95)'; ctx.shadowBlur = 18; }
      var lg = ctx.createRadialGradient(cx - r * 0.3, ly - r * 0.3, 0, cx, ly, r);
      lg.addColorStop(0, i === 0 ? '#ffb4ad' : shade(cols[i], 0.12)); lg.addColorStop(1, cols[i]);
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, ly, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // visor
      ctx.fillStyle = '#0b0e12';
      ctx.beginPath(); ctx.arc(cx, ly, r + 2.5, Math.PI * 1.08, Math.PI * 1.92); ctx.lineTo(cx + r * 0.7, ly - r * 0.55); ctx.arc(cx, ly, r * 0.9, Math.PI * 1.85, Math.PI * 1.15, true); ctx.closePath(); ctx.fill();
    }
  }

  function drawSign(ctx, b, art) {
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.fillStyle = hgrad(ctx, cx - 2.5, cx + 2.5, ['#8b939c', '#5b626b']); ctx.fillRect(cx - 2.5, b.y + b.h - 2, 5, 80);
    if (art.sign === 'speed') {
      var r = Math.min(b.w, b.h) / 2;
      ctx.fillStyle = '#9ca3ab'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r - 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d42626'; ctx.lineWidth = r * 0.22;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = '800 ' + Math.round(r * 0.88) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('50', cx, cy + 1);
    } else {
      function diamond(inset) {
        ctx.beginPath(); ctx.moveTo(cx, b.y + inset); ctx.lineTo(b.x + b.w - inset, cy); ctx.lineTo(cx, b.y + b.h - inset); ctx.lineTo(b.x + inset, cy); ctx.closePath();
      }
      diamond(0.5); ctx.fillStyle = '#1f2937'; ctx.fill();
      diamond(2.5); ctx.fillStyle = '#fde047'; ctx.fill();
      diamond(4.5); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.2; ctx.stroke();
      // two children walking
      ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx - 4, cy - 7, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - 3); ctx.lineTo(cx - 5, cy + 4); ctx.lineTo(cx - 8, cy + 9);
      ctx.moveTo(cx - 5, cy + 4); ctx.lineTo(cx - 2, cy + 9); ctx.moveTo(cx - 4, cy - 2); ctx.lineTo(cx + 2, cy + 1); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx + 5, cy - 3, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 5, cy + 5); ctx.lineTo(cx + 3, cy + 9); ctx.moveTo(cx + 5, cy + 5); ctx.lineTo(cx + 7, cy + 9); ctx.stroke();
    }
  }

  G.drawObject = function (ctx, g) {
    ctx.save();
    var k = g.art.kind;
    if (k === 'car') drawCar(ctx, g.box, g.art);
    else if (k === 'ped') drawPed(ctx, g.box, g.art);
    else if (k === 'bike') drawBike(ctx, g.box, g.art);
    else if (k === 'light') drawLight(ctx, g.box);
    else if (k === 'sign') drawSign(ctx, g.box, g.art);
    ctx.restore();
  };

  /* ---- backdrop ---- */

  function cloud(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    [[0, 0, 18], [16, -8, 20], [36, -2, 16], [24, 6, 15], [8, 7, 13]].forEach(function (c) {
      ctx.beginPath(); ctx.arc(x + c[0] * s, y + c[1] * s, c[2] * s, 0, Math.PI * 2); ctx.fill();
    });
  }

  function tree(ctx, x, y, r) {
    var g = ctx.createRadialGradient(x, y + r * 0.6, 0, x, y + r * 0.6, r * 1.1);
    g.addColorStop(0, 'rgba(30,60,30,.3)'); g.addColorStop(1, 'rgba(30,60,30,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 1.1, y, r * 2.2, r * 1.2);
    ctx.fillStyle = '#6b4f3a'; ctx.fillRect(x - 2.5, y - r * 0.2, 5, r * 1.15);
    [[-0.45, 0.05, 0.62, '#3f8a4e'], [0.42, 0.08, 0.6, '#3f8a4e'], [0, -0.32, 0.72, '#4a9a59'], [-0.15, -0.1, 0.6, '#55a764'], [0.18, -0.48, 0.38, '#69b977']]
      .forEach(function (c) { ctx.fillStyle = c[3]; ctx.beginPath(); ctx.arc(x + c[0] * r, y - r * 0.4 + c[1] * r, c[2] * r, 0, Math.PI * 2); ctx.fill(); });
  }

  function building(ctx, x, w, h, hz, base, rand) {
    var top = hz - h;
    ctx.fillStyle = base; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(15,23,42,.10)'; ctx.fillRect(x + w * 0.72, top, w * 0.28, h);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x - 1, top - 3, w + 2, 3);
    for (var wy = top + 9; wy < hz - 12; wy += 15) {
      for (var wx = x + 7; wx < x + w - 9; wx += 13) {
        var lit = rand() < 0.18;
        ctx.fillStyle = lit ? 'rgba(255,248,220,.75)' : 'rgba(225,238,250,.55)';
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
  }

  var LEFT = function (y) { return 340 - 440 * (y - 190) / 310; };
  var RIGHT = function (y) { return 460 + 440 * (y - 190) / 310; };

  G.drawScene = function (ctx) {
    var W = G.SCENE.width, H = G.SCENE.height, hz = G.SCENE.horizon, i, rand = rng(7);
    // sky
    ctx.fillStyle = vgrad(ctx, 0, hz, ['#6bb7ea', '#a9d8f4', '#e7f4fb']); ctx.fillRect(0, 0, W, hz);
    var sun = ctx.createRadialGradient(660, 40, 0, 660, 40, 220);
    sun.addColorStop(0, 'rgba(255,250,225,.85)'); sun.addColorStop(0.25, 'rgba(255,246,210,.35)'); sun.addColorStop(1, 'rgba(255,246,210,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, hz);
    cloud(ctx, 80, 46, 1); cloud(ctx, 360, 28, 0.75); cloud(ctx, 520, 70, 0.6);
    // far skyline (hazy)
    var fx = -20;
    for (i = 0; fx < W; i++) {
      var fw = 40 + rand() * 50, fh = 90 + rand() * 70;
      ctx.fillStyle = '#c4d3e2'; ctx.fillRect(fx, hz - fh, fw, fh);
      fx += fw + 2;
    }
    // near skyline
    var bw = [60, 44, 80, 52, 70, 48, 90, 56, 66, 50, 84, 46, 72, 58], bx = -10, hs = [70, 100, 60, 90, 120, 75, 55, 105, 80, 95, 65, 110, 70, 85];
    var tones = ['#97a8bb', '#a8b7c7', '#8e9fb3', '#b0bdcb'];
    for (i = 0; i < bw.length; i++) { building(ctx, bx, bw[i], hs[i], hz, tones[i % tones.length], rand); bx += bw[i] + 4; }
    // horizon haze
    ctx.fillStyle = vgrad(ctx, hz - 50, hz, ['rgba(231,244,251,0)', 'rgba(231,244,251,.55)']); ctx.fillRect(0, hz - 50, W, 50);
    // grass + hedge
    ctx.fillStyle = vgrad(ctx, hz, H, ['#9bc98f', '#86bb7b', '#78ad6d']); ctx.fillRect(0, hz, W, H - hz);
    ctx.fillStyle = '#6fa868'; ctx.fillRect(0, hz, W, 5);
    // trees
    [[20, 175, 20], [120, 168, 24], [560, 172, 18], [770, 170, 26]].forEach(function (t) { tree(ctx, t[0], t[1], t[2]); });

    // pavements with slab joints
    function pave(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath(); }
    ctx.fillStyle = vgrad(ctx, hz, H, ['#cfd4da', '#dde1e5']);
    pave([[318, hz], [340, hz], [-100, H], [-300, H]]); ctx.fill();
    pave([[460, hz], [482, hz], [1100, H], [900, H]]); ctx.fill();
    ctx.strokeStyle = 'rgba(100,110,125,.22)'; ctx.lineWidth = 1;
    for (var t = 0.08; t < 1; t += 0.07) {
      var yy = hz + (H - hz) * t * t;
      var l0 = 318 - 418 * (yy - hz) / (H - hz), l1 = LEFT(yy), r0 = RIGHT(yy), r1 = 482 + 618 * (yy - hz) / (H - hz);
      ctx.beginPath(); ctx.moveTo(l0, yy); ctx.lineTo(l1, yy); ctx.moveTo(r0, yy); ctx.lineTo(r1, yy); ctx.stroke();
    }

    // road
    function roadPath() { ctx.beginPath(); ctx.moveTo(340, hz); ctx.lineTo(460, hz); ctx.lineTo(900, H); ctx.lineTo(-100, H); ctx.closePath(); }
    roadPath(); ctx.fillStyle = vgrad(ctx, hz, H, ['#59606a', '#40464f', '#353a42']); ctx.fill();
    ctx.save(); roadPath(); ctx.clip();
    // asphalt grain
    for (i = 0; i < 1600; i++) {
      var gy = hz + (H - hz) * Math.sqrt(rand()), gx = LEFT(gy) + rand() * (RIGHT(gy) - LEFT(gy));
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)';
      var gs = 0.6 + 1.6 * (gy - hz) / (H - hz); ctx.fillRect(gx, gy, gs, gs);
    }
    // tyre wear in each lane
    [0.25, 0.42, 0.58, 0.75].forEach(function (f) {
      ctx.strokeStyle = 'rgba(20,24,30,.16)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var yy2 = hz; yy2 <= H; yy2 += 10) {
        var p = (yy2 - hz) / (H - hz), xw = LEFT(yy2) + (RIGHT(yy2) - LEFT(yy2)) * f;
        ctx.lineWidth = 2 + 26 * p;
        if (yy2 === hz) ctx.moveTo(xw, yy2); else ctx.lineTo(xw, yy2);
      }
      ctx.stroke();
    });
    // crosswalk stripes, converging to the vanishing point
    var vx = 400, cwT = 398, cwB = 442;
    ctx.fillStyle = 'rgba(245,247,250,.92)';
    for (var sx0 = -140; sx0 < 960; sx0 += 72) {
      var proj = function (xb, y) { return vx + (xb - vx) * (y - hz) / (cwB - hz); };
      ctx.beginPath();
      ctx.moveTo(proj(sx0, cwT), cwT); ctx.lineTo(proj(sx0 + 40, cwT), cwT);
      ctx.lineTo(sx0 + 40, cwB); ctx.lineTo(sx0, cwB); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(0, 386, W, 5);
    // edge lines
    ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(346, hz); ctx.lineTo(-40, H); ctx.moveTo(454, hz); ctx.lineTo(840, H); ctx.stroke();
    // centre dashes
    ctx.fillStyle = '#f5c518';
    for (var td = 0.02; td < 1; td += 0.11) {
      var y1 = hz + (H - hz) * td * td, y2 = hz + (H - hz) * Math.min(1, (td + 0.055) * (td + 0.055));
      var w1 = 0.8 + 7 * td * td, w2 = 0.8 + 7 * Math.min(1, (td + 0.055) * (td + 0.055));
      if (y2 > 380 && y1 < 448) continue; // no dashes through the stop line and crosswalk
      ctx.beginPath(); ctx.moveTo(400 - w1, y1); ctx.lineTo(400 + w1, y1); ctx.lineTo(400 + w2, y2); ctx.lineTo(400 - w2, y2); ctx.closePath(); ctx.fill();
    }
    // distance haze over the far road
    ctx.fillStyle = vgrad(ctx, hz, hz + 70, ['rgba(220,232,242,.35)', 'rgba(220,232,242,0)']); ctx.fillRect(0, hz, W, 70);
    ctx.restore();
    // kerbs
    ctx.strokeStyle = '#aab1ba'; ctx.lineCap = 'butt';
    for (var k2 = 0; k2 < 12; k2++) {
      var ya = hz + (H - hz) * k2 / 12, yb = hz + (H - hz) * (k2 + 1) / 12;
      ctx.lineWidth = 1 + 5 * (k2 + 1) / 12;
      ctx.beginPath(); ctx.moveTo(LEFT(ya), ya); ctx.lineTo(LEFT(yb), yb); ctx.moveTo(RIGHT(ya), ya); ctx.lineTo(RIGHT(yb), yb); ctx.stroke();
    }
    // objects, far to near
    G.GROUND_TRUTH.slice().sort(function (a, b) { return (a.box.y + a.box.h) - (b.box.y + b.box.h); })
      .forEach(function (g) { G.drawObject(ctx, g); });
    // soft vignette for depth
    var vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.45, W / 2, H * 0.55, W * 0.75);
    vg.addColorStop(0, 'rgba(15,23,42,0)'); vg.addColorStop(1, 'rgba(15,23,42,.14)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  };

  var cache = {};
  G.getSceneCanvas = function () {
    var S = G.SCENARIO, id = S ? S.id : 'road';
    if (cache[id]) return cache[id];
    var c = cache[id] = document.createElement('canvas');
    c.width = G.SCENE.width; c.height = G.SCENE.height;
    ((S && S.drawScene) || G.drawScene)(c.getContext('2d'));
    return c;
  };
})(window.GIGO);
