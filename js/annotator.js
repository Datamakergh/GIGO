/* GIGO – bounding-box annotation tool on a canvas.
 * Draw by dragging anywhere (including over other boxes); click a box to select it, then drag it to move
 * (Alt-drag always draws), drag a handle to resize;
 * Delete removes it; choosing a class (or keys 1-5) relabels the selected box.
 * Zoom: +/- buttons, Ctrl/Cmd+wheel, or keys + - 0. Pan: hold Space (or middle mouse) and drag. */
window.GIGO = window.GIGO || {};
(function (G) {
  'use strict';

  G.Annotator = function (canvas) {
    var self = this, ctx = canvas.getContext('2d');
    var W = G.SCENE.width, H = G.SCENE.height, HS = 12, MIN = 8;
    var boxes = [], nextId = 1, selId = null, curCls = G.CLASSES[0].id;
    var drag = null, locked = false, showKey = false, showLabels = true, flash = null, hoverCursor = 'crosshair';
    var listeners = { change: [], select: [] };
    var Z_MIN = 1, Z_MAX = 4, z = 1, ox = 0, oy = 0, panning = null, spaceDown = false;

    function emit(type) { listeners[type].forEach(function (fn) { fn(); }); }
    self.on = function (type, fn) { listeners[type].push(fn); };

    function pt(e) {
      var r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * W / r.width - ox) / z, y: ((e.clientY - r.top) * H / r.height - oy) / z };
    }
    function canvasPt(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    }
    function setView(nz, cx, cy) {
      // keep the scene point under canvas position (cx, cy) fixed while zooming
      nz = Math.max(Z_MIN, Math.min(Z_MAX, nz));
      var sx = (cx - ox) / z, sy = (cy - oy) / z;
      z = nz; ox = cx - sx * z; oy = cy - sy * z;
      ox = clamp(ox, W - W * z, 0); oy = clamp(oy, H - H * z, 0);
      updateZoomUI(); render();
    }
    function zoomBy(f, e) { var c = e ? canvasPt(e) : { x: W / 2, y: H / 2 }; setView(z * f, c.x, c.y); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function find(id) { for (var i = 0; i < boxes.length; i++) if (boxes[i].id === id) return boxes[i]; return null; }
    function handles(b) {
      var mx = b.x + b.w / 2, my = b.y + b.h / 2, r = b.x + b.w, d = b.y + b.h;
      return [{ n: 'nw', x: b.x, y: b.y }, { n: 'n', x: mx, y: b.y }, { n: 'ne', x: r, y: b.y }, { n: 'e', x: r, y: my },
              { n: 'se', x: r, y: d }, { n: 's', x: mx, y: d }, { n: 'sw', x: b.x, y: d }, { n: 'w', x: b.x, y: my }];
    }
    function hitHandle(b, p) {
      var hs = handles(b), tol = (HS * 0.5 + 3) / z;
      for (var i = 0; i < hs.length; i++) if (Math.abs(p.x - hs[i].x) <= tol && Math.abs(p.y - hs[i].y) <= tol) return hs[i].n;
      return null;
    }
    function hitBox(p) {
      for (var i = boxes.length - 1; i >= 0; i--) {
        var b = boxes[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
      }
      return null;
    }
    function cursorFor(n) {
      return { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }[n];
    }
    function select(id) { if (selId !== id) { selId = id; emit('select'); } }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        e.preventDefault();
        var c = canvasPt(e);
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        panning = { cx: c.x, cy: c.y, ox: ox, oy: oy }; canvas.style.cursor = 'grabbing'; return;
      }
      if (locked || e.button > 0) return;
      var p = pt(e), sel = find(selId), n, hit;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      if (sel && (n = hitHandle(sel, p))) {
        drag = { mode: 'resize', n: n, orig: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }, id: sel.id };
      } else if ((hit = hitBox(p)) && hit.id === selId && !e.altKey) {
        // only the selected box moves; on any other box a drag draws and a plain click selects
        drag = { mode: 'move', dx: p.x - hit.x, dy: p.y - hit.y, id: hit.id, moved: false };
      } else {
        if (!hit) select(null);
        drag = { mode: 'draw', sx: clamp(p.x, 0, W), sy: clamp(p.y, 0, H), cur: { x: p.x, y: p.y }, pendingId: hit && !e.altKey ? hit.id : null };
      }
      render();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (panning) {
        var c = canvasPt(e);
        ox = clamp(panning.ox + c.x - panning.cx, W - W * z, 0); oy = clamp(panning.oy + c.y - panning.cy, H - H * z, 0);
        render(); return;
      }
      var p = pt(e);
      if (!drag) {
        if (spaceDown) { canvas.style.cursor = 'grab'; return; }
        if (locked) { canvas.style.cursor = 'default'; return; }
        var sel = find(selId), n = sel && hitHandle(sel, p);
        var hb = hitBox(p);
        hoverCursor = n ? cursorFor(n) : (hb && hb.id === selId ? 'move' : 'crosshair');
        canvas.style.cursor = hoverCursor;
        return;
      }
      var b = find(drag.id);
      if (drag.mode === 'draw') {
        drag.cur = { x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) };
      } else if (drag.mode === 'move') {
        b.x = clamp(p.x - drag.dx, 0, W - b.w); b.y = clamp(p.y - drag.dy, 0, H - b.h); drag.moved = true;
      } else {
        var o = drag.orig, l = o.x, t = o.y, r = o.x + o.w, d = o.y + o.h, n = drag.n;
        if (n.indexOf('w') >= 0) l = clamp(p.x, 0, W);
        if (n.indexOf('e') >= 0) r = clamp(p.x, 0, W);
        if (n.indexOf('n') >= 0) t = clamp(p.y, 0, H);
        if (n.indexOf('s') >= 0) d = clamp(p.y, 0, H);
        b.x = Math.min(l, r); b.y = Math.min(t, d); b.w = Math.max(MIN, Math.abs(r - l)); b.h = Math.max(MIN, Math.abs(d - t));
        drag.moved = true;
      }
      render();
    });

    function finish() {
      if (panning) { panning = null; canvas.style.cursor = spaceDown ? 'grab' : (locked ? 'default' : 'crosshair'); return; }
      if (!drag) return;
      var d = drag; drag = null;
      if (d.mode === 'draw') {
        var x = Math.min(d.sx, d.cur.x), y = Math.min(d.sy, d.cur.y), w = Math.abs(d.cur.x - d.sx), h = Math.abs(d.cur.y - d.sy);
        if (w >= MIN && h >= MIN) {
          var b = { id: 'u' + nextId++, x: x, y: y, w: w, h: h, cls: curCls };
          boxes.push(b); select(null); emit('change');
        } else if (d.pendingId) select(d.pendingId);
      } else if (d.moved) emit('change');
      render();
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);

    canvas.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel keeps scrolling the page; Ctrl/Cmd+wheel or pinch zooms
      e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e);
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { if (panning) e.preventDefault(); });

    document.addEventListener('keyup', function (e) {
      if (e.key === ' ' && spaceDown) { spaceDown = false; if (!panning) canvas.style.cursor = locked ? 'default' : 'crosshair'; }
    });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag)) return;
      if (e.key === ' ') { if (z > 1) { e.preventDefault(); spaceDown = true; } return; }
      if (e.key === '+' || e.key === '=') { zoomBy(1.25); return; }
      if (e.key === '-' || e.key === '_') { zoomBy(1 / 1.25); return; }
      if (e.key === '0') { self.resetZoom(); return; }
      if (locked) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selId) { e.preventDefault(); self.deleteSelected(); } }
      else if (e.key === 'Escape') { select(null); render(); }
      else {
        for (var i = 0; i < G.CLASSES.length; i++) if (G.CLASSES[i].key === e.key) { self.setClass(G.CLASSES[i].id); return; }
      }
    });

    self.zoomIn = function () { zoomBy(1.25); };
    self.zoomOut = function () { zoomBy(1 / 1.25); };
    self.resetZoom = function () { z = 1; ox = 0; oy = 0; updateZoomUI(); render(); };

    // zoom controls overlaid on the stage
    var ui = document.createElement('div'), zoomLabel;
    ui.className = 'zoom-ctl'; ui.setAttribute('role', 'group'); ui.setAttribute('aria-label', 'Zoom');
    function zbtn(txt, title, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', fn); ui.appendChild(b); return b;
    }
    var bOut = zbtn('\u2212', 'Zoom out (-)', self.zoomOut);
    zoomLabel = document.createElement('button'); zoomLabel.type = 'button'; zoomLabel.className = 'zoom-val';
    zoomLabel.title = 'Reset zoom (0)'; zoomLabel.addEventListener('click', self.resetZoom); ui.appendChild(zoomLabel);
    var bIn = zbtn('+', 'Zoom in (+)', self.zoomIn);
    if (canvas.parentNode) canvas.parentNode.appendChild(ui);
    function updateZoomUI() {
      zoomLabel.textContent = Math.round(z * 100) + '%';
      bOut.disabled = z <= Z_MIN; bIn.disabled = z >= Z_MAX;
      zoomLabel.disabled = z === 1;
    }
    updateZoomUI();

    self.getBoxes = function () { return boxes.map(function (b) { return { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, cls: b.cls }; }); };
    self.getClass = function () { return curCls; };
    self.getSelected = function () { return find(selId); };
    self.setClass = function (cls) {
      curCls = cls;
      var sel = find(selId);
      if (sel && !locked && sel.cls !== cls) { sel.cls = cls; emit('change'); }
      emit('select'); render();
    };
    self.deleteSelected = function () {
      if (locked || !selId) return;
      boxes = boxes.filter(function (b) { return b.id !== selId; });
      selId = null; emit('select'); emit('change'); render();
    };
    self.clear = function () { boxes = []; selId = null; emit('select'); emit('change'); render(); };
    // after G.useScenario(): drop boxes, pick the new first class, reset zoom and the answer key
    self.reset = function () {
      boxes = []; selId = null; drag = null; flash = null; showKey = false; curCls = G.CLASSES[0].id;
      z = 1; ox = 0; oy = 0; updateZoomUI(); emit('select'); emit('change'); render();
    };
    self.setLocked = function (v) { locked = v; canvas.style.cursor = v ? 'default' : 'crosshair'; canvas.classList.toggle('locked', v); render(); };
    self.setShowKey = function (v) { showKey = v; render(); };
    self.setShowLabels = function (v) { showLabels = v; render(); };
    self.flashGT = function (id) {
      flash = { id: id, t0: performance.now() };
      (function tick() { render(); if (flash && performance.now() - flash.t0 < 2400) requestAnimationFrame(tick); else { flash = null; render(); } })();
    };

    function label(text, x, y, color) {
      var k = 1 / z;
      ctx.font = '600 ' + 15 * k + 'px system-ui, sans-serif';
      var w = ctx.measureText(text).width + 12 * k, h = 21 * k;
      var ty = y - h < 0 ? y + 2 * k : y - h;
      ctx.fillStyle = color; G.roundRect(ctx, x - k, ty, w, h, 4 * k); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 5 * k, ty + h / 2 + k);
    }

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(z, 0, 0, z, ox, oy);
      ctx.drawImage(G.getSceneCanvas(), 0, 0);
      if (showKey) {
        ctx.save(); ctx.setLineDash([7, 5]); ctx.lineWidth = 2.5;
        G.GROUND_TRUTH.forEach(function (g) {
          ctx.strokeStyle = '#ffffff'; ctx.strokeRect(g.box.x, g.box.y, g.box.w, g.box.h);
          ctx.strokeStyle = '#111827'; ctx.lineDashOffset = 6; ctx.strokeRect(g.box.x, g.box.y, g.box.w, g.box.h); ctx.lineDashOffset = 0;
        });
        ctx.restore();
      }
      if (flash) {
        var g = G.GROUND_TRUTH.filter(function (q) { return q.id === flash.id; })[0];
        var pulse = 0.5 + 0.5 * Math.sin((performance.now() - flash.t0) / 110);
        ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(250,204,21,' + (0.45 + 0.55 * pulse) + ')';
        ctx.setLineDash([9, 6]); ctx.strokeRect(g.box.x - 4, g.box.y - 4, g.box.w + 8, g.box.h + 8); ctx.restore();
        label('Look here: ' + g.cls, g.box.x - 4, g.box.y - 4, '#a16207');
      }
      boxes.forEach(function (b) {
        var c = G.classColor(b.cls), sel = b.id === selId, k = 1 / z, hs = HS * k;
        ctx.fillStyle = c + '26'; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.lineWidth = (sel ? 4 : 3) * k; ctx.strokeStyle = c; ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (showLabels) label(b.cls, b.x, b.y, c);
        if (sel && !locked) {
          handles(b).forEach(function (h) {
            ctx.fillStyle = '#fff'; ctx.strokeStyle = c; ctx.lineWidth = 2 * k;
            ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs); ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
          });
        }
      });
      if (drag && drag.mode === 'draw') {
        var x = Math.min(drag.sx, drag.cur.x), y = Math.min(drag.sy, drag.cur.y);
        var c2 = G.classColor(curCls);
        ctx.setLineDash([6, 4]); ctx.lineWidth = 3; ctx.strokeStyle = c2; ctx.fillStyle = c2 + '22';
        ctx.fillRect(x, y, Math.abs(drag.cur.x - drag.sx), Math.abs(drag.cur.y - drag.sy));
        ctx.strokeRect(x, y, Math.abs(drag.cur.x - drag.sx), Math.abs(drag.cur.y - drag.sy));
        ctx.setLineDash([]);
      }
    }
    self.render = render;
    render();
  };
})(window.GIGO);
