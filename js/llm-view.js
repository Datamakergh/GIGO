/* GIGO – renders the live chatbot test (llm-sim.js) in #chat instead of the sim canvas: transcript, suggested questions,
 * an input box and a Finish button. app.js sets onAsk(text), onFinish() and onLocate(id). */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var TAG = { correct: ['Correct', 'ok'], hallucination: ['Hallucination', 'bad'], unsafe: ['Unsafe', 'bad'], unsure: ['Not sure', 'warn'], nomatch: ['No match', 'warn'] };

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  G.LLMView = function (root) {
    var self = this, lastS = null, nodes = [], log, head, end, chips, input, send, finishBtn, chipKey = '';

    function submit(text) {
      text = (text || '').trim();
      if (!text || !self.onAsk) return;
      input.value = '';
      self.onAsk(text);
      input.focus();
    }

    function build(s) {
      while (root.firstChild) root.removeChild(root.firstChild);
      head = el('div', 'chat-head');
      head.appendChild(el('span', 'chat-dot'));
      head.appendChild(el('b', null, 'GIGO Assistant'));
      head.appendChild(el('span', 'chat-score'));
      log = el('div', 'chat-log'); log.setAttribute('aria-live', 'polite');
      chips = el('div', 'chat-chips');
      var form = el('form', 'chat-form');
      input = el('input'); input.type = 'text'; input.placeholder = 'Ask the chatbot a question…'; input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Your question');
      send = el('button', 'chat-send', 'Send'); send.type = 'submit';
      finishBtn = el('button', 'chat-finish', 'Finish chat'); finishBtn.type = 'button';
      form.addEventListener('submit', function (e) { e.preventDefault(); submit(input.value); });
      finishBtn.addEventListener('click', function () { if (self.onFinish) self.onFinish(); });
      form.appendChild(input); form.appendChild(send); form.appendChild(finishBtn);
      root.appendChild(head); root.appendChild(log); root.appendChild(chips); root.appendChild(form);
      nodes = []; end = null; chipKey = '';
    }

    /* three rephrased example questions for topics nobody has asked about yet */
    function drawChips(s) {
      var list = s.done ? [] : G.LLMSim.untried(s).slice(0, 3), key = list.map(function (g) { return g.id; }).join();
      if (key === chipKey) return;
      chipKey = key;
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      if (list.length) chips.appendChild(el('span', 'chat-chips-label', 'Try:'));
      list.forEach(function (g) {
        var b = el('button', 'chip-q', g.ask); b.type = 'button';
        b.addEventListener('click', function () { submit(g.ask); });
        chips.appendChild(b);
      });
    }

    function draw(s) {
      var P = G.LLMSim.P;
      if (s !== lastS) { build(s); lastS = s; }
      var scroll = false;
      s.msgs.forEach(function (m, i) {
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
          if (m.tip) {
            var tip = el('div', 'msg-tip', m.tip + ' ');
            var go = el('button', 'msg-go', 'Go to ' + m.tip.match(/Q\d+/)[0]); go.type = 'button';
            go.addEventListener('click', function () { if (self.onLocate) self.onLocate(m.tipId); });
            tip.appendChild(go); n.bot.appendChild(tip);
          }
          scroll = true;
        }
      });
      drawChips(s);
      input.disabled = send.disabled = finishBtn.disabled = s.done;
      var answered = s.msgs.filter(function (m) { return m.id; }).length;
      head.lastChild.textContent = answered ? s.stats.correct + ' / ' + s.stats.asked + ' topics right' : 'listening';
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
    this.focus = function () { if (input && !input.disabled) input.focus(); };
    this.setMode = function () {};
    this.setActive = function () {};
  };
})(window.GIGO);
