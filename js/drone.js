/* GIGO – drone wildlife census scenario (Maasai Mara, Kenya): classes, ground truth, wording and the
 * top-down savanna art. Each animal is drawn inside its answer-key box, facing left or right. Scene is 800 x 500. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var CLASSES = [
    { id: 'Elephant', color: '#64748b', key: '1' },
    { id: 'Zebra', color: '#0ea5e9', key: '2' },
    { id: 'Giraffe', color: '#ca8a04', key: '3' },
    { id: 'Wildebeest', color: '#7c3aed', key: '4' },
    { id: 'Lion', color: '#ea580c', key: '5' },
    { id: 'Person', color: '#dc2626', key: '6' }
  ];
  var SPECIES = ['Elephant', 'Zebra', 'Giraffe', 'Wildebeest', 'Lion'];

  function A(id, cls, name, box, face, extra) {
    var g = { id: id, cls: cls, name: name, short: name.toLowerCase(), box: box, face: face };
    for (var k in (extra || {})) g[k] = extra[k];
    if (!g.critical) g.warn = 'Not counted, so the census is one ' + cls.toLowerCase() + ' short.';
    return g;
  }
  var GT = [
    A('e1', 'Elephant', 'Elephant (herd, left)', { x: 90, y: 60, w: 96, h: 60 }, 1),
    A('e2', 'Elephant', 'Elephant calf', { x: 215, y: 98, w: 72, h: 46 }, 1),
    A('z1', 'Zebra', 'Zebra (top)', { x: 470, y: 66, w: 52, h: 26 }, -1),
    A('z2', 'Zebra', 'Zebra (middle)', { x: 548, y: 102, w: 52, h: 26 }, -1),
    A('z3', 'Zebra', 'Zebra (lower)', { x: 492, y: 146, w: 52, h: 26 }, 1),
    A('g1', 'Giraffe', 'Giraffe (top right)', { x: 662, y: 58, w: 86, h: 40 }, -1),
    A('g2', 'Giraffe', 'Giraffe (by the river)', { x: 118, y: 268, w: 82, h: 38 }, 1),
    A('w1', 'Wildebeest', 'Wildebeest (front)', { x: 402, y: 266, w: 50, h: 26 }, 1),
    A('w2', 'Wildebeest', 'Wildebeest (right)', { x: 470, y: 300, w: 50, h: 26 }, 1),
    A('w3', 'Wildebeest', 'Wildebeest (back)', { x: 376, y: 322, w: 50, h: 26 }, 1),
    A('lion', 'Lion', 'Lion near the boma', { x: 632, y: 312, w: 58, h: 26 }, 1,
      { critical: true, alert: 'predator alert to herders', short: 'lion near the cattle boma' }),
    A('poacher', 'Person', 'Person with snares', { x: 292, y: 404, w: 30, h: 30 }, 1,
      { critical: true, alert: 'poaching alert to rangers', short: 'person setting snares' })
  ];

  /* ---- drawing (top-down, sun from the top-left so shadows fall down-right) ---- */

  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot || 0, 0, Math.PI * 2); }

  // runs fn in a local frame where the animal faces +x inside a w x h box at the origin
  function local(ctx, b, face, fn) {
    ctx.save();
    if (face < 0) { ctx.translate(b.x + b.w, b.y); ctx.scale(-1, 1); } else ctx.translate(b.x, b.y);
    fn(b.w, b.h);
    ctx.restore();
  }
  function shadow(ctx, w, h, k) {
    ctx.fillStyle = 'rgba(40,30,10,.28)'; ell(ctx, w * 0.5 + 3, h * 0.5 + 3, w * 0.42 * (k || 1), h * 0.42); ctx.fill();
  }

  var DRAW = {
    Elephant: function (ctx, w, h) {
      shadow(ctx, w, h);
      ctx.fillStyle = '#7d7c78'; ell(ctx, w * 0.42, h * 0.5, w * 0.31, h * 0.4); ctx.fill();
      ctx.fillStyle = '#8e8d88'; ell(ctx, w * 0.4, h * 0.46, w * 0.22, h * 0.24); ctx.fill();
      ctx.fillStyle = '#6f6e6a'; ell(ctx, w * 0.72, h * 0.22, w * 0.1, h * 0.2, -0.4); ctx.fill(); ell(ctx, w * 0.72, h * 0.78, w * 0.1, h * 0.2, 0.4); ctx.fill();
      ctx.fillStyle = '#86857f'; ell(ctx, w * 0.77, h * 0.5, w * 0.11, h * 0.2); ctx.fill();
      ctx.strokeStyle = '#6f6e6a'; ctx.lineWidth = Math.max(2, h * 0.09); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.86, h * 0.5); ctx.quadraticCurveTo(w * 0.96, h * 0.52, w * 0.97, h * 0.62); ctx.stroke();
      ctx.strokeStyle = '#f1efe6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.85, h * 0.42); ctx.lineTo(w * 0.92, h * 0.38); ctx.moveTo(w * 0.85, h * 0.58); ctx.lineTo(w * 0.92, h * 0.62); ctx.stroke();
      ctx.strokeStyle = '#5c5b57'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w * 0.11, h * 0.5); ctx.lineTo(w * 0.03, h * 0.55); ctx.stroke();
    },
    Zebra: function (ctx, w, h) {
      shadow(ctx, w, h);
      ctx.fillStyle = '#f4f1ea'; ell(ctx, w * 0.42, h * 0.5, w * 0.3, h * 0.38); ctx.fill();
      ctx.save(); ell(ctx, w * 0.42, h * 0.5, w * 0.3, h * 0.38); ctx.clip();
      ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2;
      for (var i = 0; i < 7; i++) { var sx = w * (0.16 + i * 0.075); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.quadraticCurveTo(sx + 3, h * 0.5, sx, h); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#f4f1ea'; ell(ctx, w * 0.8, h * 0.5, w * 0.13, h * 0.18); ctx.fill();
      ctx.fillStyle = '#1c1917'; ell(ctx, w * 0.93, h * 0.5, w * 0.05, h * 0.13); ctx.fill();
      ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.5); ctx.lineTo(w * 0.86, h * 0.5); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.5); ctx.lineTo(w * 0.02, h * 0.56); ctx.stroke();
    },
    Giraffe: function (ctx, w, h) {
      shadow(ctx, w, h, 1.05);
      ctx.fillStyle = '#d8a657'; ell(ctx, w * 0.27, h * 0.5, w * 0.2, h * 0.4); ctx.fill();
      ctx.strokeStyle = '#d8a657'; ctx.lineWidth = h * 0.24; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.5); ctx.lineTo(w * 0.84, h * 0.5); ctx.stroke();
      ctx.fillStyle = '#d8a657'; ell(ctx, w * 0.9, h * 0.5, w * 0.08, h * 0.16); ctx.fill();
      ctx.fillStyle = '#8b5a2b';
      [[0.18, 0.32], [0.3, 0.3], [0.22, 0.6], [0.34, 0.66], [0.27, 0.46], [0.5, 0.48], [0.62, 0.5], [0.74, 0.48]].forEach(function (p) {
        ell(ctx, w * p[0], h * p[1], w * 0.035, h * 0.07, 0.6); ctx.fill();
      });
      ctx.fillStyle = '#5b3a1a'; ell(ctx, w * 0.9, h * 0.38, 1.6, 1.6); ctx.fill(); ell(ctx, w * 0.9, h * 0.62, 1.6, 1.6); ctx.fill();
      ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w * 0.08, h * 0.5); ctx.lineTo(w * 0.01, h * 0.5); ctx.stroke();
    },
    Wildebeest: function (ctx, w, h) {
      shadow(ctx, w, h);
      ctx.fillStyle = '#5b5148'; ell(ctx, w * 0.42, h * 0.5, w * 0.3, h * 0.38); ctx.fill();
      ctx.strokeStyle = 'rgba(30,25,20,.55)'; ctx.lineWidth = 1;
      for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * (0.38 + i * 0.06), h * 0.2); ctx.lineTo(w * (0.38 + i * 0.06), h * 0.8); ctx.stroke(); }
      ctx.fillStyle = '#2f2924'; ell(ctx, w * 0.82, h * 0.5, w * 0.13, h * 0.2); ctx.fill();
      ctx.strokeStyle = '#d6cfc2'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(w * 0.78, h * 0.35); ctx.quadraticCurveTo(w * 0.76, h * 0.12, w * 0.86, h * 0.14);
      ctx.moveTo(w * 0.78, h * 0.65); ctx.quadraticCurveTo(w * 0.76, h * 0.88, w * 0.86, h * 0.86); ctx.stroke();
      ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.5); ctx.lineTo(w * 0.02, h * 0.46); ctx.stroke();
    },
    Lion: function (ctx, w, h) {
      shadow(ctx, w, h);
      ctx.fillStyle = '#c99a4f'; ell(ctx, w * 0.44, h * 0.5, w * 0.3, h * 0.34); ctx.fill();
      ctx.fillStyle = '#8a5a24'; ell(ctx, w * 0.78, h * 0.5, w * 0.15, h * 0.44); ctx.fill();
      ctx.fillStyle = '#d4a85e'; ell(ctx, w * 0.84, h * 0.5, w * 0.09, h * 0.26); ctx.fill();
      ctx.strokeStyle = '#c99a4f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.5); ctx.quadraticCurveTo(w * 0.06, h * 0.7, w * 0.03, h * 0.62); ctx.stroke();
      ctx.fillStyle = '#5b3a1a'; ell(ctx, w * 0.03, h * 0.62, 2, 2); ctx.fill();
    },
    Person: function (ctx, w, h) {
      ctx.fillStyle = 'rgba(40,30,10,.3)'; ell(ctx, w * 0.56, h * 0.58, w * 0.4, h * 0.36); ctx.fill();
      ctx.fillStyle = '#4b5320'; ell(ctx, w * 0.5, h * 0.5, w * 0.24, h * 0.44); ctx.fill();
      ctx.strokeStyle = '#3f461b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.42, h * 0.12); ctx.lineTo(w * 0.78, h * 0.2); ctx.moveTo(w * 0.42, h * 0.88); ctx.lineTo(w * 0.78, h * 0.8); ctx.stroke();
      ctx.fillStyle = '#7c2d12'; G.roundRect(ctx, w * 0.12, h * 0.3, w * 0.2, h * 0.4, 2); ctx.fill();
      ctx.fillStyle = '#1c1917'; ell(ctx, w * 0.56, h * 0.5, w * 0.17, h * 0.17); ctx.fill();
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(w * 0.9, h * 0.5, w * 0.08, 0, Math.PI * 2); ctx.stroke();
    }
  };

  G.drawAnimal = function (ctx, g, box) { local(ctx, box || g.box, g.face, function (w, h) { DRAW[g.cls](ctx, w, h); }); };

  function acacia(ctx, x, y, r, rand) {
    ctx.fillStyle = 'rgba(40,30,10,.25)'; ell(ctx, x + r * 0.35, y + r * 0.35, r, r * 0.8); ctx.fill();
    ctx.strokeStyle = '#5b4126'; ctx.lineWidth = 3;
    for (var i = 0; i < 5; i++) { var a = i * 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.6); ctx.stroke(); }
    for (var k = 0; k < 9; k++) {
      var ang = rand() * Math.PI * 2, d = rand() * r * 0.55;
      ctx.fillStyle = ['#4d6b2a', '#5a7a31', '#456326'][k % 3];
      ell(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.8, r * 0.45, r * 0.35); ctx.fill();
    }
  }
  function bush(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(40,30,10,.2)'; ell(ctx, x + 3, y + 3, r, r * 0.8); ctx.fill();
    ctx.fillStyle = '#6b7a35'; ell(ctx, x, y, r, r * 0.8); ctx.fill();
    ctx.fillStyle = '#7d8c40'; ell(ctx, x - r * 0.25, y - r * 0.2, r * 0.5, r * 0.4); ctx.fill();
  }

  function drawScene(ctx) {
    var W = 800, H = 500, rand = G.rng(31), i;
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#c2b56f'); bg.addColorStop(0.5, '#b4ab62'); bg.addColorStop(1, '#a9a35c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 22; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(120,130,60,.18)' : 'rgba(210,190,120,.2)';
      ell(ctx, rand() * W, rand() * H, 40 + rand() * 90, 20 + rand() * 40, rand() * 3); ctx.fill();
    }
    ctx.lineWidth = 1;
    for (i = 0; i < 1600; i++) {
      var x = rand() * W, y = rand() * H;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(110,100,50,.35)' : 'rgba(230,215,150,.35)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand() * 4 - 2, y - 3 - rand() * 3); ctx.stroke();
    }
    // river (bottom-left)
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8a7b4c'; ctx.lineWidth = 44;
    ctx.beginPath(); ctx.moveTo(-20, 330); ctx.quadraticCurveTo(150, 380, 210, 520); ctx.stroke();
    ctx.strokeStyle = '#5f8a8b'; ctx.lineWidth = 30; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.setLineDash([10, 14]); ctx.stroke(); ctx.setLineDash([]);
    // dirt track
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(-10, 228); ctx.bezierCurveTo(240, 196, 520, 250, 810, 214); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,95,60,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, 223); ctx.bezierCurveTo(240, 191, 520, 245, 810, 209); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 233); ctx.bezierCurveTo(240, 201, 520, 255, 810, 219); ctx.stroke();
    // cattle boma (thorn-bush ring) bottom-right
    ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 10; ctx.setLineDash([6, 4]);
    ell(ctx, 740, 430, 52, 46); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#b8a67a'; ell(ctx, 740, 430, 44, 38); ctx.fill();
    [[722, 414], [748, 420], [736, 444], [760, 440], [716, 438]].forEach(function (c, k) {
      ctx.fillStyle = ['#7c3f1d', '#f5f5f4', '#3f2a1d', '#a16207', '#f5f5f4'][k]; ell(ctx, c[0], c[1], 7, 4, 0.3); ctx.fill();
    });
    ctx.fillStyle = '#8a6a3a'; ell(ctx, 772, 398, 10, 8); ctx.fill();
    // trees and bushes, away from the animals
    acacia(ctx, 380, 186, 30, rand); acacia(ctx, 40, 160, 26, rand); acacia(ctx, 610, 220, 24, rand);
    acacia(ctx, 560, 440, 34, rand); acacia(ctx, 330, 40, 22, rand); acacia(ctx, 770, 150, 20, rand);
    bush(ctx, 270, 440, 14); bush(ctx, 338, 420, 12); bush(ctx, 260, 330, 10); bush(ctx, 470, 400, 13); bush(ctx, 620, 160, 9);
    // a motorbike hidden by the bushes (not an annotation target)
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(334, 452); ctx.lineTo(356, 446); ctx.stroke();
    ctx.fillStyle = '#1f2937'; ell(ctx, 330, 453, 4, 3); ctx.fill(); ell(ctx, 360, 445, 4, 3); ctx.fill();
    GT.forEach(function (g) { G.drawAnimal(ctx, g); });
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, 'rgba(30,25,10,0)'); vg.addColorStop(1, 'rgba(30,25,10,.18)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  G.DRONE_SPECIES = SPECIES;
  G.SCENARIOS.drone = {
    id: 'drone', label: 'Drone wildlife census', tagline: 'Count the Herd, Guard the Park',
    classes: CLASSES, groundTruth: GT, drawScene: drawScene,
    sim: 'DroneSim', view: 'DroneView', has3d: false,
    card: { issue: 'Conservation', title: 'Drone wildlife census', place: 'Maasai Mara, Kenya', blurb: 'Count animals from the air and flag poachers and predators.',
      tags: ['Object detection', 'Counting'] },
    outcomes: {
      safe: { label: 'Accurate census', tone: 'good', text: 'Every animal counted, every alert sent on time.' },
      warnings: { label: 'Census is off', tone: 'warn', text: 'Missed or mixed-up animals skewed the counts.' },
      near_miss: { label: 'Late alert', tone: 'bad', text: 'A threat was flagged, but too late to act on.' },
      collision: { label: 'Alert missed', tone: 'bad', text: 'A poacher or predator went unseen.' }
    },
    outcomeLabel: 'Census outcome',
    disclaimer: 'Educational simulation driven by simple rules, not a real AI model.',
    task: 'Box all 12 animals and people, then run the drone survey.',
    annotLabel: 'Aerial savanna scene to annotate',
    simTitle: 'Drone survey',
    simLabel: 'Drone wildlife census simulation',
    idle: '<strong>Drone ready.</strong><p>It only counts what you labelled.</p>',
    resultTitle: 'Census result', resultEmpty: 'Run to see the census.',
    stats: [['Alerts missed', 'alertsMissed'], ['Late alerts', 'lateAlerts'], ['Not counted', 'missed'], ['Species mix-ups', 'mixups'], ['Unsure counts', 'uncertain']],
    critical: {
      alert_missed: 'The drone never flagged the {short}, so no {alert} was sent.',
      late_alert: 'The loose box meant the {short} was flagged late.'
    },
    minor: {
      mixup: 'Counted as the wrong species, so two totals are off.',
      uncertain: 'Counted with low confidence, so the total needs a manual check.'
    },
    advice: {
      critical: 'Label people and predators first: they trigger alerts.',
      wrongClass: 'Zebra vs wildebeest is easy to confuse from above. Check stripes and horns.',
      allGood: 'Every animal counted and both alerts sent on time.'
    }
  };
})(window.GIGO);
