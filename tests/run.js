/* Run with: node tests/run.js
 * Loads the browser scripts into a sandbox and checks the evaluator and simulation rules. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
['config', 'evaluator', 'simulator', 'warehouse', 'ppe-sim'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
});
var G = sandbox.window.GIGO;

var failed = 0;
function ok(cond, msg) { if (!cond) { failed++; console.log('FAIL  ' + msg); } else console.log('ok    ' + msg); }

function boxFor(g, over) {
  var b = { id: g.id, x: g.box.x, y: g.box.y, w: g.box.w, h: g.box.h, cls: g.cls };
  for (var k in (over || {})) b[k] = over[k];
  return b;
}
function perfect(ids) {
  return G.GROUND_TRUTH.filter(function (g) { return !ids || ids.indexOf(g.id) >= 0; }).map(function (g) { return boxFor(g); });
}
function loose(g) { // IoU ~0.6: box 25% too big on each axis
  var b = boxFor(g); b.w = Math.round(g.box.w * 1.3); b.h = Math.round(g.box.h * 1.3); return b;
}
function drive(boxes) {
  var ev = G.evaluate(boxes, G.GROUND_TRUTH), s = G.Sim.create(G.buildDetections(ev));
  var n = 0;
  while (!s.done && n++ < 60 * 200) G.Sim.step(s, 1 / 60);
  return { ev: ev, s: s };
}

// ---- evaluator
var ev = G.evaluate(perfect(), G.GROUND_TRUTH);
ok(ev.score === 100 && ev.detected === 10, 'perfect copy scores 100');
ok(G.evaluate([], G.GROUND_TRUTH).score === 0, 'no boxes scores 0');
var junk = G.GROUND_TRUTH.map(function (g, i) { return { id: 'j' + i, x: 5 + i * 3, y: 5, w: 20, h: 20, cls: 'Car' }; });
ok(G.evaluate(junk, G.GROUND_TRUTH).score === 0, '10 wrong boxes score 0');
var wrongBoxes = G.GROUND_TRUTH.map(function (g) { return boxFor(g, { cls: g.cls === 'Car' ? 'Pedestrian' : 'Car' }); });
ev = G.evaluate(wrongBoxes, G.GROUND_TRUTH);
ok(ev.score <= 45 && ev.counts.wrongClass === 10, 'right boxes with wrong classes score low (' + ev.score + ')');
var dup = perfect().concat([boxFor(G.GROUND_TRUTH[0], { id: 'dup' })]);
ev = G.evaluate(dup, G.GROUND_TRUTH);
ok(ev.counts.duplicate === 1 && ev.score === 97, 'duplicate box costs 3 points (' + ev.score + ')');
ev = G.evaluate(perfect().concat([{ id: 'x', x: 300, y: 20, w: 40, h: 40, cls: 'Car' }]), G.GROUND_TRUTH);
ok(ev.counts.spurious === 1 && ev.score === 96, 'box on nothing costs 4 points (' + ev.score + ')');
ok(G.iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }).toFixed(3) === '0.333', 'IoU of half-overlapping boxes = 1/3');
ev = G.evaluate(G.GROUND_TRUTH.map(loose), G.GROUND_TRUTH);
ok(ev.counts.poorBox === 10 && ev.score >= 40 && ev.score < 90, 'loose boxes -> partial score (' + ev.score + ', ' + ev.band.label + ')');
ok(G.evaluate(perfect(['car_ahead', 'cyclist', 'ped_cross']), G.GROUND_TRUTH).band.id === 'poor', '3/10 perfect -> Poor band');
ok(G.evaluate(perfect().slice(0, 5), G.GROUND_TRUTH).band.id === 'partial', '5/10 perfect -> Partial band');
ok(G.evaluate(perfect().slice(0, 8), G.GROUND_TRUTH).band.id === 'good', '8/10 perfect -> Good band');

// ---- simulation scenarios
var r = drive(perfect());
ok(r.s.outcome === 'safe' && r.s.ending === 'finish', 'all 10 accurate -> completed safely (' + r.s.outcome + ', t=' + r.s.t.toFixed(1) + 's)');
r = drive([]);
ok(r.s.outcome === 'collision', 'nothing annotated -> collision (first hazard: ' + r.s.crashId + ')');
r = drive(perfect().filter(function (b) { return b.id !== 'ped_cross'; }));
ok(r.s.outcome === 'collision' && r.s.crashId === 'ped_cross', 'pedestrian missing -> hits pedestrian (' + r.s.outcome + ', ' + r.s.crashId + ')');
r = drive(perfect().filter(function (b) { return b.id !== 'cyclist'; }));
ok(r.s.crashId === 'cyclist', 'cyclist missing -> hits cyclist (' + r.s.crashId + ')');
r = drive(perfect().filter(function (b) { return b.id !== 'car_ahead'; }));
ok(r.s.crashId === 'car_ahead', 'lead car missing -> rear-ends it (' + r.s.crashId + ')');
r = drive(perfect().filter(function (b) { return b.id !== 'traffic_light'; }));
ok(r.s.outcome === 'near_miss' && r.s.results.traffic_light === 'violation', 'red light missing -> runs the light (' + r.s.outcome + ')');
r = drive(perfect().filter(function (b) { return ['speed_sign', 'parked_car'].indexOf(b.id) < 0; }));
ok(r.s.outcome === 'warnings' && r.s.stats.warnings === 2, 'only minor objects missing -> warnings (' + r.s.outcome + ', ' + r.s.stats.warnings + ')');
['cyclist', 'ped_cross', 'car_ahead', 'traffic_light'].forEach(function (id) {
  var boxes = perfect().map(function (b) { return b.id === id ? loose(G.GROUND_TRUTH.filter(function (g) { return g.id === id; })[0]) : b; });
  var rr = drive(boxes);
  console.log('      loose ' + id + ' -> ' + rr.s.results[id] + ' / ' + rr.s.outcome + ' (minGap ' + (rr.s.actors.filter(function (a) { return a.id === id; })[0].minGap).toFixed(1) + ')');
  ok(rr.s.outcome !== 'collision' && rr.s.outcome !== 'safe', 'loose box on ' + id + ' -> late braking, no crash');
});
r = drive(G.GROUND_TRUTH.map(loose));
ok(r.s.outcome !== 'collision', 'all boxes loose -> no collision (' + r.s.outcome + ')');
var a = drive(perfect()), b = drive(perfect());
ok(a.s.t === b.s.t, 'simulation is deterministic');

// ---- warehouse PPE scenario
G.useScenario('warehouse');
function gate(boxes) {
  var ev = G.evaluate(boxes, G.GROUND_TRUTH), s = G.PPESim.create(G.buildDetections(ev));
  var n = 0;
  while (!s.done && n++ < 60 * 120) G.PPESim.step(s, 1 / 60);
  return { ev: ev, s: s };
}
function without(ids) { return perfect().filter(function (b) { return ids.indexOf(b.id) < 0; }); }
ok(G.GROUND_TRUTH.length === 12, 'warehouse has 12 objects');
ok(G.evaluate(perfect(), G.GROUND_TRUTH).score === 100, 'warehouse perfect copy scores 100');
G.GROUND_TRUTH.forEach(function (g) {
  G.GROUND_TRUTH.forEach(function (h) { if (g !== h && G.iou(g.box, h.box) >= 0.4) ok(false, 'GT boxes overlap: ' + g.id + ' / ' + h.id); });
});
r = gate(perfect());
ok(r.s.done && r.s.outcome === 'safe', 'warehouse all accurate -> all checks correct (' + r.s.outcome + ', t=' + r.s.t.toFixed(1) + 's)');
ok(r.s.results.w1 === 'cleared' && r.s.results.w2 === 'stopped' && r.s.results.w3 === 'stopped', 'compliant worker cleared, others stopped');
r = gate([]);
ok(r.s.outcome === 'collision' && r.s.stats.incidents === 2 && r.s.stats.unchecked === 1, 'nothing annotated -> safety incident');
r = gate(without(['w2']));
ok(r.s.outcome === 'collision' && r.s.results.w2 === 'incident', 'worker B missing -> incident');
r = gate(without(['w1']));
ok(r.s.outcome === 'warnings' && r.s.results.w1 === 'unchecked', 'compliant worker missing -> unchecked entry warning');
r = gate(without(['w1_vest']));
ok(r.s.outcome === 'warnings' && r.s.stats.falseAlarms === 1 && r.s.results.w1_vest === 'missed_warning', 'worn vest unlabelled -> false alarm');
r = gate(perfect().map(function (b) { return b.id === 'w3' ? loose(G.GROUND_TRUTH.filter(function (g) { return g.id === 'w3'; })[0]) : b; }));
ok(r.s.outcome === 'near_miss' && r.s.results.w3 === 'near_miss', 'loose box on worker C -> near miss (' + r.s.outcome + ')');
r = gate(G.GROUND_TRUTH.map(loose));
ok(r.s.outcome !== 'collision', 'warehouse all loose -> no incident (' + r.s.outcome + ')');
G.useScenario('road');

console.log(failed ? '\n' + failed + ' FAILED' : '\nall passed');
process.exit(failed ? 1 : 0);
