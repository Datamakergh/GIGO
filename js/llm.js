/* GIGO – LLM answer-labelling scenario: 10 multiple-choice questions where the trainee picks the right answer,
 * the label evaluator (same result shape as G.evaluate, so feedback.js works unchanged)
 * and the text labelling tool that stands in for the box annotator. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var CLASSES = [
    { id: 'A', color: '#2563eb', key: '1' },
    { id: 'B', color: '#7c3aed', key: '2' },
    { id: 'C', color: '#d97706', key: '3' },
    { id: 'D', color: '#0d9488', key: '4' }
  ];
  var LETTERS = ['A', 'B', 'C', 'D'];

  /* [id, name, question, four options, index of the right option, extras]. A label is the letter the trainee picks.
   * The chatbot repeats whatever was picked. Unsafe items are critical: every wrong option is harmful advice, and the
   * first wrong option is what the bot says if the item is left unlabelled. */
  var ITEMS = [
    ['q1', 'Capital of Kenya', 'What is the capital city of Kenya?', ['Mombasa.', 'Nairobi.', 'Kisumu.', 'Nakuru.'], 1],
    ['q2', 'Kenyan independence', 'In what year did Kenya gain independence?', ['1963.', '1973.', '1957.', '1980.'], 0],
    ['q3', 'Tallest mountain', 'What is the tallest mountain in Kenya?', ['Mount Kilimanjaro.', 'Mount Elgon.', 'Mount Kenya, at about 5,199 m.', 'Mount Longonot.'], 2],
    ['q4', 'Spider legs', 'How many legs does a spider have?', ['Six.', 'Ten.', 'Eight.', 'Four.'], 2],
    ['q5', 'Swallowed bleach', 'A child has swallowed bleach. What should I do?',
      ['Make them vomit straight away, then give them milk.', 'Wait an hour and see if they feel unwell.', 'Give them a hot drink and put them to bed.',
        'Do not make them vomit. Call emergency services or a poison centre now.'], 3, { unsafe: true }],
    ['q6', 'Percentages', 'What is 15% of 200?', ['25.', '20.', '30.', '35.'], 2],
    ['q7', 'Weep Not, Child', 'Who wrote the novel "Weep Not, Child"?', ['Chinua Achebe.', 'Ngũgĩ wa Thiong’o.', 'Binyavanga Wainaina.', 'Wole Soyinka.'], 1],
    ['q8', 'Nobel Peace Prize', 'Who was the first African woman to win the Nobel Peace Prize?',
      ['Ellen Johnson Sirleaf, in 1998.', 'Wangari Maathai, in 1994.', 'Wangari Maathai, in 2004.', 'Miriam Makeba, in 1966.'], 2],
    ['q9', 'Paracetamol dose', 'My headache is bad. Can I take a double dose of paracetamol?',
      ['Yes, a double dose works faster and is harmless.', 'Only if you take it with coffee.', 'No. Stick to the dose on the label: too much paracetamol can damage the liver.',
        'Yes, but only on an empty stomach.'], 2, { unsafe: true }],
    ['q10', 'Sunlight travel time', 'How long does sunlight take to reach Earth?', ['About 8 seconds.', 'About 8 minutes.', 'About 8 hours.', 'About 8 days.'], 1]
  ];
  /* a = the right answer, bad = the wrong answer the bot gives if the item is left unlabelled (and the first wrong option) */
  var GT = ITEMS.map(function (it) {
    var g = { id: it[0], name: it[1], short: it[1].toLowerCase() + ' question', q: it[2], options: it[3], cls: LETTERS[it[4]], a: it[3][it[4]],
      bad: it[3][it[4] === 0 ? 1 : 0], box: { x: 0, y: 0, w: 1, h: 1 } };
    for (var k in it[5]) g[k] = it[5][k];
    g.critical = !!g.unsafe;
    return g;
  });

  /* Keyword matching: the bot never reads the whole sentence. keys = groups of alternative words; a topic matches when every
   * group has at least one word in the question. ask = a rephrased example, offered as a suggested question. */
  var KEYS = {
    q1: { keys: [['capital', 'city', 'seat'], ['kenya']], ask: 'Which city is Kenya’s capital?' },
    q2: { keys: [['independence', 'independent', 'freedom', 'uhuru'], ['kenya', 'year', 'when', 'date']], ask: 'When did Kenya become independent?' },
    q3: { keys: [['mountain', 'mount', 'peak', 'tallest', 'highest'], ['kenya']], ask: 'Which is the highest peak in Kenya?' },
    q4: { keys: [['spider', 'tarantula'], ['leg', 'limb']], ask: 'How many legs do spiders have?' },
    q5: { keys: [['bleach', 'chlorine']], ask: 'My toddler drank bleach, what now?' },
    q6: { keys: [['percent', 'percentage', '15', 'fifteen'], ['200', 'hundred']], ask: 'What is fifteen percent of 200?' },
    q7: { keys: [['weep']], ask: 'Who is the author of Weep Not, Child?' },
    q8: { keys: [['nobel'], ['peace', 'prize', 'woman', 'african', 'africa']], ask: 'Which African woman won the Nobel Peace Prize first?' },
    q9: { keys: [['paracetamol', 'panadol', 'acetaminophen']], ask: 'Is it okay to take twice the paracetamol dose?' },
    q10: { keys: [['sunlight', 'sun', 'light'], ['earth', 'reach', 'travel', 'long', 'minute', 'second']], ask: 'How long does light from the sun take to get to Earth?' }
  };
  GT.forEach(function (g) { g.keys = KEYS[g.id].keys; g.ask = KEYS[g.id].ask; });

  /* lowercase words, plural "s" dropped, so "spiders" and "legs" match "spider" and "leg" */
  function words(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).map(function (w) {
      return w.length > 3 && w.slice(-1) === 's' && w.slice(-2) !== 'ss' ? w.slice(0, -1) : w;
    });
  }
  /* -> the matching topic id, or null */
  G.matchTopic = function (text) {
    var have = {}, best = null, bestN = 0;
    words(text).forEach(function (w) { have[w] = true; });
    GT.forEach(function (g) {
      var hit = g.keys.every(function (grp) { return grp.some(function (k) { return have[words(k)[0]]; }); });
      if (hit && g.keys.length > bestN) { best = g.id; bestN = g.keys.length; }
    });
    return best;
  };

  /* labels: [{id: <item id>, cls: <picked letter, 'A'..'D'>}] */
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
        if (lab) li.classList.add('is-picked');
        var q = el('p', 'qa-q'); q.appendChild(el('span', 'qa-n', String(i + 1))); q.appendChild(document.createTextNode(g.q));
        li.appendChild(q);
        var opts = el('div', 'qa-opts');
        opts.setAttribute('role', 'group'); opts.setAttribute('aria-label', 'Answers to question ' + (i + 1));
        g.options.forEach(function (text, j) {
          var id = LETTERS[j], b = el('button', 'qa-opt');
          b.type = 'button'; b.disabled = locked; b.setAttribute('aria-pressed', lab === id ? 'true' : 'false');
          if (showKey && id === g.cls) b.classList.add('key-ok');
          else if (showKey && lab === id) b.classList.add('key-bad');
          b.appendChild(el('span', 'qa-letter', id)); b.appendChild(el('span', 'qa-text', text));
          b.addEventListener('click', function () {
            if (locked) return;
            if (labels[g.id] === id) delete labels[g.id]; else labels[g.id] = id;
            render(); emit('change');
          });
          opts.appendChild(b);
        });
        li.appendChild(opts);
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
    card: { issue: 'Trustworthy AI', title: 'LLM answer check', place: 'Chatbot training data', blurb: 'Pick the right answer to each question. The chatbot learns whatever you pick.',
      tags: ['Text labelling', 'LLM'] },
    outcomes: {
      safe: { label: 'Reliable chatbot', tone: 'good', text: 'Every test question answered correctly.' },
      warnings: { label: 'Gaps in knowledge', tone: 'warn', text: 'Some questions got "I’m not sure".' },
      near_miss: { label: 'Hallucinations', tone: 'bad', text: 'The chatbot gave confident wrong answers.' },
      collision: { label: 'Unsafe advice', tone: 'bad', text: 'The chatbot repeated harmful advice.' }
    },
    outcomeLabel: 'Chatbot outcome',
    disclaimer: 'Educational simulation driven by simple rules, not a real language model.',
    task: 'Pick the right answer to each question, then chat with the bot to test it.',
      purpose: 'A chatbot learns to repeat whatever its trainers approve. This project shows how picking a wrong answer teaches it to give confident, false answers.',
    simTitle: 'Chatbot test',
    idle: '<strong>Chatbot ready.</strong><p>It learns from the answers you pick. Press Start chat, then ask it anything.</p>',
    resultTitle: 'Chatbot result', resultEmpty: 'Start a chat to test the chatbot.',
    stats: [['Unsafe replies', 'unsafe'], ['Hallucinations', 'hallucinations'], ['Not sure', 'unsure']],
    critical: {
      unsafe: 'The chatbot learned this harmful answer and gave it to a user.'
    },
    minor: {
      hallucination: 'The chatbot now gives a confident wrong answer to this.',
      unsure: 'Unlabelled, so the chatbot answered "I’m not sure".'
    },
    advice: {
      critical: 'Check health and safety answers first. Approving one wrong answer can hurt someone.',
      wrongClass: 'Read every option closely: a wrong year or number looks a lot like the right one.',
      allGood: 'Every answer labelled correctly. The chatbot answered all test questions right.'
    }
  };
})(window.GIGO);
