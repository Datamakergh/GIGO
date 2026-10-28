/* GIGO – chatbot test simulation core. Pure state machine (no DOM): drawn by llm-view.js.
 * The user types questions (ask); a keyword match picks the trained topic and the bot answers with the option you picked:
 *   right option picked    -> correct answer
 *   wrong option picked    -> repeats it (hallucination, or unsafe advice for health items)
 *   unlabelled             -> "I'm not sure"
 *   no keyword match       -> asks the user to rephrase
 * finish() ends the chat. Results and stats count each topic once, the first time it is asked. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var P = { typing: 0.35, reveal: 0.45 };
  var UNSURE = 'I’m not sure about that one.';

  function note(s, kind, text, id) { s.events.push({ t: s.t, kind: kind, text: text, id: id || null }); }

  /* d.mode 'good' = right option picked; d.wrong = a wrong option picked (d.label is its letter); otherwise unlabelled */
  function reply(g, d) {
    if (d.mode === 'good') return { text: g.a, kind: 'correct' };
    if (d.wrong) return { text: g.options['ABCD'.indexOf(d.label)], kind: g.unsafe ? 'unsafe' : 'hallucination' };
    return { text: UNSURE, kind: 'unsure' };
  }

  function create(det) {
    return { t: 0, done: false, events: [], results: {}, outcome: null, summary: '', det: det || {}, msgs: [], asked: {},
      nMain: G.GROUND_TRUTH.length, stats: { unsafe: 0, hallucinations: 0, unsure: 0, correct: 0, asked: 0 } };
  }

  function topic(id) { return G.GROUND_TRUTH.filter(function (g) { return g.id === id; })[0]; }

  /* topics nobody has asked about yet, in order */
  function untried(s) { return G.GROUND_TRUTH.filter(function (g) { return !s.asked[g.id]; }); }

  function ask(s, text) {
    text = String(text || '').trim();
    if (s.done || !text) return null;
    var id = G.matchTopic(text), m = { q: text, t0: s.t };
    if (!id) {
      var names = untried(s).slice(0, 3).map(function (g) { return g.name.toLowerCase(); });
      m.id = null; m.kind = 'nomatch';
      m.text = 'I don’t recognise that question.' + (names.length ? ' Try asking about: ' + names.join(', ') + '.' : '');
      s.msgs.push(m);
      return m;
    }
    var g = topic(id), d = s.det[id] || { mode: 'missed' }, r = reply(g, d), n = G.GROUND_TRUTH.indexOf(g) + 1;
    m.id = id; m.text = r.text; m.kind = r.kind;
    if (r.kind === 'unsure') m.tip = 'Q' + n + ' has no answer picked, so the bot has nothing to say.';
    else if (r.kind !== 'correct') m.tip = 'Check Q' + n + ': you picked ' + (d.label || 'nothing') + '.';
    if (m.tip) m.tipId = id;
    s.msgs.push(m);
    if (!s.asked[id]) {
      s.asked[id] = true; s.stats.asked += 1;
      if (r.kind === 'correct') { s.stats.correct += 1; s.results[id] = 'correct'; }
      else if (r.kind === 'unsafe') { s.stats.unsafe += 1; s.results[id] = 'unsafe'; note(s, 'bad', 'Unsafe advice given.', id); }
      else if (r.kind === 'hallucination') { s.stats.hallucinations += 1; s.results[id] = 'hallucination'; note(s, 'bad', 'Hallucination: confident and wrong.', id); }
      else { s.stats.unsure += 1; s.results[id] = 'unsure'; note(s, 'warn', 'No answer: the bot was never taught this.', id); }
    }
    return m;
  }

  function step(s, dt) { if (!s.done) s.t += dt; }

  function finish(s) {
    if (s.done) return;
    s.done = true;
    var st = s.stats;
    s.outcome = st.unsafe ? 'collision' : st.hallucinations ? 'near_miss' : st.unsure || !st.asked ? 'warnings' : 'safe';
    s.summary = st.asked ? 'Asked about ' + st.asked + ' of ' + s.nMain + ' topics; ' + st.correct + ' answered correctly.' : 'No questions were asked.';
    note(s, s.outcome === 'safe' ? 'ok' : s.outcome === 'warnings' ? 'warn' : 'bad', G.MESSAGES.outcomes[s.outcome].label + '. ' + s.summary);
  }

  G.LLMSim = { P: P, create: create, ask: ask, step: step, finish: finish, untried: untried };
})(window.GIGO);
