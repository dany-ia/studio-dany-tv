/* Studio Dany TV — pixel-art Caribbean beach with a tiki bar (Playa del Carmen).
   Everything is drawn on a 320x180 logical canvas (1 logical px = 6 screen px at 1080p) and
   scaled up once per frame with smoothing off: consistent pixel size, tiny fill cost.
   State comes from window.ENV (app.js: clock, Open-Meteo, dev overrides). */
(function (global) {
  "use strict";
  var LW = 320, LH = 180, HORIZON = 96, SHORE = 126;
  var off = document.createElement("canvas"); off.width = LW; off.height = LH;
  var g = off.getContext("2d");
  var cv, ctx, W, H, started = false, last = 0, t0 = 0;
  var fps = { frames: 0, acc: 0, value: 0, worst: 0, maxFrame: 0 };

  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, k) { var A = hex(a), B = hex(b); return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * k) + "," + Math.round(A[1] + (B[1] - A[1]) * k) + "," + Math.round(A[2] + (B[2] - A[2]) * k) + ")"; }
  function hash(i, j) { var x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); }

  // ---------------- state ----------------
  function state() {
    var E = global.ENV || {}, D = (global.DEV && global.DEV.on) ? global.DEV : {};
    var d = new Date();
    return {
      hour: D.hour != null ? D.hour : d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600,
      sunrise: E.sunrise || 6.5, sunset: E.sunset || 18.1,
      code: D.code != null ? D.code : (E.code != null ? E.code : 0),
      wind: D.wind != null ? D.wind : (E.wind != null ? E.wind : 10),
      month: D.month != null ? D.month : d.getMonth() + 1,
      day: D.day != null ? D.day : d.getDate()
    };
  }

  // ---------------- sky (step 1: fixed day palette; the time engine arrives in step 2) ----------------
  function sky(S, t) {
    var top = "#3f9fe8", mid = "#8fd2ff", hor = "#dff3ff";
    for (var y = 0; y < HORIZON; y += 4) {
      var k = y / HORIZON;
      R(0, y, LW, 4, k < 0.5 ? mix(top, mid, k * 2) : mix(mid, hor, (k - 0.5) * 2));
    }
    // sun (step 1: fixed late-morning position, top right, clear of the bar roof)
    sunDisc(236, 26, "#fff3b0", "#ffd76b");
    // a few soft clouds
    cloud(40, 30, 1); cloud(140, 18, 0.8); cloud(290, 40, 0.7);
  }
  function sunDisc(cx, cy, c1, c2) {
    for (var r = 0; r < 8; r++) { var w = Math.round(Math.sqrt(64 - r * r)); R(cx - w, cy - r, w * 2, 1, r > 5 ? c2 : c1); R(cx - w, cy + r, w * 2, 1, r > 5 ? c2 : c1); }
  }
  function cloud(x, y, s) {
    var c = "#ffffff", sh = "#dcefff";
    R(x, y + 4 * s, 26 * s, 5 * s, c); R(x + 5 * s, y + 1 * s, 10 * s, 5 * s, c); R(x + 13 * s, y, 8 * s, 6 * s, c);
    R(x, y + 8 * s, 26 * s, 1, sh);
  }

  // ---------------- sea & sand ----------------
  function sea(S, t) {
    var bands = ["#1a7fb0", "#1d97bf", "#21b2c9", "#2cc4cc", "#48d6d0", "#6fe3d9", "#9deee6"];
    var bh = Math.ceil((SHORE - HORIZON) / bands.length);
    for (var i = 0; i < bands.length; i++) R(0, HORIZON + i * bh, LW, bh, bands[i]);
    // static glints and wave lines (animated in step 5)
    for (var k = 0; k < 40; k++) { var x = Math.floor(hash(k, 1) * LW), y = HORIZON + 3 + Math.floor(hash(k, 2) * 20); R(x, y, 3 + Math.floor(hash(k, 3) * 5), 1, "rgba(255,255,255,0.45)"); }
    for (var f = 0; f < LW; f += 7) R(f, SHORE - 2, 4, 1, "#eafcff");        // foam edge
    R(0, SHORE - 1, LW, 1, "#f6ffff");
  }
  function sand(S, t) {
    R(0, SHORE, LW, LH - SHORE, "#f1dfae");
    R(0, SHORE, LW, 3, "#d8c48c");                                            // wet sand
    for (var k = 0; k < 90; k++) { var x = Math.floor(hash(k, 7) * LW), y = SHORE + 4 + Math.floor(hash(k, 8) * (LH - SHORE - 4)); R(x, y, 1, 1, hash(k, 9) < 0.5 ? "#e4cf98" : "#f9ecc4"); }
    // shells
    R(30, 160, 2, 1, "#ffb6c1"); R(31, 159, 1, 1, "#ffdbe4"); R(150, 170, 2, 2, "#ffe9a8"); R(96, 150, 1, 1, "#ffffff");
  }

  // ---------------- palms & hammock ----------------
  function palm(bx, by, h, lean, t, sway) {
    // trunk: stacked 3px segments curving by `lean`
    var x = bx;
    for (var i = 0; i < h; i += 2) { var k = i / h; x = bx + lean * k * k + sway * k * k; R(x, by - i, 3, 2, i % 6 < 3 ? "#8a5a2b" : "#6f4521"); }
    var tx = x + 1, ty = by - h;
    // fronds: 7 arcs
    var dirs = [[-1, -0.1], [-1, 0.5], [-0.5, 0.9], [0.4, 0.9], [1, 0.5], [1, -0.1], [0.1, -0.7]];
    for (var f = 0; f < dirs.length; f++) {
      var dx = dirs[f][0], dy = dirs[f][1], px = tx, py = ty;
      for (var s = 0; s < 14; s++) {
        var droop = dy + s * 0.09; px += dx * 1.3 + sway * 0.04 * s; py += droop * 0.6;
        R(px, py, 2, 1, s < 9 ? "#2f9e4f" : "#1f7a3a"); if (s % 3 === 0) R(px, py + 1, 1, 1, "#176b31");
      }
    }
    R(tx - 1, ty + 1, 2, 2, "#5a3a1a"); R(tx + 2, ty + 2, 2, 2, "#6b4a22");      // coconuts
  }
  function hammock(x1, x2, y) {
    var n = x2 - x1;
    for (var i = 0; i <= n; i++) { var k = i / n, sag = Math.sin(k * Math.PI) * 9; R(x1 + i, y + sag, 1, 3, (i % 6 < 3) ? "#f2f2f2" : "#ff8c69"); if (i % 2 === 0) R(x1 + i, y + sag + 3, 1, 1, "#d0d0d0"); }
    R(x1 - 1, y - 2, 1, 3, "#5a3a1a"); R(x2, y - 2, 1, 3, "#5a3a1a");          // ropes
  }

  // ---------------- tiki bar (static, pre-rendered once) ----------------
  var barCanvas = null;
  function buildBar() {
    barCanvas = document.createElement("canvas"); barCanvas.width = LW; barCanvas.height = LH;
    var G = g; g = barCanvas.getContext("2d");
    var X = 196, dark = "#5a3416", wood = "#8a5a2b", wood2 = "#6b3f1d";
    // posts
    R(X + 6, 100, 3, 62, wood2); R(X + 98, 100, 3, 62, wood2); R(X + 52, 92, 3, 50, wood2);
    // back bar (shelf with bottles)
    R(X + 10, 118, 88, 22, "#3b2314"); R(X + 10, 118, 88, 1, "#8a5a2b"); R(X + 10, 128, 88, 1, "#8a5a2b");
    var bc = ["#ff5e5e", "#5ef2ff", "#ffd36b", "#9bff8a", "#ff9ad5", "#c4a2ff", "#ffffff", "#ff9d3b"];
    for (var b = 0; b < 8; b++) { var bx = X + 14 + b * 10; R(bx, 121, 3, 7, bc[b]); R(bx + 1, 119, 1, 2, bc[b]); R(bx, 131, 3, 7, bc[(b + 3) % 8]); R(bx + 1, 129, 1, 2, bc[(b + 3) % 8]); }
    // bartender silhouette (head, shoulders, hat, white shirt)
    R(X + 44, 120, 6, 6, "#3a2a1f"); R(X + 42, 118, 10, 2, "#2b1d14"); R(X + 45, 116, 4, 2, "#2b1d14");
    R(X + 39, 126, 16, 14, "#f6f6f6"); R(X + 39, 126, 16, 1, "#ddd"); R(X + 46, 128, 2, 10, "#ff5e5e");
    R(X + 36, 128, 3, 8, "#3a2a1f"); R(X + 55, 128, 3, 8, "#3a2a1f");
    // counter
    R(X + 2, 140, 104, 3, "#a86d33"); R(X + 2, 143, 104, 18, wood2);
    for (var s = 0; s < 104; s += 6) R(X + 2 + s, 143, 1, 18, "#5a3416");          // bamboo slats
    R(X + 2, 152, 104, 1, "#4a2a10");
    // things on the counter: cocktail, coconut, tiki mug
    R(X + 14, 136, 3, 4, "#ff9d3b"); R(X + 15, 134, 1, 2, "#9bff8a"); R(X + 13, 139, 5, 1, "#fff");
    R(X + 70, 135, 6, 5, "#6b4a22"); R(X + 72, 133, 2, 2, "#fff"); R(X + 86, 135, 4, 5, "#c9a35a"); R(X + 87, 136, 2, 1, "#5a3416");
    // stools
    for (var st = 0; st < 3; st++) { var sx = X + 14 + st * 34; R(sx, 158, 10, 3, "#a86d33"); R(sx + 1, 161, 2, 12, wood2); R(sx + 7, 161, 2, 12, wood2); R(sx + 1, 167, 8, 1, wood2); }
    // palapa roof: layered straw bands from apex to eaves
    var apexY = 84, eaveY = 104;
    for (var y = apexY; y <= eaveY; y++) {
      var k = (y - apexY) / (eaveY - apexY), half = 30 + k * 36;
      R(X + 54 - half, y, half * 2, 1, (y % 3 === 0) ? "#a67c3b" : (y % 3 === 1 ? "#c9a35a" : "#d9b86c"));
    }
    for (var e = 0; e < 120; e += 3) R(X + 54 - 66 + e, eaveY + 1, 2, 2 + (e % 6 === 0 ? 1 : 0), "#8f6a2c");   // fringe
    R(X + 50, apexY - 3, 8, 3, "#8f6a2c"); R(X + 53, apexY - 5, 2, 2, "#8f6a2c");                          // ridge cap
    // sign on the ridge: "TIKI"
    R(X + 36, 92, 36, 8, "#2b1d14"); R(X + 37, 93, 34, 6, "#f4e4b8");
    var T = "#c0392b"; R(X + 40, 94, 5, 1, T); R(X + 42, 94, 1, 4, T); R(X + 47, 94, 1, 4, T); R(X + 50, 94, 1, 4, T); R(X + 51, 95, 1, 1, T); R(X + 52, 96, 1, 1, T); R(X + 51, 97, 1, 1, T); R(X + 52, 98, 1, 1, T); R(X + 55, 94, 1, 4, T);
    R(X + 59, 94, 5, 1, "#1f7a3a"); R(X + 61, 94, 1, 4, "#1f7a3a"); R(X + 65, 94, 5, 4, "#ffd36b");
    // string lights along the eave (bulbs; glow is added at night in step 2)
    for (var l = 0; l < 14; l++) { var lx = X + 54 - 62 + l * 9; R(lx, eaveY + 4 + (l % 2), 1, 1, "#333"); R(lx, eaveY + 5 + (l % 2), 2, 2, ["#ffd36b", "#ff8c69", "#9bff8a", "#5ef2ff"][l % 4]); }
    // surfboard leaning on the left post
    for (var sb = 0; sb < 46; sb++) { var w = sb < 6 ? sb : (sb > 40 ? 46 - sb : 6); R(X - 10 + sb * 0.18, 116 + sb, w, 1, "#ff7f50"); }
    for (var sb2 = 8; sb2 < 40; sb2++) R(X - 10 + sb2 * 0.18 + 2, 116 + sb2, 2, 1, "#fff2cc");
    g = G;
  }

  // ---------------- frame ----------------
  function draw(now) {
    if (!last) { last = now; t0 = now; }
    var dt = now - last; last = now; var t = now - t0;
    fps.frames++; fps.acc += dt; if (dt > fps.maxFrame) fps.maxFrame = dt;
    if (fps.acc >= 1000) { fps.value = Math.round(fps.frames * 1000 / fps.acc); fps.worst = Math.round(fps.maxFrame); fps.frames = 0; fps.acc = 0; fps.maxFrame = 0; }
    var S = state();

    sky(S, t);
    sea(S, t);
    sand(S, t);
    palm(52, 152, 78, 10, t, 0); palm(116, 150, 86, -8, t, 0);
    hammock(60, 118, 118);
    g.drawImage(barCanvas, 0, 0);

    ctx.imageSmoothingEnabled = false; ctx.mozImageSmoothingEnabled = false; ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H);
    global.requestAnimationFrame(draw);
  }

  global.Beach = {
    start: function (canvas, width, height) {
      cv = canvas; ctx = cv.getContext("2d"); cv.width = W = width; cv.height = H = height;
      buildBar();
      if (!started) { started = true; global.requestAnimationFrame(draw); }
    },
    fps: fps,
    size: function () { return { w: W, h: H, lw: LW, lh: LH, px: W / LW }; }
  };
})(window);
