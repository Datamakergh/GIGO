/* GIGO – scene cards for the Overview and Projects pages. Thumbnails are drawn live from each scene's
 * own art (no image files), with a few answer-key boxes on top to hint at the labelling task. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  var ORDER = ['road', 'warehouse', 'drone', 'crop', 'llm'];

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function thumb(id) {
    var sc = G.useScenario(id), wrap = el('div', 'thumb');
    if (sc.kind === 'text') {
      var mock = el('div', 'thumb-chat');
      sc.groundTruth.slice(0, 3).forEach(function (g, i) {
        mock.appendChild(el('span', 'tc-user', g.q));
        var b = el('span', 'tc-bot ' + (i === 1 ? 'bad' : 'ok'), i === 1 ? g.bad : g.a);
        mock.appendChild(b);
      });
      wrap.appendChild(mock);
      return wrap;
    }
    var c = el('canvas'); c.width = 800; c.height = 500;
    var ctx = c.getContext('2d');
    ctx.drawImage(G.getSceneCanvas(), 0, 0);
    sc.groundTruth.filter(function (g, i) { return i % 3 === 0; }).forEach(function (g) {
      var col = G.classColor(g.cls);
      ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.strokeRect(g.box.x, g.box.y, g.box.w, g.box.h);
      ctx.font = '600 18px system-ui'; var w = ctx.measureText(g.cls).width + 12;
      ctx.fillStyle = col; ctx.fillRect(g.box.x - 2, g.box.y - 24, w, 24);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(g.cls, g.box.x + 4, g.box.y - 11);
    });
    c.setAttribute('aria-hidden', 'true');
    wrap.appendChild(c);
    return wrap;
  }

  G.renderGallery = function (root, ids) {
    (ids || ORDER).forEach(function (id) {
      var sc = G.SCENARIOS[id], k = sc.card;
      var a = el('a', 'scene-card'); a.href = 'play.html?scene=' + id;
      a.appendChild(thumb(id));
      var body = el('div', 'sc-body');
      var top = el('div', 'sc-top');
      top.appendChild(el('span', 'sc-issue', k.issue));
      top.appendChild(el('span', 'sc-place', k.place));
      body.appendChild(top);
      body.appendChild(el('h3', null, k.title));
      body.appendChild(el('p', null, k.blurb));
      var tags = el('ul', 'tags');
      k.tags.forEach(function (t) { tags.appendChild(el('li', null, t)); });
      body.appendChild(tags);
      body.appendChild(el('span', 'sc-go', 'Open scene →'));
      a.appendChild(body);
      root.appendChild(a);
    });
    G.useScenario('road');
  };
})(window.GIGO);
