/* GIGO – maize disease scenario (Kenyan smallholder farm): classes, ground truth, wording and the close-up
 * maize art. Every leaf in the picture is an annotation target; each is drawn inside its answer-key box. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var CLASSES = [
    { id: 'Healthy', color: '#16a34a', key: '1' },
    { id: 'Fall Armyworm', color: '#dc2626', key: '2' },
    { id: 'Lethal Necrosis', color: '#ca8a04', key: '3' },
    { id: 'Grey Leaf Spot', color: '#64748b', key: '4' },
    { id: 'Maize Streak', color: '#7c3aed', key: '5' }
  ];
  var CRITICAL = { 'Fall Armyworm': 1, 'Lethal Necrosis': 1 };
  var STALKS = [120, 290, 460, 630];

  // dir 1 = leaf grows right from its stalk, -1 = left. cell = where this plant sits in the simulated field.
  var LEAVES = [
    ['l1', 'Healthy', { x: 122, y: 70, w: 140, h: 52 }, 1, [0, 0]],
    ['l2', 'Fall Armyworm', { x: 292, y: 84, w: 140, h: 52 }, 1, [2, 1]],
    ['l3', 'Grey Leaf Spot', { x: 462, y: 66, w: 140, h: 52 }, 1, [4, 0]],
    ['l4', 'Healthy', { x: 632, y: 80, w: 140, h: 52 }, 1, [6, 0]],
    ['l5', 'Maize Streak', { x: 6, y: 196, w: 112, h: 50 }, -1, [0, 3]],
    ['l6', 'Lethal Necrosis', { x: 148, y: 206, w: 140, h: 52 }, -1, [5, 2]],
    ['l7', 'Healthy', { x: 318, y: 192, w: 140, h: 52 }, -1, [3, 3]],
    ['l8', 'Fall Armyworm', { x: 488, y: 208, w: 140, h: 52 }, -1, [1, 2]],
    ['l9', 'Lethal Necrosis', { x: 122, y: 330, w: 140, h: 52 }, 1, [6, 3]],
    ['l10', 'Grey Leaf Spot', { x: 632, y: 326, w: 140, h: 52 }, 1, [2, 3]]
  ];
  var WHERE = ['top', 'top', 'top', 'top', 'middle', 'middle', 'middle', 'middle', 'bottom', 'bottom'];
  var COLS = ['left', 'centre-left', 'centre-right', 'right'];
  var GT = LEAVES.map(function (l, i) {
    var sx = l[3] > 0 ? l[2].x - 2 : l[2].x + l[2].w + 2, col = COLS[STALKS.indexOf(sx)];
    var g = { id: l[0], cls: l[1], box: l[2], dir: l[3], cell: l[4], critical: !!CRITICAL[l[1]],
      name: l[1] + ' leaf (' + WHERE[i] + ', ' + col + ')', short: l[1].toLowerCase() + ' plant' };
    if (!g.critical) {
      g.warn = l[1] === 'Healthy' ? 'The AI had no healthy example here, so it sprayed a healthy plant.'
        : 'Not treated, so this plant was lost.';
    }
    return g;
  });

  /* ---- drawing ---- */

  function leafPath(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.2);
    ctx.quadraticCurveTo(w * 0.45, -h * 0.12, w, h * 0.88);
    ctx.quadraticCurveTo(w * 0.5, h * 0.82, 0, h * 0.62);
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry, r) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r || 0, 0, Math.PI * 2); }

  var SYMPTOM = {
    'Healthy': function () {},
    'Fall Armyworm': function (ctx, w, h, rand) {
      for (var i = 0; i < 9; i++) {
        var x = w * (0.15 + rand() * 0.7), y = h * (0.3 + rand() * 0.35);
        ctx.fillStyle = 'rgba(236,240,200,.85)'; ell(ctx, x, y, 3 + rand() * 6, 2 + rand() * 3, rand()); ctx.fill();
        if (i % 2) { ctx.fillStyle = '#3b2f1e'; ell(ctx, x + 1, y, 2 + rand() * 3, 1.5 + rand() * 2, rand()); ctx.fill(); }
      }
      ctx.fillStyle = '#4a3b22';
      for (var k = 0; k < 14; k++) { ctx.fillRect(w * (0.2 + rand() * 0.6), h * (0.35 + rand() * 0.3), 1.6, 1.6); }
      // the caterpillar
      var cx = w * 0.56, cy = h * 0.44;
      for (var s = 0; s < 6; s++) { ctx.fillStyle = s % 2 ? '#6b5a3a' : '#7d6a46'; ell(ctx, cx + s * 4, cy + Math.sin(s) * 1.2, 3.4, 3, 0); ctx.fill(); }
      ctx.fillStyle = '#2b2116'; ell(ctx, cx + 24, cy, 3.4, 3, 0); ctx.fill();
      ctx.strokeStyle = '#e7dcc0'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 1.5); ctx.lineTo(cx + 22, cy - 1.5); ctx.stroke();
    },
    'Lethal Necrosis': function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(234,214,90,.25)'); g.addColorStop(0.55, 'rgba(234,204,70,.75)'); g.addColorStop(1, 'rgba(160,110,50,.95)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,80,30,.8)'; ctx.lineWidth = 5; leafPath(ctx, w, h); ctx.stroke();
      ctx.fillStyle = 'rgba(110,70,30,.9)'; ctx.beginPath(); ctx.moveTo(w * 0.82, h * 0.4); ctx.lineTo(w, h * 0.88); ctx.lineTo(w * 0.78, h * 0.8); ctx.fill();
    },
    'Grey Leaf Spot': function (ctx, w, h, rand) {
      for (var i = 0; i < 16; i++) {
        var x = w * (0.1 + rand() * 0.75), y = h * (0.3 + rand() * 0.35), L = 8 + rand() * 12;
        ctx.save(); ctx.translate(x, y); ctx.rotate(0.35 + x / w * 0.45);
        ctx.fillStyle = 'rgba(176,164,140,.95)'; ctx.fillRect(-L / 2, -1.6, L, 3.2);
        ctx.strokeStyle = 'rgba(110,90,60,.7)'; ctx.lineWidth = 0.7; ctx.strokeRect(-L / 2, -1.6, L, 3.2);
        ctx.restore();
      }
    },
    'Maize Streak': function (ctx, w, h, rand) {
      ctx.strokeStyle = 'rgba(240,230,120,.9)'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 3]);
      for (var i = 0; i < 9; i++) {
        var off = h * (0.24 + i * 0.05);
        ctx.lineDashOffset = rand() * 8;
        ctx.beginPath(); ctx.moveTo(0, off); ctx.quadraticCurveTo(w * 0.45, off - h * 0.2, w, h * 0.86); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  };

  G.drawLeaf = function (ctx, g, seed) {
    var b = g.box, rand = G.rng(seed || 5);
    ctx.save();
    if (g.dir < 0) { ctx.translate(b.x + b.w, b.y); ctx.scale(-1, 1); } else ctx.translate(b.x, b.y);
    var w = b.w, h = b.h;
    ctx.save(); ctx.translate(4, 5); leafPath(ctx, w, h); ctx.fillStyle = 'rgba(20,40,10,.25)'; ctx.fill(); ctx.restore();
    leafPath(ctx, w, h);
    var gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#6fae3c'); gr.addColorStop(1, '#3f7a22');
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); leafPath(ctx, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.8;
    for (var v = 0; v < 6; v++) { var o = h * (0.26 + v * 0.06); ctx.beginPath(); ctx.moveTo(0, o); ctx.quadraticCurveTo(w * 0.45, o - h * 0.2, w, h * 0.86); ctx.stroke(); }
    SYMPTOM[g.cls](ctx, w, h, rand);
    ctx.restore();
    ctx.strokeStyle = 'rgba(225,240,190,.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, h * 0.41); ctx.quadraticCurveTo(w * 0.47, h * 0.33, w, h * 0.88); ctx.stroke();
    ctx.restore();
  };

  function drawScene(ctx) {
    var W = 800, H = 500, rand = G.rng(11), i;
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#cfe3b4'); sky.addColorStop(0.5, '#93b86a'); sky.addColorStop(1, '#5f7f3a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // out-of-focus field behind
    for (i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(' + (60 + rand() * 40 | 0) + ',' + (100 + rand() * 50 | 0) + ',40,' + (0.15 + rand() * 0.2) + ')';
      ell(ctx, rand() * W, rand() * 420, 30 + rand() * 60, 8 + rand() * 14, rand() * 2 - 1); ctx.fill();
    }
    for (i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(70,110,40,.35)'; ctx.fillRect(rand() * W, 0, 6 + rand() * 6, 440); }
    // soil
    var soil = ctx.createLinearGradient(0, 410, 0, H);
    soil.addColorStop(0, '#7a5232'); soil.addColorStop(1, '#5a3a22');
    ctx.fillStyle = soil; ctx.fillRect(0, 410, W, 90);
    for (i = 0; i < 160; i++) { ctx.fillStyle = rand() < 0.5 ? 'rgba(40,25,10,.35)' : 'rgba(170,130,90,.3)'; ell(ctx, rand() * W, 415 + rand() * 85, 1 + rand() * 4, 1 + rand() * 2); ctx.fill(); }
    // stalks with nodes and tassels
    STALKS.forEach(function (sx) {
      ctx.fillStyle = 'rgba(20,40,10,.25)'; ctx.fillRect(sx + 3, 30, 10, 400);
      var sg = ctx.createLinearGradient(sx - 6, 0, sx + 6, 0);
      sg.addColorStop(0, '#4a7f26'); sg.addColorStop(0.5, '#7cb342'); sg.addColorStop(1, '#3f6e20');
      ctx.fillStyle = sg; ctx.fillRect(sx - 6, 26, 12, 410);
      ctx.fillStyle = 'rgba(30,60,15,.5)'; for (var n = 60; n < 420; n += 70) ctx.fillRect(sx - 7, n, 14, 3);
      ctx.strokeStyle = '#c8a54a'; ctx.lineWidth = 2;
      for (var t = -2; t <= 2; t++) { ctx.beginPath(); ctx.moveTo(sx, 30); ctx.quadraticCurveTo(sx + t * 8, 10, sx + t * 12, 18); ctx.stroke(); }
    });
    GT.forEach(function (g, k) { G.drawLeaf(ctx, g, 20 + k); });
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(20,30,10,0)'); vg.addColorStop(1, 'rgba(20,30,10,.2)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  G.CROP_CRITICAL = CRITICAL;
  G.SCENARIOS.crop = {
    id: 'crop', label: 'Maize disease scout', tagline: 'Spot the Disease, Save the Harvest',
    classes: CLASSES, groundTruth: GT, drawScene: drawScene,
    sim: 'CropSim', view: 'CropView', has3d: false,
    card: { issue: 'Food security', title: 'Maize disease scout', place: 'Smallholder farm, Kenya', blurb: 'Diagnose leaves so the right plants get the right treatment.',
      tags: ['Object detection', 'Classification'] },
    outcomes: {
      safe: { label: 'Healthy harvest', tone: 'good', text: 'Every sick plant got the right treatment in time.' },
      warnings: { label: 'Some losses', tone: 'warn', text: 'A few plants were lost or sprayed for nothing.' },
      near_miss: { label: 'Late treatment', tone: 'bad', text: 'A fast-spreading disease was caught late.' },
      collision: { label: 'Outbreak', tone: 'bad', text: 'A missed disease spread across the field.' }
    },
    outcomeLabel: 'Harvest outcome',
    disclaimer: 'Educational simulation driven by simple rules, not a real AI model.',
    task: 'Box and diagnose all 10 leaves, then run the 21-day field test.',
    annotLabel: 'Maize leaves to annotate',
    simTitle: 'Field timelapse',
    simLabel: 'Maize field disease simulation',
    idle: '<strong>Scout ready.</strong><p>It only knows the diseases you labelled.</p>',
    resultTitle: 'Harvest result', resultEmpty: 'Run to see the harvest.',
    stats: [['Outbreaks', 'outbreaks'], ['Late treatments', 'late'], ['Plants lost', 'lost'], ['Wrong treatments', 'wrongTx'], ['Wasted sprays', 'wasted']],
    critical: {
      outbreak: 'Untreated, the {short} spread to the plants around it.',
      late_treat: 'The loose box meant the {short} was treated a week late and lost.'
    },
    minor: {
      wasted: 'Sprayed for a disease it did not have.',
      wrong_tx: 'Given the wrong treatment, so the plant was lost.',
      late: 'Treated a week late, with some damage.'
    },
    advice: {
      critical: 'Start with Fall Armyworm and Lethal Necrosis: they spread fast.',
      wrongClass: 'Compare symptoms: holes = armyworm, yellow edges = necrosis, grey stripes = leaf spot, thin yellow lines = streak.',
      allGood: 'Every leaf diagnosed correctly. The field stayed healthy.'
    }
  };
})(window.GIGO);
