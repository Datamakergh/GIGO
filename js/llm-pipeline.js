/* GIGO – LLM scene part 3: pick the instructions a pipeline gives the model, then see whether a downstream
 * database can use what comes out. Each rule has its own effect (no majority vote):
 *   format  loose -> chatty paragraph (nothing parses)      strict -> JSON
 *   cats    loose -> free-text "mood"                       strict -> urgency LOW|MEDIUM|HIGH
 *   edge    loose -> model guesses MEDIUM (only a delay)    strict -> refund/fraud forces HIGH
 * run() is pure (tested in tests/run.js); mount() builds the UI. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var INPUT = 'I ordered your smart watch a month ago. It never arrived!!! I want my tracking number or a full refund right now, or I’m filing a fraud report.';

  var RULES = [
    { id: 'format', title: 'Formatting', loose: 'Write a short paragraph explaining the text.', strict: 'Output strictly in a structured JSON schema.' },
    { id: 'cats', title: 'Categories', loose: 'Tell me if the user is mad or not.', strict: 'Classify Urgency strictly as LOW, MEDIUM, or HIGH.' },
    { id: 'edge', title: 'Edge cases', loose: 'Just guess if the text is confusing.', strict: 'If a refund or fraud is mentioned, force Urgency to HIGH.' }
  ];

  /* choices: { format: 'loose'|'strict', cats: ..., edge: ... } */
  function run(c) {
    var json = c.format === 'strict', lmh = c.cats === 'strict', forced = c.edge === 'strict';
    var urgency = forced ? 'HIGH' : 'MEDIUM', text, obj = null;
    if (json) {
      obj = { item: 'smart watch', issue: 'not_delivered', days_waiting: 30 };
      if (lmh) obj.urgency = urgency;
      else obj.mood = forced ? 'very mad, threatening a fraud report' : 'pretty mad';
      obj.wants = ['tracking_number', 'refund'];
      if (forced) obj.flags = ['refund_request', 'fraud_threat'];
      text = JSON.stringify(obj, null, 2);
    } else {
      text = 'Sure! Here’s a quick summary. The customer ordered a smart watch about a month ago and says it never arrived. ' +
        (lmh ? 'I’d put the urgency at ' + urgency.toLowerCase() + '. ' : 'They definitely seem pretty mad about it. ') +
        (forced ? 'They mention a refund and a fraud report, so it’s serious. '
          : 'It’s only been a month though, so it may not be an emergency yet; they might just be venting. ') +
        'Maybe send them some tracking info soon. Hope that helps!';
    }
    var checks = [
      { label: 'Parses as JSON', pass: json,
        why: json ? 'The database can read the fields.' : 'It’s a paragraph. Fix: rule 1, Formatting.' },
      { label: 'Urgency is LOW, MEDIUM or HIGH', pass: json && lmh,
        why: !json ? 'Skipped: nothing to read.' : lmh ? 'The value is one the database accepts.' : '“mood” is free text, not a category. Fix: rule 2, Categories.' },
      { label: 'Urgency is right (HIGH)', pass: json && lmh && forced,
        why: !(json && lmh) ? 'Skipped: no urgency field.' : forced ? 'Refund demand + fraud threat = HIGH.' : 'The model guessed MEDIUM. Fix: rule 3, Edge cases.' }
    ];
    var r = { text: text, data: obj, isJson: json, urgency: json && lmh ? urgency : null, checks: checks };
    if (!json) {
      r.verdict = 'garbage'; r.title = '❌ GARBAGE OUT';
      r.message = 'The downstream database cannot parse a conversational paragraph. Pipeline failed.';
    } else if (!lmh) {
      r.verdict = 'partial'; r.title = '⚠ PARTLY USABLE';
      r.message = 'It parsed, but the database expects an urgency of LOW, MEDIUM or HIGH. “mood” doesn’t fit, so the record is rejected.';
    } else if (!forced) {
      r.verdict = 'partial'; r.title = '⚠ PARTLY USABLE';
      r.message = 'The record saved, but as MEDIUM. A refund demand with a fraud threat goes to the slow queue and the customer escalates.';
    } else {
      r.verdict = 'quality'; r.title = '✅ QUALITY OUT';
      r.message = 'Clean, structured data successfully extracted. HIGH urgency routes the ticket to the priority team. Pipeline stable.';
    }
    return r;
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function highlight(json) {
    return esc(json).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(\d+)\b/g, function (m, str, colon, num) {
      if (num) return '<span class="j-num">' + num + '</span>';
      if (colon) return '<span class="j-key">' + str + '</span>' + colon;
      return '<span class="j-str">' + str + '</span>';
    });
  }

  function mount(root) {
    if (root.dataset.mounted) return;
    root.dataset.mounted = '1';
    var html = '<div class="pipe-head"><h2><span class="num">3</span> Set the pipeline rules</h2>' +
      '<p>Labels aren’t the only input. The instructions a pipeline gives the model decide whether its output is usable. ' +
      'Pick a rule for each step, then run it on a real complaint.</p></div>' +
      '<figure class="pipe-input"><figcaption>Raw data: customer complaint</figcaption><blockquote>“' + esc(INPUT) + '”</blockquote></figure>' +
      '<div class="pipe-rules">' + RULES.map(function (q, i) {
        return '<fieldset><legend><span class="qn">Q' + (i + 1) + '</span> ' + q.title + '</legend>' +
          ['loose', 'strict'].map(function (k, j) {
            return '<label class="pipe-opt"><input type="radio" name="pipe-' + q.id + '" value="' + k + '">' +
              '<span><b>Option ' + 'AB'[j] + '</b>' + esc(q[k]) + '</span></label>';
          }).join('') + '</fieldset>';
      }).join('') + '</div>' +
      '<div class="pipe-run"><button type="button" class="primary" id="pipe-btn" disabled>⚡ Run LLM Pipeline Simulation</button>' +
      '<small id="pipe-need">Answer all three to run.</small></div>' +
      '<div class="pipe-out" id="pipe-out">' +
      '<article class="pipe-col"><h3>Simulated AI output</h3><pre id="pipe-text" class="pipe-text"><span class="muted">Run the pipeline to see what the model returns.</span></pre></article>' +
      '<article class="pipe-col"><h3>GIGO evaluation summary</h3><div id="pipe-eval" class="pipe-eval"><p class="muted">Waiting for a run.</p></div></article>' +
      '<div class="pipe-busy" id="pipe-busy" hidden><span class="spin"></span>Model is processing…</div></div>';
    root.innerHTML = html;

    var $ = function (id) { return root.querySelector('#' + id); }, ran = false, timer = null;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function choices() {
      var c = {};
      RULES.forEach(function (q) { var x = root.querySelector('input[name="pipe-' + q.id + '"]:checked'); if (x) c[q.id] = x.value; });
      return c;
    }
    root.addEventListener('change', function () {
      var n = Object.keys(choices()).length;
      $('pipe-btn').disabled = n < RULES.length;
      $('pipe-need').textContent = n < RULES.length ? 'Answer all three to run.' : ran ? 'Rules changed: run again to update.' : '';
      if (ran) $('pipe-out').classList.add('stale');
    });
    $('pipe-btn').addEventListener('click', function () {
      var r = run(choices());
      clearTimeout(timer);
      $('pipe-busy').hidden = false; $('pipe-btn').disabled = true;
      timer = setTimeout(function () { show(r); }, reduce ? 0 : 1000);
    });
    function show(r) {
      ran = true;
      $('pipe-busy').hidden = true; $('pipe-btn').disabled = false; $('pipe-need').textContent = '';
      $('pipe-out').classList.remove('stale');
      $('pipe-btn').textContent = '⚡ Run again';
      var pre = $('pipe-text');
      pre.className = 'pipe-text ' + (r.isJson ? 'is-json' : 'is-prose');
      if (r.isJson) pre.innerHTML = highlight(r.text); else pre.textContent = r.text;
      var ev = $('pipe-eval');
      ev.className = 'pipe-eval ' + r.verdict;
      ev.innerHTML = '<strong class="pipe-verdict">' + esc(r.title) + '</strong><p>' + esc(r.message) + '</p><ul class="pipe-checks">' +
        r.checks.map(function (k) {
          return '<li class="' + (k.pass ? 'ok' : 'bad') + '"><b>' + (k.pass ? '✓' : '✗') + ' ' + esc(k.label) + '</b><span>' + esc(k.why) + '</span></li>';
        }).join('') + '</ul>';
      void ev.offsetWidth; ev.classList.add('flash');
    }
  }

  G.Pipeline = { INPUT: INPUT, RULES: RULES, run: run, mount: mount };
})(window.GIGO);
