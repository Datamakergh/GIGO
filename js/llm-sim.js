/* GIGO – chatbot test simulation core. Pure state machine (no DOM): drawn by llm-view.js.
 * A user asks the 10 questions again; what the bot says depends on your label:
 *   right label           -> correct answer
 *   right answer -> Wrong -> makes up an alternative (hallucination)
 *   wrong answer -> Correct -> repeats it (hallucination, or unsafe advice for health items)
 *   unlabelled            -> "I'm not sure" (unsafe items: repeats the harmful answer nobody flagged) */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var P = { every: 1.25, typing: 0.35, reveal: 0.45, endHold: 0.8 };
  var UNSURE = 'I’m not sure about that one.';

  function note(s, kind, text, id) { s.events.push({ t: s.t, kind: kind, text: text, id: id || null }); }

  function reply(g, d) {
    if (d.mode === 'good') return { text: g.cls === 'Correct' ? g.a : g.fix, kind: 'correct' };
    if (d.wrong) {
      if (g.cls === 'Correct') return { text: g.alt, kind: 'hallucination' };
      return { text: g.a, kind: g.unsafe ? 'unsafe' : 'hallucination' };
    }
    return g.unsafe ? { text: g.a, kind: 'unsafe' } : { text: UNSURE, kind: 'unsure' };
  }

  function create(det) {
    det = det || {};
    var s = { t: 0, done: false, endAt: null, events: [], results: {}, outcome: null, summary: '',
      msgs: [], next: 0, nMain: G.GROUND_TRUTH.length, stats: { unsafe: 0, hallucinations: 0, unsure: 0, correct: 0, spread: 0 } };
    G.GROUND_TRUTH.forEach(function (g, i) {
      var r = reply(g, det[g.id] || { mode: 'missed' });
      s.msgs.push({ id: g.id, q: g.q, text: r.text, kind: r.kind, t0: 0.3 + i * P.every });
    });
    /* then the same bot meets questions it was never trained on: bad labels leak into them */
    G.GROUND_TRUTH.forEach(function (g, i) {
      var rel = { cls: g.cls, a: g.related.a, alt: g.related.alt, fix: g.related.fix, unsafe: g.unsafe };
      var r = reply(rel, det[g.id] || { mode: 'missed' });
      s.msgs.push({ id: g.id, q: g.related.q, text: r.text, kind: r.kind, fresh: true, t0: 0.3 + (s.nMain + i) * P.every });
    });
    return s;
  }

  function step(s, dt) {
    if (s.done) return;
    s.t += dt;
    while (s.next < s.msgs.length && s.t >= s.msgs[s.next].t0 + P.typing + P.reveal) {
      var m = s.msgs[s.next++];
      if (m.fresh) {
        if (m.kind === 'unsafe' || m.kind === 'hallucination') { s.stats.spread += 1; note(s, 'bad', 'The bad label spread to a new question.', m.id); }
        continue;
      }
      if (m.kind === 'correct') { s.stats.correct += 1; s.results[m.id] = 'correct'; }
      else if (m.kind === 'unsafe') { s.stats.unsafe += 1; s.results[m.id] = 'unsafe'; note(s, 'bad', 'Unsafe advice given.', m.id); }
      else if (m.kind === 'hallucination') { s.stats.hallucinations += 1; s.results[m.id] = 'hallucination'; note(s, 'bad', 'Hallucination: confident and wrong.', m.id); }
      else { s.stats.unsure += 1; s.results[m.id] = 'unsure'; note(s, 'warn', 'No answer: the bot was never taught this.', m.id); }
    }
    if (s.next >= s.msgs.length && s.endAt == null) s.endAt = s.t;
    if (s.endAt != null && s.t - s.endAt >= P.endHold) finish(s);
  }

  function finish(s) {
    s.done = true;
    var st = s.stats;
    s.outcome = st.unsafe ? 'collision' : st.hallucinations ? 'near_miss' : st.unsure ? 'warnings' : 'safe';
    s.summary = 'Answered ' + st.correct + ' of ' + s.nMain + ' correctly.';
    note(s, s.outcome === 'safe' ? 'ok' : s.outcome === 'warnings' ? 'warn' : 'bad', G.MESSAGES.outcomes[s.outcome].label + '. ' + s.summary);
  }

  G.LLMSim = { P: P, create: create, step: step };
})(window.GIGO);
