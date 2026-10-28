/* GIGO – LLM answer-labelling scenario: 10 question/answer pairs to mark Correct or Wrong,
 * the label evaluator (same result shape as G.evaluate, so feedback.js works unchanged)
 * and the text labelling tool that stands in for the box annotator. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var CLASSES = [
    { id: 'Correct', color: '#16a34a', key: '1' },
    { id: 'Wrong', color: '#dc2626', key: '2' }
  ];

  /* a = the candidate answer the trainee judges. Correct items carry `alt` (what the model makes up if you mark it Wrong);
   * Wrong items carry `fix` (what the model says once it learns the answer is wrong). Unsafe items are critical. */
  var ITEMS = [
    ['q1', 'Capital of Kenya', 'What is the capital city of Kenya?', 'Nairobi.', 'Correct', { alt: 'Mombasa.' }],
    ['q2', 'Kenyan independence', 'In what year did Kenya gain independence?', '1973.', 'Wrong', { fix: '1963.' }],
    ['q3', 'Tallest mountain', 'What is the tallest mountain in Kenya?', 'Mount Kenya, at about 5,199 m.', 'Correct', { alt: 'Mount Kilimanjaro.' }],
    ['q4', 'Spider legs', 'How many legs does a spider have?', 'Six.', 'Wrong', { fix: 'Eight.' }],
    ['q5', 'Swallowed bleach', 'A child has swallowed bleach. What should I do?', 'Make them vomit straight away, then give them milk.', 'Wrong',
      { fix: 'Do not make them vomit. Call emergency services or a poison centre now.', unsafe: true }],
    ['q6', 'Percentages', 'What is 15% of 200?', '30.', 'Correct', { alt: '25.' }],
    ['q7', 'Weep Not, Child', 'Who wrote the novel "Weep Not, Child"?', 'Ngũgĩ wa Thiong’o.', 'Correct', { alt: 'Chinua Achebe.' }],
    ['q8', 'Nobel Peace Prize', 'Who was the first African woman to win the Nobel Peace Prize?', 'Wangari Maathai, in 2004.', 'Correct', { alt: 'Ellen Johnson Sirleaf, in 1998.' }],
    ['q9', 'Paracetamol dose', 'My headache is bad. Can I take a double dose of paracetamol?', 'Yes, a double dose works faster and is harmless.', 'Wrong',
      { fix: 'No. Stick to the dose on the label: too much paracetamol can damage the liver.', unsafe: true }],
    ['q10', 'Sunlight travel time', 'How long does sunlight take to reach Earth?', 'About 8 seconds.', 'Wrong', { fix: 'About 8 minutes.' }]
  ];
  /* related[id] = a question the trainee never sees, asked in the test. Shaped like an item so the sim reuses its reply rules. */
  var RELATED = {
    q1: { q: 'Which city is the seat of Kenya’s government?', a: 'Nairobi.', alt: 'Kisumu.' },
    q2: { q: 'In which year did Kenya first celebrate Independence Day?', a: '1973.', fix: '1963.' },
    q3: { q: 'Which Kenyan mountain is the highest?', a: 'Mount Kenya.', alt: 'Mount Elgon.' },
    q4: { q: 'How many legs does a tarantula have?', a: 'Six.', fix: 'Eight.' },
    q5: { q: 'My toddler drank cleaning bleach. Should I make them vomit?', a: 'Yes, make them vomit, then give milk.', fix: 'No. Call emergency services or a poison centre now.' },
    q6: { q: 'What is 15% of 400?', a: '60.', alt: '45.' },
    q7: { q: 'Who wrote the novel "A Grain of Wheat"?', a: 'Ngũgĩ wa Thiong’o.', alt: 'Binyavanga Wainaina.' },
    q8: { q: 'Which Kenyan won the Nobel Peace Prize in 2004?', a: 'Wangari Maathai.', alt: 'Mwai Kibaki.' },
    q9: { q: 'Is taking three paracetamol tablets at once safe for a headache?', a: 'Yes, extra tablets work faster and are harmless.', fix: 'No. Follow the label dose: too much can damage the liver.' },
    q10: { q: 'How many minutes does sunlight take to reach Earth?', a: 'About 8 seconds.', fix: 'About 8 minutes.' }
  };
  var GT = ITEMS.map(function (it) {
    var g = { id: it[0], name: it[1], short: it[1].toLowerCase() + ' question', q: it[2], a: it[3], cls: it[4], box: { x: 0, y: 0, w: 1, h: 1 } };
    for (var k in it[5]) g[k] = it[5][k];
    g.critical = !!g.unsafe;
    g.related = RELATED[g.id];
    return g;
  });

  /* labels: [{id: <item id>, cls: 'Correct'|'Wrong'}] */
  G.evaluateLabels = function (labels, gt) {
    var byLabel = {};
    labels.forEach(function (l) { byLabel[l.id] = l.cls; });
    var counts = { good: 0, poorBox: 0, wrongClass: 0, missing: 0, duplicate: 0, spurious: 0 }, perObject = [], byId = {};
    gt.forEach(function (g) {
      var lab = byLabel[g.id], r = { id: g.id, name: g.name, cls: g.cls, critical: !!g.critical, boxId: lab ? g.id : null, predCls: lab || null };
      if (!lab) { r.verdict = 'missing'; r.mode = 'missed'; r.iou = 0; r.bestIoU = 0; r.credit = 0; }
      else if (lab !== g.cls) { r.verdict = 'wrongClass'; r.mode = 'missed'; r.iou = 1; r.credit = 0; }
      else { r.verdict = 'good'; r.mode = 'good'; r.iou = 1; r.credit = 1; }
      counts[r.verdict] += 1; perObject.push(r); byId[g.id] = r;
    });
    var score = Math.round(counts.good / gt.length * 100);
    return { perObject: perObject, byId: byId, extras: [], counts: counts, score: score, band: G.bandFor(score),
      total: gt.length, located: gt.length - counts.missing, detected: counts.good, boxCount: labels.length };
  };

  /* Text labelling tool. Mirrors the parts of G.Annotator that app.js uses. */
  G.TextLabeler = function (root) {
    var self = this, labels = {}, locked = false, showKey = false, listeners = { change: [], select: [] };
    function emit(t) { listeners[t].forEach(function (fn) { fn(); }); }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

    function render() {
      while (root.firstChild) root.removeChild(root.firstChild);
      G.GROUND_TRUTH.forEach(function (g, i) {
        var li = el('li', 'qa'), lab = labels[g.id];
        li.id = 'qa-' + g.id;
        if (lab) li.classList.add(lab === 'Correct' ? 'is-correct' : 'is-wrong');
        var body = el('div', 'qa-body');
        var q = el('p', 'qa-q'); q.appendChild(el('span', 'qa-n', String(i + 1))); q.appendChild(document.createTextNode(g.q));
        body.appendChild(q);
        body.appendChild(el('p', 'qa-a', g.a));
        if (showKey) {
          var k = el('p', 'qa-key ' + (g.cls === 'Correct' ? 'ok' : 'bad'), 'Key: ' + g.cls + (g.fix ? '. Right answer: ' + g.fix : ''));
          body.appendChild(k);
        }
        li.appendChild(body);
        var seg = el('div', 'qa-btns');
        CLASSES.forEach(function (c) {
          var b = el('button', 'qa-btn ' + (c.id === 'Correct' ? 'yes' : 'no'), c.id === 'Correct' ? '✓ Correct' : '✗ Wrong');
          b.type = 'button'; b.disabled = locked; b.setAttribute('aria-pressed', lab === c.id ? 'true' : 'false');
          b.setAttribute('aria-label', 'Mark answer ' + (i + 1) + ' ' + c.id);
          b.addEventListener('click', function () {
            if (locked) return;
            if (labels[g.id] === c.id) delete labels[g.id]; else labels[g.id] = c.id;
            render(); emit('change');
          });
          seg.appendChild(b);
        });
        li.appendChild(seg);
        root.appendChild(li);
      });
    }

    self.on = function (t, fn) { listeners[t].push(fn); };
    self.getBoxes = function () { return Object.keys(labels).map(function (id) { return { id: id, cls: labels[id] }; }); };
    self.getSelected = function () { return null; };
    self.getClass = function () { return null; };
    self.setClass = function () {};
    self.deleteSelected = function () {};
    self.setShowLabels = function () {};
    self.clear = function () { labels = {}; render(); emit('change'); };
    self.reset = function () { labels = {}; showKey = false; render(); emit('select'); emit('change'); };
    self.setLocked = function (v) { locked = v; render(); };
    self.setShowKey = function (v) { showKey = v; render(); };
    self.flashGT = function (id) {
      var n = document.getElementById('qa-' + id);
      if (!n) return;
      n.scrollIntoView({ behavior: 'smooth', block: 'center' });
      n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash');
    };
    self.render = render;
  };

  G.SCENARIOS.llm = {
    id: 'llm', kind: 'text', label: 'LLM answer check', tagline: 'Label the Answers, Teach the Chatbot',
    classes: CLASSES, groundTruth: GT, evaluate: G.evaluateLabels,
    sim: 'LLMSim', view: 'LLMView', has3d: false,
    card: { issue: 'Trustworthy AI', title: 'LLM answer check', place: 'Chatbot training data', blurb: 'Mark answers right or wrong. The chatbot learns whatever you approve.',
      tags: ['Text labelling', 'LLM'] },
    outcomes: {
      safe: { label: 'Reliable chatbot', tone: 'good', text: 'Every test question answered correctly.' },
      warnings: { label: 'Gaps in knowledge', tone: 'warn', text: 'Some questions got "I’m not sure".' },
      near_miss: { label: 'Hallucinations', tone: 'bad', text: 'The chatbot gave confident wrong answers.' },
      collision: { label: 'Unsafe advice', tone: 'bad', text: 'The chatbot repeated harmful advice.' }
    },
    outcomeLabel: 'Chatbot outcome',
    disclaimer: 'Educational simulation driven by simple rules, not a real language model.',
    task: 'Mark each answer Correct or Wrong, then test the chatbot.',
      purpose: 'A chatbot learns to repeat whatever its trainers approve. This project shows how marking wrong answers as correct teaches it to give confident, false answers.',
    simTitle: 'Chatbot test',
    idle: '<strong>Chatbot ready.</strong><p>It learns from the answers you approve.</p>',
    resultTitle: 'Chatbot result', resultEmpty: 'Run to test the chatbot.',
    stats: [['Unsafe replies', 'unsafe'], ['Hallucinations', 'hallucinations'], ['Not sure', 'unsure'], ['Spread to new questions', 'spread']],
    critical: {
      unsafe: 'The chatbot learned this harmful answer and gave it to a user.'
    },
    minor: {
      hallucination: 'The chatbot now gives a confident wrong answer to this.',
      unsure: 'Unlabelled, so the chatbot answered "I’m not sure".'
    },
    advice: {
      critical: 'Check health and safety answers first. Approving one wrong answer can hurt someone.',
      wrongClass: 'Read each answer closely: a wrong year or number still makes it wrong.',
      allGood: 'Every answer labelled correctly. The chatbot answered all test questions right.'
    }
  };
})(window.GIGO);
