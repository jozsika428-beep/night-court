// Touch + mouse controls: tap, drag to pan, pinch to zoom, hold-and-drag (or Box mode) to box-select.
(function (NC) {
  function Input(canvas, cam, ui) {
    this.c = canvas; this.cam = cam; this.ui = ui; this.pts = {}; this.n = 0;
    var self = this;
    canvas.addEventListener('pointerdown', function (e) { self.down(e); });
    window.addEventListener('pointermove', function (e) { self.move(e); });
    window.addEventListener('pointerup', function (e) { self.up(e); });
    window.addEventListener('pointercancel', function (e) { self.up(e, true); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  NC.Input = Input;
  var P = Input.prototype;

  P.toWorld = function (sx, sy) { var c = this.cam; return { x: c.x + (sx - c.vw / 2) / c.z, y: c.y + (sy - c.vh / 2) / c.z }; };
  P.zoomAt = function (sx, sy, f) {
    var c = this.cam, before = this.toWorld(sx, sy);
    c.z = Math.max(c.minZ, Math.min(c.maxZ, c.z * f));
    var after = this.toWorld(sx, sy); c.x += before.x - after.x; c.y += before.y - after.y; c.clamp();
  };

  P.down = function (e) {
    e.preventDefault();
    try { this.c.setPointerCapture(e.pointerId); } catch (err) {}
    this.pts[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    this.n = Object.keys(this.pts).length;
    var self = this;
    if (this.n === 1) {
      this.moved = false; this.pinched = false; this.boxing = this.ui.boxMode;
      clearTimeout(this.lp);
      this.lp = setTimeout(function () { if (!self.moved && self.n === 1) { self.boxing = true; if (navigator.vibrate) navigator.vibrate(15); self.startBox(); } }, 380);
      if (this.boxing) this.startBox();
    } else if (this.n === 2) {
      clearTimeout(this.lp); this.pinched = true; this.boxing = false; this.ui.box = null;
      var p = this.two(); this.pinch0 = { d: p.d, z: this.cam.z, mx: p.mx, my: p.my };
    }
  };
  P.startBox = function () { var p = this.first(); this.ui.box = { x0: p.sx, y0: p.sy, x1: p.x, y1: p.y, ox: p.sx, oy: p.sy }; };
  P.first = function () { for (var k in this.pts) return this.pts[k]; };
  P.two = function () { var a = [], k; for (k in this.pts) a.push(this.pts[k]); var dx = a[0].x - a[1].x, dy = a[0].y - a[1].y; return { d: Math.sqrt(dx * dx + dy * dy) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 }; };

  P.move = function (e) {
    var p = this.pts[e.pointerId]; if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > 10) this.moved = true;
    if (this.n === 1) {
      if (this.boxing && this.ui.box) { var b = this.ui.box; b.x0 = Math.min(b.ox, p.x); b.x1 = Math.max(b.ox, p.x); b.y0 = Math.min(b.oy, p.y); b.y1 = Math.max(b.oy, p.y); }
      else if (this.moved) { clearTimeout(this.lp); this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.cam.clamp(); }
    } else if (this.n === 2 && this.pinch0) {
      var t = this.two(), c = this.cam;
      var w0 = this.toWorld(this.pinch0.mx, this.pinch0.my);
      c.z = Math.max(c.minZ, Math.min(c.maxZ, this.pinch0.z * t.d / this.pinch0.d));
      var w1 = this.toWorld(t.mx, t.my); c.x += w0.x - w1.x; c.y += w0.y - w1.y; c.clamp();
      this.pinch0.mx = t.mx; this.pinch0.my = t.my; this.pinch0.z = c.z; this.pinch0.d = t.d;
    }
  };

  P.up = function (e, cancel) {
    var p = this.pts[e.pointerId]; if (!p) return;
    delete this.pts[e.pointerId]; this.n = Object.keys(this.pts).length;
    clearTimeout(this.lp);
    if (this.n > 0) return;
    if (cancel) { this.ui.box = null; return; }
    if (this.boxing && this.ui.box) {
      var b = this.ui.box, a = this.toWorld(b.x0, b.y0), z = this.toWorld(b.x1, b.y1);
      this.ui.box = null;
      if (b.x1 - b.x0 > 8 || b.y1 - b.y0 > 8) { this.ui.selectBox(a.x, a.y, z.x, z.y); return; }
    }
    this.ui.box = null;
    if (!this.moved && !this.pinched) { var w = this.toWorld(p.x, p.y); this.ui.tap(w.x, w.y); }
  };
})(globalThis.NC = globalThis.NC || {});
