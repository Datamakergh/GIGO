/* GIGO – chase-camera 3D renderer for the driving simulation (state comes from simulator.js).
 * Plain canvas 2D with a perspective projection: no WebGL, no dependencies.
 * Axes: sim x = forward depth, sim y = lateral (larger = driver's right), h = height above the road. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var R = G.Sim.ROAD, P = G.Sim.P;
  var CAM = { back: 190, lat: -4, h: 70, f: 430, horizon: 0.34 }, NEAR = 18, FAR = 1800;
  var SKY = '#8fb6dd', FOG = '#dbe6ef';

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  var FOGC = rgb(FOG);
  // lighten (amt > 0) or darken (amt < 0), then fade toward the haze colour with distance
  function tone(hex, amt, fog) {
    var c = rgb(hex), t = amt < 0 ? 0 : 255, p = Math.abs(amt), out = [];
    for (var i = 0; i < 3; i++) { var v = c[i] + (t - c[i]) * p; out.push(Math.round(v + (FOGC[i] - v) * fog)); }
    return 'rgb(' + out.join(',') + ')';
  }

  /* ---- camera + primitives ---- */

  var C = null;
  function setCam(s, W, H) { C = { x: R.egoY + CAM.lat, z: s.ego.x - CAM.back, cx: W / 2, hy: Math.round(H * CAM.horizon), W: W, H: H }; }
  function pt(y, Z, h) { return [C.cx + CAM.f * (y - C.x) / Z, C.hy + CAM.f * (CAM.h - h) / Z]; }
  function fogAt(Z) { return clamp01((Z - 650) / (FAR - 650)) * 0.85; }
  function rad(r, Z) { return CAM.f * r / Z; }

  function poly(ctx, pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function circle(ctx, p, r, fill) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

  // flat rectangle on the road plane (or at height h), clipped to the visible depth range
  function ground(ctx, y0, y1, x0, x1, fill, h) {
    var Z0 = Math.max(x0 - C.z, NEAR), Z1 = Math.min(x1 - C.z, FAR);
    if (Z1 <= Z0) return;
    h = h || 0;
    poly(ctx, [pt(y0, Z0, h), pt(y1, Z0, h), pt(y1, Z1, h), pt(y0, Z1, h)], fill);
  }

  // axis-aligned solid; only the faces turned toward the camera are drawn, so their order doesn't matter
  function box(ctx, y0, y1, x0, x1, h0, h1, col) {
    var Z0 = x0 - C.z, Z1 = Math.min(x1 - C.z, FAR);
    if (Z1 <= NEAR || Z0 > FAR) return;
    var Zn = Math.max(Z0, NEAR), fog = fogAt(Zn);
    if (C.x < y0) poly(ctx, [pt(y0, Zn, h0), pt(y0, Z1, h0), pt(y0, Z1, h1), pt(y0, Zn, h1)], tone(col, -0.22, fog));
    if (C.x > y1) poly(ctx, [pt(y1, Zn, h0), pt(y1, Z1, h0), pt(y1, Z1, h1), pt(y1, Zn, h1)], tone(col, -0.22, fog));
    if (CAM.h > h1) poly(ctx, [pt(y0, Zn, h1), pt(y1, Zn, h1), pt(y1, Z1, h1), pt(y0, Z1, h1)], tone(col, 0.14, fog));
    else if (CAM.h < h0) poly(ctx, [pt(y0, Zn, h0), pt(y1, Zn, h0), pt(y1, Z1, h0), pt(y0, Z1, h0)], tone(col, -0.4, fog));
    if (Z0 >= NEAR) poly(ctx, [pt(y0, Z0, h0), pt(y1, Z0, h0), pt(y1, Z0, h1), pt(y0, Z0, h1)], tone(col, 0, fog));
  }

  // rectangle facing the camera at depth x (lights, number plates)
  function face(ctx, y0, y1, x, h0, h1, fill, glow) {
    var Z = x - C.z;
    if (Z < NEAR) return;
    ctx.save();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = Math.min(18, rad(30, Z)); }
    poly(ctx, [pt(y0, Z, h0), pt(y1, Z, h0), pt(y1, Z, h1), pt(y0, Z, h1)], fill);
    ctx.restore();
  }

  /* ---- models ---- */

  function car(ctx, x, y, len, wid, color, o) {
    var d = o.dir || 1, l = len / 2, w = wid / 2, near = x - l, Z = near - C.z;
    if (x + l - C.z <= NEAR) return;
    var fog = fogAt(Math.max(Z, NEAR));
    ground(ctx, y - w + 1, y + w + 4, x - l + 2, x + l + 5, 'rgba(15,23,42,.3)');
    [-0.3, 0.27].forEach(function (k) {
      var wx = x + k * len * d;
      box(ctx, y - w - 1, y - w + 4, wx - 6.5, wx + 6.5, 0, 11, '#15181d');
      box(ctx, y + w - 4, y + w + 1, wx - 6.5, wx + 6.5, 0, 11, '#15181d');
    });
    box(ctx, y - w, y + w, x - l, x + l, 4, 14, color);
    var ca = x + d * -0.32 * len, cb = x + d * 0.13 * len;
    box(ctx, y - w + 3, y + w - 3, Math.min(ca, cb), Math.max(ca, cb), 14, 23.5, '#2b3f55');
    box(ctx, y - w + 4, y + w - 4, Math.min(ca, cb) + 2, Math.max(ca, cb) - 2, 23.5, 25, color);
    if (o.ego) {
      var dz = x - 0.1 * len - C.z;
      if (dz > NEAR) { circle(ctx, pt(y, dz, 27.5), rad(4.5, dz), tone('#0f172a', 0, fog)); circle(ctx, pt(y, dz, 28), rad(2, dz), '#7dd3fc'); }
    }
    if (Z < NEAR) return;
    if (d === 1) {
      var on = o.braking;
      face(ctx, y - w + 2, y - w + 9, near - 0.2, 9, 13, on ? '#ff2d2d' : tone('#8a1c1c', 0, fog), on && 'rgba(255,20,20,.95)');
      face(ctx, y + w - 9, y + w - 2, near - 0.2, 9, 13, on ? '#ff2d2d' : tone('#8a1c1c', 0, fog), on && 'rgba(255,20,20,.95)');
      face(ctx, y - 5, y + 5, near - 0.2, 6, 9.5, tone('#e5e7eb', 0, fog));
    } else {
      face(ctx, y - w + 2, y - w + 9, near - 0.2, 9, 12.5, tone('#fff3c4', 0, fog), 'rgba(255,243,196,.9)');
      face(ctx, y + w - 9, y + w - 2, near - 0.2, 9, 12.5, tone('#fff3c4', 0, fog), 'rgba(255,243,196,.9)');
      face(ctx, y - 6, y + 6, near - 0.2, 6.5, 11, tone('#1f2937', 0, fog));
    }
    if (o.hazard) {
      ctx.save(); ctx.shadowColor = 'rgba(251,191,36,.95)'; ctx.shadowBlur = 12;
      circle(ctx, pt(y - w + 1, Z - 0.5, 13), rad(2.4, Z), '#fbbf24');
      circle(ctx, pt(y + w - 1, Z - 0.5, 13), rad(2.4, Z), '#fbbf24');
      ctx.restore();
    }
  }

  function head(ctx, y, x, h, skin, hair) {
    var Z = x - C.z;
    if (Z < NEAR) return;
    var fog = fogAt(Z), p = pt(y, Z, h), r = rad(3.4, Z);
    circle(ctx, p, r, tone(skin, 0, fog));
    ctx.beginPath(); ctx.arc(p[0], p[1], r, Math.PI, 0); ctx.closePath(); ctx.fillStyle = tone(hair, 0, fog); ctx.fill();
  }

  // `along` is the walking axis: 'x' for pavement walkers, 'y' for road crossers
  function person(ctx, x, y, art, along, phase) {
    var sw = Math.sin(phase) * 3, ax = along === 'x';
    ground(ctx, y - 5, y + 6, x - 4, x + 6, 'rgba(15,23,42,.25)');
    for (var i = -1; i <= 1; i += 2) {
      var ox = ax ? sw * i : i * 2.4, oy = ax ? i * 2.4 : sw * i;
      box(ctx, y + oy - 1.6, y + oy + 1.6, x + ox - 1.6, x + ox + 1.6, 0, 13, art.pants || '#2b3442');
    }
    var hw = ax ? 4.6 : 2.7, hd = ax ? 2.7 : 4.6;
    box(ctx, y - hw, y + hw, x - hd, x + hd, 12.5, 23.5, art.shirt);
    head(ctx, y, x - 0.5, 27, '#e8b892', art.hair || '#3b2a20');
  }

  // a person knocked down by the car: t runs 0 (standing) to 1 (lying, pushed forward)
  function fallenPerson(ctx, x, y, art, t) {
    var e = t * t * (3 - 2 * t), u = 1 - e;
    ground(ctx, y - 5, y + 6, x - 4, x + 6 + 22 * e, 'rgba(15,23,42,.25)');
    var tx = x - 2.7 + 5.4 * u;
    box(ctx, y - 2.6, y + 2.6, tx + 5.4 * u, tx + 5.4 * u + 12 * e + 0.1, 0, 3.2 * e + 13 * u, art.pants || '#2b3442');
    box(ctx, y - 4.6, y + 4.6, tx, tx + 5.4 * u + 12 * e, 12.5 * u, 23.5 * u + 5.5 * e, art.shirt);
    head(ctx, y, x - 0.5 + 24 * e, 27 * u + 4 * e, '#e8b892', art.hair || '#3b2a20');
  }

  function ring(ctx, p, r, col, lw) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); }
  function line(ctx, pts, col, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }

  // the cyclist rides across the road (+y), so the wheels face the camera
  function cyclist(ctx, a, fall) {
    var x = a.x, y = a.y, Z = x - C.z;
    if (Z < NEAR) return;
    if (fall) {
      // topple sideways about the rear wheel's contact point
      var pv = pt(y - 11, Z, 0), e = fall * fall * (3 - 2 * fall);
      ctx.save(); ctx.translate(pv[0], pv[1]); ctx.rotate(e * 1.4); ctx.translate(-pv[0], -pv[1]);
      cyclist(ctx, a);
      ctx.restore();
      return;
    }
    var fog = fogAt(Z), frame = tone(a.art.color || '#10b981', 0, fog), tyre = tone('#1b1f24', 0, fog);
    ground(ctx, y - 18, y + 18, x - 3, x + 5, 'rgba(15,23,42,.25)');
    ring(ctx, pt(y - 11, Z, 7), rad(6.5, Z), tyre, rad(1.8, Z));
    ring(ctx, pt(y + 11, Z, 7), rad(6.5, Z), tyre, rad(1.8, Z));
    line(ctx, [pt(y - 11, Z, 7), pt(y - 2, Z, 15), pt(y + 7, Z, 15), pt(y + 11, Z, 7)], frame, rad(1.6, Z));
    line(ctx, [pt(y - 2, Z, 15), pt(y + 2, Z, 7)], frame, rad(1.6, Z));
    line(ctx, [pt(y + 7, Z, 15), pt(y + 8, Z, 19)], tone('#1f2937', 0, fog), rad(1.6, Z));
    line(ctx, [pt(y - 2, Z - 2, 17), pt(y + 1, Z - 2, 10)], tone(a.art.pants || '#1e293b', 0, fog), rad(2.6, Z));
    var torso = [pt(y - 3, Z - 1, 17), pt(y + 1, Z - 1, 17), pt(y + 6, Z - 1, 26), pt(y + 1, Z - 1, 27)];
    poly(ctx, torso, tone(a.art.shirt, 0, fog));
    line(ctx, [pt(y + 4, Z - 1.5, 24), pt(y + 8, Z - 1.5, 19)], tone(a.art.shirt, -0.2, fog), rad(1.8, Z));
    var hp = pt(y + 5, Z - 1, 30), r = rad(3.4, Z);
    circle(ctx, hp, r, tone('#e8b892', 0, fog));
    ctx.beginPath(); ctx.arc(hp[0], hp[1], r * 1.08, Math.PI, 0); ctx.closePath(); ctx.fillStyle = tone('#ef4444', 0, fog); ctx.fill();
  }

  var LIGHT = { y0: 262, y1: 280, d: 8, h0: 58, h1: 100 };
  function trafficLight(ctx, a) {
    var x = a.x + 8, Z = x - C.z;
    if (Z < NEAR - 10) return;
    var my = (LIGHT.y0 + LIGHT.y1) / 2;
    box(ctx, my - 1.6, my + 1.6, x - 1.6, x + 1.6, 0, LIGHT.h0, '#59616b');
    box(ctx, LIGHT.y0, LIGHT.y1, x - LIGHT.d / 2, x + LIGHT.d / 2, LIGHT.h0, LIGHT.h1, '#161b21');
    var fz = x - LIGHT.d / 2 - 0.3 - C.z;
    if (fz < NEAR) return;
    var lit = a.state === 'red' ? 0 : 2, fog = fogAt(fz);
    ['#ff3b30', '#f5b301', '#22c55e'].forEach(function (c, i) {
      ctx.save();
      if (i === lit) { ctx.shadowColor = c; ctx.shadowBlur = 14; }
      circle(ctx, pt(my, fz, LIGHT.h1 - 8 - i * 13.5), rad(4.6, fz), i === lit ? c : tone(c, -0.72, fog));
      ctx.restore();
    });
  }

  function sign(ctx, a) {
    var x = a.x, y = a.y, Z = x - C.z;
    if (Z < NEAR) return;
    box(ctx, y - 1.2, y + 1.2, x - 1.2, x + 1.2, 0, 30, '#6b7280');
    var p = pt(y, Z - 1.5, 39), k = rad(11, Z) / 12.5, fog = fogAt(Z);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(k, k); ctx.globalAlpha = 1 - fog * 0.75;
    if (a.art.sign === 'speed') {
      circle(ctx, [0, 0], 12, '#fff');
      ring(ctx, [0, 0], 10.3, '#d42626', 3.2);
      ctx.fillStyle = '#111'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('50', 0, 0.5);
    } else {
      poly(ctx, [[0, -13], [13, 0], [0, 13], [-13, 0]], '#1f2937');
      poly(ctx, [[0, -11], [11, 0], [0, 11], [-11, 0]], '#fde047');
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-2, -2.5, 1.6, 0, Math.PI * 2); ctx.arc(2.5, -1, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-2.8, -0.8, 1.6, 5); ctx.fillRect(1.8, 0.4, 1.4, 4);
    }
    ctx.restore();
  }

  function tree(ctx, t) {
    var y = t.top ? 52 : 308, x = t.x, Z = x - C.z;
    if (Z < NEAR) return;
    var fog = fogAt(Z), r = t.r * 1.25;
    ground(ctx, y - r * 0.8, y + r * 0.8 + 4, x - r * 0.6, x + r * 0.9, 'rgba(15,23,42,.18)');
    box(ctx, y - 2, y + 2, x - 2, x + 2, 0, 26, '#6b4f3a');
    circle(ctx, pt(y, Z, 32 + r * 0.6), rad(r, Z), tone('#3f8a4e', 0, fog));
    circle(ctx, pt(y - r * 0.25, Z - 2, 34 + r * 0.8), rad(r * 0.72, Z), tone('#5aa765', 0, fog));
    circle(ctx, pt(y - r * 0.4, Z - 3, 36 + r), rad(r * 0.38, Z), tone('#73c07f', 0, fog));
  }

  var FACADES = ['#c9b8a6', '#a9b6c4', '#d6cbbd', '#9fb0c2', '#bfa58f', '#b7c2b0'];
  function building(ctx, k, left) {
    var x0 = k * 110 + (left ? 0 : 40), bw = 92 + hash(k + (left ? 0 : 50)) * 12, x1 = x0 + bw;
    if (x1 - C.z <= NEAR || x0 - C.z > FAR) return;
    var hh = 70 + Math.floor(hash(k * 3 + (left ? 1 : 7)) * 5) * 22, col = FACADES[Math.floor(hash(k + (left ? 9 : 19)) * FACADES.length)];
    var y0 = left ? -40 : 342, y1 = left ? 36 : 420, fy = left ? y1 + 0.3 : y0 - 0.3;
    box(ctx, y0, y1, x0, x1, 0, hh, col);
    for (var cx = x0 + 9; cx + 12 < x1 - 4; cx += 24) {
      var Za = cx - C.z, Zb = cx + 12 - C.z;
      if (Za < NEAR) continue;
      var fog = fogAt(Za);
      for (var h = 16; h + 12 < hh - 6; h += 22) {
        var lit = hash(cx * 0.37 + h) > 0.8;
        poly(ctx, [pt(fy, Za, h), pt(fy, Zb, h), pt(fy, Zb, h + 12), pt(fy, Za, h + 12)], tone(lit ? '#8fb0cf' : '#40566d', 0, fog));
      }
      if (Za < 600) poly(ctx, [pt(fy, Za, 0), pt(fy, Zb, 0), pt(fy, Zb, 11), pt(fy, Za, 11)], tone('#2c3a48', 0, fog));
    }
  }

  /* ---- scene ---- */

  function world(ctx, W, H, s, env) {
    setCam(s, W, H);
    var hy = C.hy, zA = C.z + NEAR, zB = C.z + FAR;

    // sky and distant skyline
    var sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, SKY); sky.addColorStop(1, FOG);
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, hy + 10);
    var par = C.z * 0.04, k0 = Math.floor(par / 38);
    ctx.fillStyle = '#c4d2df';
    for (var k = k0 - 1; (k - k0) * 38 < W + 80; k++) {
      var bx = k * 38 - par, bh = 8 + hash(k + 400) * 30;
      ctx.fillRect(bx, hy - bh, 30 + hash(k + 401) * 14, bh + 1);
    }

    // ground: plaza, pavements, kerbs, road
    ctx.fillStyle = '#b5bcc2'; ctx.fillRect(-10, hy, W + 20, H - hy + 10);
    ground(ctx, 36, 100, zA, zB, '#d7dbe0');
    ground(ctx, 260, 320, zA, zB, '#d7dbe0');
    ground(ctx, 320, 342, zA, zB, '#86bb7b');
    ground(ctx, R.top, R.bottom, zA, zB, '#434a53');
    ground(ctx, 95, 100, zA, zB, '#b4bbc4', 1.5);
    ground(ctx, 260, 265, zA, zB, '#b4bbc4', 1.5);
    ground(ctx, R.egoY - 13, R.egoY - 7, zA, zB, 'rgba(15,23,42,.12)');
    ground(ctx, R.egoY + 7, R.egoY + 13, zA, zB, 'rgba(15,23,42,.12)');
    ground(ctx, R.top + 3, R.top + 6, zA, zB, 'rgba(255,255,255,.88)');
    ground(ctx, R.bottom - 6, R.bottom - 3, zA, zB, 'rgba(255,255,255,.88)');
    var j;
    for (j = Math.floor(zA / 80); j * 80 < zB; j++) ground(ctx, R.mid - 2, R.mid + 2, j * 80, j * 80 + 40, '#f5c518');
    for (j = Math.floor(zA / 40); j * 40 < C.z + 900; j++) {
      ground(ctx, 38, 95, j * 40, j * 40 + 1.2, 'rgba(100,110,125,.22)');
      ground(ctx, 265, 320, j * 40, j * 40 + 1.2, 'rgba(100,110,125,.22)');
    }

    // road furniture: crosswalk, stop line, finish line, skid marks
    var cw = G.GROUND_TRUTH.filter(function (g) { return g.id === 'ped_cross'; })[0].sim.x;
    for (var cy = R.top + 8; cy < R.bottom - 10; cy += 24) ground(ctx, cy, cy + 13, cw - 24, cw + 24, 'rgba(245,247,250,.92)');
    s.actors.forEach(function (a) { if (a.type === 'light') ground(ctx, R.mid + 2, R.bottom - 4, a.x - 3, a.x + 3, 'rgba(255,255,255,.95)'); });
    for (var ky = R.top; ky < R.bottom; ky += 10) for (var kx = 0; kx < 2; kx++) {
      ground(ctx, ky, ky + 10, P.finishX + kx * 10, P.finishX + kx * 10 + 10, ((ky / 10 + kx) % 2) ? '#111' : '#fff');
    }
    env.skids.forEach(function (wx) {
      ground(ctx, R.egoY - P.egoW / 2 + 0.5, R.egoY - P.egoW / 2 + 4.5, wx - 3, wx + 3, 'rgba(17,19,23,.4)');
      ground(ctx, R.egoY + P.egoW / 2 - 4.5, R.egoY + P.egoW / 2 - 0.5, wx - 3, wx + 3, 'rgba(17,19,23,.4)');
    });

    // haze over the far ground
    var haze = ctx.createLinearGradient(0, hy, 0, hy + CAM.f * CAM.h / 650);
    haze.addColorStop(0, 'rgba(219,230,239,.9)'); haze.addColorStop(1, 'rgba(219,230,239,0)');
    ctx.fillStyle = haze; ctx.fillRect(-10, hy, W + 20, CAM.f * CAM.h / 650 + 1);

    // the car's sensor field: what it can "see"
    if (!s.ego.crashed) {
      var ox = s.ego.x + P.egoLen / 2 - 6, rg = P.range.good, fan = [pt(R.egoY, ox - C.z, 0.5)];
      for (var i = 0; i <= 12; i++) {
        var an = -0.42 + 0.84 * i / 12;
        fan.push(pt(R.egoY + Math.sin(an) * rg, ox + Math.cos(an) * rg - C.z, 0.5));
      }
      var g = ctx.createLinearGradient(0, fan[0][1], 0, fan[7][1]);
      g.addColorStop(0, 'rgba(125,211,252,.32)'); g.addColorStop(1, 'rgba(125,211,252,0)');
      poly(ctx, fan, g);
    }

    // buildings form the backdrop, far to near
    var bk = [];
    for (k = Math.floor((C.z - 160) / 110); k * 110 < zB; k++) bk.push(k);
    bk.reverse().forEach(function (k) { building(ctx, k, true); building(ctx, k, false); });

    // everything standing on the street, painted far to near
    var items = [];
    env.trees.forEach(function (t) { items.push({ z: t.x, fn: function () { tree(ctx, t); } }); });
    s.actors.forEach(function (a) {
      if (a.type === 'oncoming' && !a.spawned) return;
      // skip actors the car has passed: right next to the lens they'd fill the frame
      if (a.x - C.z < CAM.back - P.egoLen / 2 || a.x - C.z > FAR + 60) return;
      var fn;
      if (a.type === 'light') fn = function () { trafficLight(ctx, a); };
      else if (a.type === 'static' && a.art.kind === 'sign') fn = function () { sign(ctx, a); };
      else if (a.type === 'static' || a.type === 'lead') fn = function () { car(ctx, a.x, a.y, a.w, a.h, a.art.color, { braking: a.type === 'lead' && a.state === 'stopped' }); };
      else if (a.type === 'oncoming') fn = function () { car(ctx, a.x, a.y, a.w, a.h, a.art.color, { dir: -1 }); };
      else if (a.art.kind === 'bike') fn = function () { cyclist(ctx, a, a.id === s.crashId ? Math.min(1, (s.t - s.crashAt) / 0.45) : 0); };
      else if (a.id === s.crashId) fn = function () { fallenPerson(ctx, a.x, a.y, a.art, Math.min(1, (s.t - s.crashAt) / 0.45)); };
      else fn = function () { person(ctx, a.x, a.y, a.art, a.type === 'crosser' ? 'y' : 'x', env.still ? 0 : (a.x + a.y) * 0.35); };
      items.push({ z: a.x, fn: fn });
    });
    items.push({ z: s.ego.x, fn: function () {
      car(ctx, s.ego.x, R.egoY, P.egoLen, P.egoW, '#2563eb', { braking: s.ego.braking, ego: true, hazard: s.ego.crashed && env.blink });
    } });
    items.sort(function (a, b) { return b.z - a.z; }).forEach(function (it) { it.fn(); });

    if (s.ego.crashed) {
      var ip = pt(R.egoY, s.ego.x + P.egoLen / 2 + 4 - C.z, 16);
      env.impact(ctx, ip[0], ip[1], s.t - s.crashAt, env.still);
    }
  }

  // screen-space bounding box of an actor, for the detection overlay (null when off screen)
  function screenRect(a, s, W, H) {
    setCam(s, W, H);
    var y0, y1, x0, x1, h0 = 0, h1;
    if (a.type === 'light') { y0 = LIGHT.y0; y1 = LIGHT.y1; x0 = a.x + 8 - LIGHT.d / 2; x1 = x0 + LIGHT.d; h0 = LIGHT.h0; h1 = LIGHT.h1; }
    else if (a.type === 'static' && a.art.kind === 'sign') { y0 = a.y - 11; y1 = a.y + 11; x0 = a.x - 2; x1 = a.x + 2; h0 = 28; h1 = 50; }
    else {
      var r = G.Sim.rectOf(a);
      y0 = r.t; y1 = r.b; x0 = r.l; x1 = r.r;
      h1 = a.type === 'crosser' || a.type === 'walker' ? 31 : 25;
    }
    if (x0 - C.z < NEAR) return null;
    var l = Infinity, rr = -Infinity, t = Infinity, b = -Infinity;
    [y0, y1].forEach(function (y) { [x0, x1].forEach(function (x) { [h0, h1].forEach(function (h) {
      var p = pt(y, x - C.z, h);
      l = Math.min(l, p[0]); rr = Math.max(rr, p[0]); t = Math.min(t, p[1]); b = Math.max(b, p[1]);
    }); }); });
    if (rr < 0 || l > W || b < 0 || t > H) return null;
    return { l: l, r: rr, t: t, b: b };
  }

  G.Sim3D = { world: world, screenRect: screenRect };
})(window.GIGO);
