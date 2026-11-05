/* Studio Dany TV — procedural pixel-art synthwave city.
   Static building layers are pre-rendered to offscreen canvases (one drawImage each per frame),
   so the per-frame cost is: sky gradient + sun/moon + stars + ships + particles + a few twinkles.
   Time of day drives the palette: night -> dawn -> day -> dusk -> night, using real sunrise/sunset. */
(function (global) {
  "use strict";

  var cv, ctx, W, H, PX, started = false;
  var layers = [];          // {canvas, parallax, base, windows:[], litWins:[]}
  var stars = [], ships = [], drops = [];
  var t0 = 0, last = 0;
  var sunrise = 6.5, sunset = 18.1;   // hours (local); updated from weather
  var fps = { frames: 0, acc: 0, value: 0, worst: 0, maxFrame: 0, prof: {} };
  var F = global.SCENE_FLAGS = { glow: true, haze: true, reflect: true, rip: true, stars: true, drops: true, twinkle: true, ships: true, sky6: true };
  var prof = {}, pnow = function () { return (global.performance && performance.now) ? performance.now() : Date.now(); };
  function P0() { return pnow(); }
  function P1(name, t) { prof[name] = (prof[name] || 0) + (pnow() - t); }

  // ---------- palette keyframes (hour offsets relative to sunrise/sunset) ----------
  // [top, mid, horizon, glow, groundGlow, starAlpha, windowDensity]
  var P = {
    night: ["#04061a", "#120b33", "#26144d", "#3a1b5c", "#1a0f33", 1.0, 0.36],
    dawn:  ["#1b1247", "#5a2a6e", "#ff7a3d", "#ffc26b", "#5a2a6e", 0.25, 0.22],
    day:   ["#0f2d66", "#2a62b0", "#7fb8e8", "#ffe6bf", "#2b4a7a", 0.0, 0.07],
    dusk:  ["#0a0a2e", "#3a1a5e", "#ff5e7a", "#ffb347", "#4a1f5c", 0.35, 0.28],
    golden:["#16205e", "#5b3a8a", "#ff9a5a", "#ffd27a", "#6a3a6e", 0.08, 0.18]
  };

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mixc(a, b, k) { var A = hex(a), B = hex(b); return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * k) + "," + Math.round(A[1] + (B[1] - A[1]) * k) + "," + Math.round(A[2] + (B[2] - A[2]) * k) + ")"; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function rgbOf(c) {   // "#rrggbb" or "rgb(r,g,b)" -> [r,g,b]
    if (c.charAt(0) === "#") return hex(c);
    var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c); return [+m[1], +m[2], +m[3]];
  }
  function mixc2(a, b, k) { var A = rgbOf(a), B = rgbOf(b); return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * k) + "," + Math.round(A[1] + (B[1] - A[1]) * k) + "," + Math.round(A[2] + (B[2] - A[2]) * k) + ")"; }
  function rgba(c, a) { var C = rgbOf(c); return "rgba(" + C[0] + "," + C[1] + "," + C[2] + "," + a + ")"; }

  // returns blended palette for local hour h (0..24)
  function paletteAt(h) {
    var keys = [
      [sunrise - 1.0, "night"], [sunrise - 0.1, "dawn"], [sunrise + 0.6, "golden"], [sunrise + 1.6, "day"],
      [sunset - 1.6, "day"], [sunset - 0.5, "golden"], [sunset + 0.1, "dusk"], [sunset + 1.0, "night"]
    ];
    var a = keys[keys.length - 1], b = keys[0], k = 0;
    if (h < keys[0][0] || h >= keys[keys.length - 1][0]) { a = keys[keys.length - 1]; b = keys[0]; k = 0; }
    else {
      for (var i = 0; i < keys.length - 1; i++) {
        if (h >= keys[i][0] && h < keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; k = (h - a[0]) / (b[0] - a[0]); break; }
      }
    }
    var pa = P[a[1]], pb = P[b[1]], out = [];
    for (var j = 0; j < 5; j++) out.push(mixc(pa[j], pb[j], k));
    out.push(lerp(pa[5], pb[5], k)); out.push(lerp(pa[6], pb[6], k));
    return out;
  }

  // ---------- helpers ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hash(i, j, s) { var x = Math.sin(i * 12.9898 + j * 78.233 + s * 37.719) * 43758.5453; return x - Math.floor(x); }
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, Math.max(PX, Math.round(w / PX) * PX), Math.max(PX, Math.round(h / PX) * PX)); }

  // ---------- build the static city layers ----------
  function mkLayer(cfg) {
    var L = { parallax: cfg.parallax, base: cfg.base, col: cfg.col, win: cfg.win, buildings: [], wins: [], seed: cfg.seed };
    var x = 0, w, h, span = W * 1.3;        // wider than screen so parallax never shows an edge
    while (x < span) {
      w = rnd(cfg.minW, cfg.maxW) * W; h = rnd(cfg.minH, cfg.maxH) * H;
      var b = { x: x, w: w, h: h, antenna: Math.random() < 0.3 };
      L.buildings.push(b);
      var cols = Math.floor(w / (PX * 3)), rows = Math.floor(h / (PX * 3));
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) L.wins.push({ x: x + PX * 1.5 + i * PX * 3, y: cfg.base - h + PX * 1.5 + j * PX * 3, r: hash(i, j, b.x) });
      x += w + rnd(0.004, 0.02) * W;
    }
    L.span = x;
    L.canvas = document.createElement("canvas"); L.canvas.width = Math.ceil(x); L.canvas.height = H;
    L.density = -1;
    return L;
  }

  function paintLayer(L, density) {
    if (Math.abs(L.density - density) < 0.02) return;
    L.density = density;
    var c = L.canvas.getContext("2d"); c.clearRect(0, 0, L.canvas.width, H);
    for (var i = 0; i < L.buildings.length; i++) {
      var b = L.buildings[i];
      px(c, b.x, L.base - b.h, b.w, b.h, L.col);
      if (b.antenna) { px(c, b.x + b.w / 2, L.base - b.h - PX * 5, PX, PX * 5, L.col); px(c, b.x + b.w / 2, L.base - b.h - PX * 6, PX, PX, "#ff5e7a"); }
    }
    for (var k = 0; k < L.wins.length; k++) { var wn = L.wins[k]; if (wn.r < density) px(c, wn.x, wn.y, PX, PX, L.win); }
  }

  function build() {
    W = cv.width; H = cv.height; PX = Math.max(2, Math.round(W / 320));
    layers = [
      mkLayer({ parallax: 0.010, base: H * 0.86, col: "#140f33", win: "#5e4cff", minW: 0.03, maxW: 0.07, minH: 0.16, maxH: 0.40, seed: 1 }),
      mkLayer({ parallax: 0.025, base: H * 0.90, col: "#0c0a24", win: "#ffb347", minW: 0.04, maxW: 0.09, minH: 0.09, maxH: 0.26, seed: 2 }),
      mkLayer({ parallax: 0.050, base: H * 0.92, col: "#06051a", win: "#ffe08a", minW: 0.06, maxW: 0.13, minH: 0.05, maxH: 0.17, seed: 3 })
    ];
    stars = []; for (var i = 0; i < 260; i++) stars.push({ x: Math.random(), y: Math.random() * 0.6, t: Math.random() * 6.28, s: Math.random() < 0.12 ? 2 : 1 });
    ships = []; for (var j = 0; j < 7; j++) ships.push({ x: Math.random(), y: rnd(0.08, 0.5), v: rnd(0.00018, 0.0006) * (Math.random() < 0.5 ? 1 : -1), c: Math.random() < 0.5 ? "#ff5e7a" : "#5ef2ff" });
    drops = []; for (var k = 0; k < 90; k++) drops.push({ x: Math.random(), y: Math.random(), v: rnd(0.00004, 0.00012), a: rnd(0.08, 0.25) });
  }

  // ---------- per-frame ----------
  function draw(now) {
    if (!last) { last = now; t0 = now; }
    var dt = now - last; last = now;
    fps.frames++; fps.acc += dt; if (dt > fps.maxFrame) fps.maxFrame = dt;
    if (fps.acc >= 1000) { fps.value = Math.round(fps.frames * 1000 / fps.acc); fps.worst = Math.round(fps.maxFrame); var pr = {}; for (var pk in prof) pr[pk] = Math.round(prof[pk] / Math.max(1, fps.frames) * 10) / 10; fps.prof = pr; prof = {}; fps.frames = 0; fps.acc = 0; fps.maxFrame = 0; }
    var t = now - t0;
    var d = new Date(), hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    if (global.SCENE_HOUR_OVERRIDE != null) hour = global.SCENE_HOUR_OVERRIDE;
    var pal = paletteAt(hour);

    var _t = P0();
    // sky: 6-stop gradient, then a soft band of haze near the horizon
    var g = ctx.createLinearGradient(0, 0, 0, H);
    if (F.sky6) { g.addColorStop(0, pal[0]); g.addColorStop(0.30, mixc2(pal[0], pal[1], 0.6)); g.addColorStop(0.50, pal[1]);
    g.addColorStop(0.70, pal[2]); g.addColorStop(0.84, pal[3]); g.addColorStop(1, pal[4]); }
    else { g.addColorStop(0, pal[0]); g.addColorStop(1, pal[4]); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    P1("sky", _t); _t = P0();
    // sun (day) / moon (night): arc across the sky between sunrise and sunset
    var dayFrac = (hour - sunrise) / (sunset - sunrise);
    if (dayFrac > -0.08 && dayFrac < 1.08) {
      var sx = W * (0.15 + 0.7 * dayFrac), sy = H * (0.80 - 0.62 * Math.sin(Math.max(0, Math.min(1, dayFrac)) * Math.PI));
      var low = 1 - Math.sin(Math.max(0, Math.min(1, dayFrac)) * Math.PI);          // 1 near the horizon
      var R = W * (0.12 + 0.16 * low);
      if (F.glow) {
      var glow = ctx.createRadialGradient(sx, sy, PX * 6, sx, sy, R);
      glow.addColorStop(0, "rgba(255,190,110," + (0.35 + 0.35 * low) + ")"); glow.addColorStop(1, "rgba(255,120,80,0)");
      ctx.fillStyle = glow; ctx.fillRect(sx - R, sy - R, R * 2, R * 2);   // bounded fill: GPU fill rate is the limiter on the TV
      }
      for (var r = 0; r < 14; r++) { var rw = Math.sqrt(14 * 14 - r * r) * PX * 2; if (!(r > 6 && r % 2 === 0)) px(ctx, sx - rw / 2, sy + r * PX * 2, rw, PX * 2, r % 3 === 0 ? "#ffb347" : "#ffd27a"); px(ctx, sx - rw / 2, sy - r * PX * 2, rw, PX * 2, r % 3 === 0 ? "#ffb347" : "#ffd27a"); }
    } else {
      var nf = hour < sunrise ? (hour + 24 - sunset) / (24 - sunset + sunrise) : (hour - sunset) / (24 - sunset + sunrise);
      var mx = W * (0.2 + 0.6 * nf), my = H * (0.62 - 0.45 * Math.sin(nf * Math.PI));
      for (var q = 0; q < 7; q++) { var mw = Math.sqrt(7 * 7 - q * q) * PX * 2; px(ctx, mx - mw / 2, my - q * PX * 2, mw, PX * 2, "#e8ecff"); px(ctx, mx - mw / 2, my + q * PX * 2, mw, PX * 2, "#e8ecff"); }
      px(ctx, mx - PX * 2, my - PX * 4, PX * 9, PX * 12, pal[0]);   // crescent bite
    }

    P1("sun", _t); _t = P0();
    // stars
    if (F.stars && pal[5] > 0.01) {
      for (var i = 0; i < stars.length; i++) { var s = stars[i]; ctx.globalAlpha = pal[5] * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.0009 + s.t))); px(ctx, s.x * W, s.y * H, PX * s.s, PX * s.s, "#dfe9ff"); }
      ctx.globalAlpha = 1;
    }

    P1("stars", _t); _t = P0();
    // ships with light trails
    for (var j = 0; F.ships && j < ships.length; j++) {
      var sh = ships[j]; sh.x += sh.v * dt / 16; if (sh.x > 1.08) sh.x = -0.08; if (sh.x < -0.08) sh.x = 1.08;
      var bob = Math.sin(t * 0.002 + j) * PX;
      px(ctx, sh.x * W, sh.y * H + bob, PX * 4, PX, sh.c);
      ctx.globalAlpha = 0.35; px(ctx, sh.x * W + (sh.v > 0 ? -PX * 4 : PX * 4), sh.y * H + bob, PX * 4, PX, "#ffffff");
      ctx.globalAlpha = 0.12; px(ctx, sh.x * W + (sh.v > 0 ? -PX * 10 : PX * 4), sh.y * H + bob, PX * 10, PX, sh.c); ctx.globalAlpha = 1;
    }

    P1("ships", _t); _t = P0();
    // city layers with parallax (slow drift) + window density by time of day
    var offs = [];
    for (var L = 0; L < layers.length; L++) {
      var ly = layers[L]; paintLayer(ly, pal[6] * (L === 0 ? 1 : L === 1 ? 0.85 : 1.1));
      var off = -((t * ly.parallax) % (ly.span - W)); offs[L] = Math.round(off / PX) * PX;
      ctx.drawImage(ly.canvas, offs[L], 0);
      if (F.haze && L === 0) {   // atmospheric haze between the far skyline and the mid layer
        var hz = ctx.createLinearGradient(0, H * 0.62, 0, H * 0.90);
        hz.addColorStop(0, "rgba(0,0,0,0)"); hz.addColorStop(1, rgba(pal[2], 0.40));
        ctx.fillStyle = hz; ctx.fillRect(0, H * 0.62, W, H * 0.28);
      }
      // twinkles: a few windows flicker on top of the baked layer
      for (var k = 0; F.twinkle && k < 14; k++) {
        var wi = (k * 97 + L * 31) % ly.wins.length, wn = ly.wins[wi];
        var f = Math.sin(t * 0.004 + k * 1.7 + L);
        if (f > 0.6) { ctx.globalAlpha = (f - 0.6) * 2; px(ctx, wn.x + off, wn.y, PX, PX, "#ffffff"); ctx.globalAlpha = 1; }
      }
    }

    P1("city", _t); _t = P0();
    // ground: wet-asphalt band that mirrors the front skyline (flipped drawImage, one call)
    var GY = H * 0.92;
    var rg = ctx.createLinearGradient(0, GY, 0, H); rg.addColorStop(0, pal[4]); rg.addColorStop(1, "#05060f");
    ctx.fillStyle = rg; ctx.fillRect(0, GY, W, H - GY);
    if (F.reflect) { ctx.save(); ctx.globalAlpha = 0.28; ctx.translate(0, GY * 2); ctx.scale(1, -1);
    ctx.drawImage(layers[2].canvas, offs[2], 0); ctx.restore(); }
    var rip = ctx.createLinearGradient(0, GY, 0, H); rip.addColorStop(0, "rgba(5,6,15,0.1)"); rip.addColorStop(1, "rgba(5,6,15,0.9)");
    if (F.rip) { ctx.fillStyle = rip; ctx.fillRect(0, GY, W, H - GY); }
    ctx.globalAlpha = 0.22; for (var m = 0; m < 5; m++) px(ctx, (m * 211 + t * 0.015) % W, GY + PX * 2 + m * PX * 2.5, PX * 16, PX, "#8a6cff"); ctx.globalAlpha = 1;

    P1("ground", _t); _t = P0();
    // slow rain of light particles
    for (var n = 0; F.drops && n < drops.length; n++) {
      var dp = drops[n]; dp.y += dp.v * dt; if (dp.y > 1) { dp.y = -0.02; dp.x = Math.random(); }
      ctx.globalAlpha = dp.a; px(ctx, dp.x * W, dp.y * H, PX, PX * 2, "#9ad0ff");
    }
    ctx.globalAlpha = 1;

    P1("drops", _t);
    global.requestAnimationFrame(draw);
  }

  // ---------- public ----------
  global.Scene = {
    start: function (canvas, width, height) {
      cv = canvas; ctx = cv.getContext("2d");
      cv.width = width; cv.height = height; build();
      if (!started) { started = true; global.requestAnimationFrame(draw); }
    },
    resize: function (width, height) { cv.width = width; cv.height = height; build(); },
    setSun: function (riseH, setH) { if (riseH > 0 && setH > riseH) { sunrise = riseH; sunset = setH; } },
    fps: fps,
    size: function () { return { w: W, h: H, px: PX }; }
  };
})(window);
