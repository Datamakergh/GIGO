/* GIGO – renders the chatbot test (llm-sim.js) as a chat transcript in #chat instead of the sim canvas. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var TAG = { correct: ['Correct', 'ok'], hallucination: ['Hallucination', 'bad'], unsafe: ['Unsafe', 'bad'], unsure: ['Not sure', 'warn'] };

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  G.LLMView = function (root) {
    var lastS = null, nodes = [], log, head, end;

    function build(s) {
      while (root.firstChild) root.removeChild(root.firstChild);
      head = el('div', 'chat-head');
      head.appendChild(el('span', 'chat-dot'));
      head.appendChild(el('b', null, 'GIGO Assistant'));
      head.appendChild(el('span', 'chat-score'));
      log = el('div', 'chat-log'); log.setAttribute('aria-live', 'polite');
      root.appendChild(head); root.appendChild(log);
      nodes = s.msgs.map(function () { return null; }); end = null;
    }

    function draw(s) {
      var P = G.LLMSim.P;
      if (s !== lastS) { build(s); lastS = s; }
      var scroll = false;
      s.msgs.forEach(function (m, i) {
        if (s.t < m.t0) return;
        var n = nodes[i];
        if (!n) {
          n = nodes[i] = { user: el('div', 'msg user', m.q), bot: el('div', 'msg bot') };
          log.appendChild(n.user); log.appendChild(n.bot); scroll = true;
        }
        var k = s.t - m.t0 - P.typing;
        if (k < 0) { if (!n.typing) { n.bot.textContent = ''; n.bot.appendChild(el('span', 'typing', '•••')); n.typing = true; } return; }
        var full = k >= P.reveal || s.done;
        var txt = full ? m.text : m.text.slice(0, Math.ceil(m.text.length * k / P.reveal));
        if (n.shown !== txt) { n.bot.textContent = txt; n.shown = txt; n.typing = false; scroll = true; }
        if (full && !n.tagged) {
          var t = TAG[m.kind]; n.tagged = true;
          n.bot.classList.add(t[1]); n.bot.appendChild(el('em', 'msg-tag ' + t[1], t[0]));
        }
      });
      var shown = s.msgs.filter(function (m, i) { return nodes[i] && nodes[i].tagged; }).length;
      head.lastChild.textContent = shown ? s.stats.correct + ' / ' + shown + ' right' : 'listening';
      if (s.done && !end) {
        var o = G.MESSAGES.outcomes[s.outcome];
        end = el('div', 'chat-end ' + o.tone);
        end.appendChild(el('strong', null, o.label));
        end.appendChild(el('span', null, s.summary));
        log.appendChild(end); scroll = true;
      }
      if (scroll) log.scrollTop = log.scrollHeight;
    }

    this.draw = draw;
    this.setMode = function () {};
    this.setActive = function () {};
  };
})(window.GIGO);
