// Title art: the loading screen (with a real progress bar) and the menu background + logo.
// Versions come from NC.TITLE_ART in config.js; images live in title/ (WebP, JPG fallback).
(function (NC) {
  // a progress bar drawn into the art (image pixels, outer pill): our bar is laid exactly over it.
  // Art without a drawn bar gets our bar in its clear bottom strip.
  var DRAWN = { v2: { portrait: { x0: 119, y0: 1790, x1: 958, y1: 1856, iw: 1080, ih: 1920 } } };
  var ART = NC.TITLE_ART || { loading: 'v2', menu: 'v2', logo: 'v2' };
  function img(v, o) { var b = 'title/title_' + v + '_' + o; return 'url(' + b + '.jpg)'; }
  function imgSet(v, o) { var b = 'title/title_' + v + '_' + o; return 'image-set(url(' + b + '.webp) type("image/webp"), url(' + b + '.jpg) type("image/jpeg"))'; }
  function setBg(el, v, extra) {
    var o = innerHeight >= innerWidth ? 'portrait' : 'landscape';
    el.style.backgroundImage = (extra ? extra + ', ' : '') + img(v, o);              // older browsers
    el.style.backgroundImage = (extra ? extra + ', ' : '') + imgSet(v, o);           // WebP where supported
    return o;
  }

  var S = {
    el: null, bar: null, fill: null, label: null, shown: false, frac: 0, shownAt: 0,
    init: function () {
      this.el = document.getElementById('splash'); this.bar = document.getElementById('sp-bar'); this.fill = this.bar.firstElementChild; this.label = document.getElementById('sp-label');
      var self = this; addEventListener('resize', function () { self.layout(); S.menuBg(); });
      this.menuBg();
      var logo = document.getElementById('logo'); if (logo) { logo.src = 'title/logo_' + ART.logo + '.webp'; logo.onerror = function () { this.onerror = null; this.src = 'title/logo_' + ART.logo + '.jpg'; }; }
      this.hold = /[?&]splash=hold/.test(location.search); // screenshots: keep the loading screen up
      this.show('Loading…');
    },
    menuBg: function () {
      var m = document.getElementById('menu'); if (!m) return;
      // dimmed so the menu reads well; a dark bottom fade also hides the loading bar drawn into the v2 art
      // landscape: the art's own logo sits at the top, so it stays bright and the menu logo is hidden (CSS)
      var land = innerWidth > innerHeight;
      setBg(m, ART.menu, land ? 'linear-gradient(to top, rgba(10,5,7,0.95) 0%, rgba(10,5,7,0.7) 45%, rgba(10,5,7,0.2) 80%, rgba(10,5,7,0) 100%)'
        : 'linear-gradient(to top, rgba(10,5,7,0.97) 0%, rgba(10,5,7,0.9) 14%, rgba(10,5,7,0.62) 34%, rgba(10,5,7,0.55) 100%)');
    },
    layout: function () {
      if (!this.el) return;
      var o = setBg(this.el, ART.loading), d = DRAWN[ART.loading] && DRAWN[ART.loading][o], b = this.bar.style;
      this.bar.classList.toggle('over-art', !!d);
      if (d) { // same maths as background-size: cover; background-position: center
        var W = innerWidth, H = innerHeight, k = Math.max(W / d.iw, H / d.ih), ox = (W - d.iw * k) / 2, oy = (H - d.ih * k) / 2;
        b.left = (ox + d.x0 * k) + 'px'; b.top = (oy + d.y0 * k) + 'px'; b.width = ((d.x1 - d.x0) * k) + 'px'; b.height = ((d.y1 - d.y0) * k) + 'px'; b.bottom = b.transform = '';
      } else { b.left = '50%'; b.transform = 'translateX(-50%)'; b.top = ''; b.bottom = 'calc(5% + env(safe-area-inset-bottom))'; b.width = 'min(72%, 560px)'; b.height = '24px'; }
    },
    show: function (text) {
      if (!this.el) return; this.layout(); this.el.classList.remove('hidden', 'fade'); this.shown = true; this.shownAt = performance.now(); this.set(0, text);
    },
    set: function (f, text) {
      if (!this.el) return; this.frac = Math.max(this.frac * (f === 0 ? 0 : 1), Math.min(1, f)); this.bar.style.setProperty('--f', this.frac.toFixed(3));
      if (text !== undefined) this.label.textContent = text;
    },
    hide: function (minMs) {
      if (!this.el || !this.shown || this.hold) return; var self = this, wait = Math.max(0, (minMs || 0) - (performance.now() - this.shownAt));
      this.set(1); this.shown = false;
      setTimeout(function () { if (self.shown) return; self.el.classList.add('fade'); setTimeout(function () { if (!self.shown) self.el.classList.add('hidden'); }, 450); }, wait + 150);
    }
  };
  NC.Splash = S;
})(globalThis.NC = globalThis.NC || {});
