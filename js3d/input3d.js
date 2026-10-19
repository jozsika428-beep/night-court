// Touch controls for the 3D view: tap (raycast pick), drag to pan, pinch to zoom, two-finger twist to rotate,
// hold-then-drag (or the Box button) for a selection box.
import { S } from './camera3d.js';

export class Input3D {
  constructor(canvas, cam, ui, world) {
    this.c = canvas; this.cam = cam; this.ui = ui; this.w = world; this.pts = new Map();
    this.boxEl = document.getElementById('selbox');
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); (this.off = this.off || []).push(() => t.removeEventListener(ev, fn, o)); };
    on(canvas, 'pointerdown', e => this.down(e));
    on(window, 'pointermove', e => this.move(e));
    on(window, 'pointerup', e => this.up(e));
    on(window, 'pointercancel', e => this.up(e, true));
    on(canvas, 'wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    on(canvas, 'contextmenu', e => e.preventDefault());
    on(window, 'keydown', e => { if (e.key === 'q' || e.key === 'Q') cam.rotateBy(-Math.PI / 6); if (e.key === 'e' || e.key === 'E') cam.rotateBy(Math.PI / 6); });
  }
  destroy() { (this.off || []).forEach(f => f()); }

  zoomAt(sx, sy, f) {
    const c = this.cam, a = this.w.groundPoint(sx, sy);
    c.z *= f; c.clamp(); c.apply();
    const b = this.w.groundPoint(sx, sy);
    if (a && b) { c.x += a.x - b.x; c.y += a.y - b.y; c.clamp(); }
  }
  first() { return this.pts.values().next().value; }
  two() { const [a, b] = Array.from(this.pts.values()); return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }

  down(e) {
    e.preventDefault();
    try { this.c.setPointerCapture(e.pointerId); } catch (err) {}
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    clearTimeout(this.lp);
    if (this.pts.size === 1) {
      this.moved = false; this.pinched = false; this.boxing = this.ui.boxMode; this.downT = e.timeStamp; this.lpAuto = false;
      this.lp = setTimeout(() => { if (!this.moved && this.pts.size === 1) { this.boxing = true; this.lpAuto = true; if (navigator.vibrate) navigator.vibrate(15); this.showBox(); } }, 380);
      if (this.boxing) this.showBox();
    } else if (this.pts.size === 2) { this.pinched = true; this.boxing = false; this.hideBox(); this.p0 = this.two(); }
  }
  showBox() { const p = this.first(); this.box = { ox: p.sx, oy: p.sy, x0: p.sx, y0: p.sy, x1: p.x, y1: p.y }; this.drawBox(); }
  hideBox() { this.box = null; if (this.boxEl) this.boxEl.style.display = 'none'; }
  drawBox() { const b = this.box, el = this.boxEl; if (!b || !el) return; el.style.display = 'block'; el.style.left = b.x0 + 'px'; el.style.top = b.y0 + 'px'; el.style.width = (b.x1 - b.x0) + 'px'; el.style.height = (b.y1 - b.y0) + 'px'; }

  move(e) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > 10) {
      // on a slow frame the hold timer can fire before queued moves arrive: if the finger was already
      // moving before the hold time, this is a pan, not a hold-select
      if (!this.moved && this.lpAuto && e.timeStamp - this.downT < 380) { this.boxing = false; this.lpAuto = false; this.hideBox(); }
      this.moved = true;
    }
    const c = this.cam;
    if (this.pts.size === 1) {
      if (this.boxing && this.box) { const b = this.box; b.x0 = Math.min(b.ox, p.x); b.x1 = Math.max(b.ox, p.x); b.y0 = Math.min(b.oy, p.y); b.y1 = Math.max(b.oy, p.y); this.drawBox(); }
      else if (this.moved) {
        clearTimeout(this.lp);
        // "grab" panning: the ground point under the finger stays under the finger
        const a = this.w.groundPoint(px, py), b = this.w.groundPoint(p.x, p.y);
        if (a && b) { c.x += a.x - b.x; c.y += a.y - b.y; c.clamp(); }
      }
    } else if (this.pts.size === 2 && this.p0) {
      const t = this.two(), anchor = this.w.groundPoint(this.p0.mx, this.p0.my);
      c.z *= t.d / this.p0.d;
      let da = t.ang - this.p0.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      c.yaw -= da; c.yawTarget = c.yaw;
      c.clamp(); c.apply();
      const now = this.w.groundPoint(t.mx, t.my);
      if (anchor && now) { c.x += anchor.x - now.x; c.y += anchor.y - now.y; c.clamp(); }
      this.p0 = t;
    }
  }

  up(e, cancel) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    this.pts.delete(e.pointerId); clearTimeout(this.lp);
    if (this.pts.size === 1) { this.p0 = null; return; }
    if (this.pts.size > 0) return;
    if (cancel) { this.hideBox(); return; }
    if (this.boxing && this.box) {
      const b = this.box; this.hideBox();
      if (b.x1 - b.x0 > 8 || b.y1 - b.y0 > 8) {
        const sp = {};
        this.ui.selectWhere(u => { this.cam.project(u.x, u.y, 1, sp); return !sp.behind && sp.x >= b.x0 && sp.x <= b.x1 && sp.y >= b.y0 && sp.y <= b.y1; });
        return;
      }
    }
    this.hideBox();
    if (!this.moved && !this.pinched) this.tap(p.x, p.y);
  }

  tap(sx, sy) {
    this.cam.cam.updateMatrixWorld(); // pick with the camera as it is now, even if no frame has been drawn since it moved
    const gp = this.w.groundPoint(sx, sy); if (!gp) return;
    const u = this.w.pickUnit(sx, sy), b = u ? null : this.w.pickBuilding(sx, sy);
    this.ui.tapWith(gp.x, gp.y, u, b);
  }
}
