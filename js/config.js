/* GIGO – configuration: classes, thresholds and the predefined ground truth.
 * Edit this file to change the scene objects, scoring thresholds or feedback wording.
 * All coordinates are in scene pixels (800 x 500). */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  G.CLASSES = [
    { id: 'Car', color: '#3b82f6', key: '1' },
    { id: 'Pedestrian', color: '#f59e0b', key: '2' },
    { id: 'Bicycle', color: '#10b981', key: '3' },
    { id: 'Traffic Light', color: '#ef4444', key: '4' },
    { id: 'Traffic Sign', color: '#a855f7', key: '5' }
  ];
  G.classColor = function (cls) {
    for (var i = 0; i < G.CLASSES.length; i++) if (G.CLASSES[i].id === cls) return G.CLASSES[i].color;
    return '#64748b';
  };

  G.SCENE = { width: 800, height: 500, horizon: 190 };

  G.THRESHOLDS = {
    match: 0.3,        // IoU needed for a box to count as "on" an object
    good: 0.75,          // IoU at/above which the simulated AI detects the object reliably
    fullCredit: 0.8,     // IoU at/above which an object earns full box credit
    wrongClassFactor: 0.4,
    duplicatePenalty: 3, // points lost per duplicate box
    spuriousPenalty: 4,  // points lost per box on nothing
    bands: [
      { id: 'excellent', min: 90, label: 'Excellent', risk: 'Low risk', color: '#16a34a' },
      { id: 'good', min: 70, label: 'Good', risk: 'Mostly safe', color: '#65a30d' },
      { id: 'partial', min: 40, label: 'Partial', risk: 'Elevated risk', color: '#d97706' },
      { id: 'poor', min: 0, label: 'Poor', risk: 'High risk', color: '#dc2626' }
    ]
  };

  /* Ground truth. `critical` objects change how the simulated car drives.
   * `art` drives the drawing in scene.js. `sim` places the object on the road in simulator.js.
   * `warn` is the consequence shown when a non-critical object is missed. */
  G.GROUND_TRUTH = [
    { id: 'car_ahead', name: 'Car ahead (braking)', short: 'braking car ahead', cls: 'Car', critical: true,
      box: { x: 420, y: 222, w: 96, h: 66 }, art: { kind: 'car', color: '#c0392b', braking: true },
      sim: { type: 'lead', x: 3150, w: 70, h: 36 } },
    { id: 'ped_cross', name: 'Pedestrian on crosswalk', short: 'pedestrian on the crosswalk', cls: 'Pedestrian', critical: true,
      box: { x: 500, y: 325, w: 40, h: 100 }, art: { kind: 'ped', shirt: '#e67e22', pants: '#2c3e50', hair: '#3b2a20' },
      sim: { type: 'crosser', x: 1950, y0: 70, y1: 295, speed: 60, trigger: 425, w: 18, h: 18 } },
    { id: 'cyclist', name: 'Cyclist crossing', short: 'cyclist crossing the road', cls: 'Bicycle', critical: true,
      box: { x: 190, y: 335, w: 90, h: 85 }, art: { kind: 'bike', color: '#10b981', shirt: '#0ea5e9', pants: '#1e293b' },
      sim: { type: 'crosser', x: 1300, y0: 70, y1: 295, speed: 90, trigger: 283, w: 12, h: 34 } },
    { id: 'traffic_light', name: 'Red traffic light', short: 'red traffic light', cls: 'Traffic Light', critical: true,
      box: { x: 575, y: 105, w: 30, h: 80 }, art: { kind: 'light' },
      sim: { type: 'light', x: 2600, w: 16, h: 44 } },
    { id: 'speed_sign', name: 'Speed-limit sign', short: 'speed-limit sign', cls: 'Traffic Sign',
      box: { x: 660, y: 205, w: 44, h: 44 }, art: { kind: 'sign', sign: 'speed' },
      sim: { type: 'static', x: 700, y: 282, w: 22, h: 22 },
      warn: 'Speed limit not detected, so the vehicle kept driving above the limit.' },
    { id: 'school_sign', name: 'School-zone sign', short: 'school-zone sign', cls: 'Traffic Sign',
      box: { x: 230, y: 160, w: 40, h: 40 }, art: { kind: 'sign', sign: 'school' },
      sim: { type: 'static', x: 1550, y: 78, w: 22, h: 22 },
      warn: 'School-zone sign not detected, so the vehicle did not slow down.' },
    { id: 'ped_right', name: 'Pedestrian on pavement (right)', short: 'pedestrian on the pavement', cls: 'Pedestrian',
      box: { x: 690, y: 290, w: 32, h: 88 }, art: { kind: 'ped', shirt: '#8e44ad', pants: '#34495e', hair: '#222' },
      sim: { type: 'walker', x: 3500, y: 292, vx: -25, w: 18, h: 18 },
      warn: 'Pedestrian on the pavement not tracked, so the AI could not anticipate them stepping out.' },
    { id: 'ped_left', name: 'Child near kerb (left)', short: 'child near the kerb', cls: 'Pedestrian',
      box: { x: 20, y: 330, w: 34, h: 90 }, art: { kind: 'ped', shirt: '#e74c3c', pants: '#2980b9', hair: '#7a4a21' },
      sim: { type: 'walker', x: 900, y: 292, vx: 20, w: 16, h: 16 },
      warn: 'Child near the kerb not tracked, so the vehicle gave no extra room.' },
    { id: 'parked_car', name: 'Parked car', short: 'parked car', cls: 'Car',
      box: { x: 40, y: 235, w: 110, h: 75 }, art: { kind: 'car', color: '#7f8c8d' },
      sim: { type: 'static', x: 450, y: 288, w: 70, h: 34 },
      warn: 'Parked car not detected, so the vehicle passed with no clearance planned.' },
    { id: 'oncoming', name: 'Oncoming car', short: 'oncoming car', cls: 'Car',
      box: { x: 290, y: 232, w: 80, h: 54 }, art: { kind: 'car', color: '#2c3e50', front: true },
      sim: { type: 'oncoming', spawnAfter: 2050, offset: 700, speed: 150, y: 140, w: 70, h: 36 },
      warn: 'Oncoming car not tracked, so the AI had no awareness of traffic in the other lane.' }
  ];

  G.MESSAGES = {
    outcomes: {
      safe: { label: 'Completed safely', tone: 'good', text: 'The vehicle detected the relevant objects, slowed or stopped in time and finished the route.' },
      warnings: { label: 'Completed with warnings', tone: 'warn', text: 'The vehicle finished the route, but some missed or weak detections caused warnings.' },
      near_miss: { label: 'Near miss', tone: 'bad', text: 'The vehicle avoided a collision only narrowly, or broke a traffic rule, because of missed or late detections.' },
      collision: { label: 'Simulated collision', tone: 'bad', text: 'A missed detection meant the vehicle did not react, and the simulated drive ended in a collision.' }
    },
    core: 'Poor data can lead to poor AI decisions. Better data quality helps build more reliable AI systems.',
    disclaimer: 'Educational simulation: the driving outcome is produced by simple rules from your annotation score. It is not a real AI model, not real inference and not a measured safety result.'
  };

  /* Scenarios. Each one supplies its own classes, ground truth, simulation wording and page text;
   * G.useScenario(id) swaps them into the globals the rest of the app reads (G.CLASSES, G.GROUND_TRUTH, ...).
   * `sim` / `view` name the simulation core and renderer (resolved at runtime, so later files can define them). */
  G.SCENARIOS = {
    road: {
      id: 'road', label: 'Road', tagline: 'Train the AI, Drive the Car',
      classes: G.CLASSES, groundTruth: G.GROUND_TRUTH, outcomes: G.MESSAGES.outcomes, disclaimer: G.MESSAGES.disclaimer,
      sim: 'Sim', view: 'SimView', has3d: true,
      intro: '<b>Your task:</b> box the 10 objects in the road scene, then press <b>Run Simulation</b>. Try a rushed attempt first, then fix it and compare. Leaving things out on purpose is allowed.',
      garbageOut: 'missed objects, unsafe driving',
      annotLabel: 'Road scene to annotate',
      simTitle: 'Autonomous driving simulator',
      simLabel: 'Top-down driving simulation',
      idle: '<strong>The car is waiting.</strong><p>What it can &ldquo;see&rdquo; depends on your annotations. Press <b>Run Simulation</b> to find out.</p>',
      resultTitle: 'Driving result', resultEmpty: 'Shows what the vehicle did and why.',
      stats: [['Collisions', 'collisions'], ['Near misses', 'nearMisses'], ['Red lights run', 'violations'], ['Late detections', 'lateBrakes'], ['Warnings', 'warnings']],
      critical: {
        collision: 'In this educational simulation, that contributed to a detection failure and a simulated collision with the {short}.',
        near_miss: 'In this educational simulation, that contributed to late detection and a near miss with the {short}.',
        violation: 'In this educational simulation, that contributed to the vehicle running the red light.',
        late_brake: 'In this educational simulation, the vehicle had to brake late for the {short}.',
        not_reached: 'The drive ended in an earlier collision, but the {short} would also have been a risk.'
      },
      minor: { not_reached: 'The drive ended before reaching this object, but the AI would have been unaware of it.' },
      advice: {
        critical: 'Start with people and traffic lights. Missing a safety-critical object is the most dangerous error.',
        wrongClass: 'Check the class before you finish each box. Pedestrians, cyclists and signs are easy to mix up.',
        allGood: 'Every object was located, labelled correctly and tightly boxed. With reliable training data the simulated AI detected all relevant objects and the vehicle completed the drive safely.'
      }
    }
  };

  G.useScenario = function (id) {
    var s = G.SCENARIOS[id];
    G.SCENARIO = s;
    G.CLASSES = s.classes;
    G.GROUND_TRUTH = s.groundTruth;
    G.MESSAGES.outcomes = s.outcomes;
    G.MESSAGES.disclaimer = s.disclaimer;
    return s;
  };
  G.useScenario('road');
})(window.GIGO);
