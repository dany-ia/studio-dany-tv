/* decor.js — month / holiday decorations driven by decorations.json.
   Each rule has a date range and layers; each layer names a primitive below plus parameters.
   Layers are painted once into three cached canvases (sand / back / front) and repainted when the
   month or day changes. `countdown` is the only dynamic layer (drawn per frame on Dec 31). */
(function (global) {
  "use strict";
  var rules = [], key = "", canvases = { sand: null, back: null, front: null }, dynamic = [], lights = [], P;   // P = painter from sprites.js
  function light(x, y, c, r) { lights.push({ x: x, y: y, c: c, r: r || 7 }); }        // glow sources drawn after the night tint

  function mk() { var c = document.createElement("canvas"); c.width = 960; c.height = 540; return c; }
  function mmdd(m, d) { return m * 100 + d; }
  function active(month, day) {
    var t = mmdd(month, day), out = [];
    for (var i = 0; i < rules.length; i++) { var r = rules[i], a = r.from.split("-"), b = r.to.split("-"); if (t >= mmdd(+a[0], +a[1]) && t <= mmdd(+b[0], +b[1])) out.push(r); }
    return out;
  }

  /* ---------- primitives (R = rect, T = pixel text) ---------- */
  var R, T;
  var prim = {
    sign: function (l) { var w = (l.text.length * 6 * 2) + 16, x = l.x - w / 2; R(x, l.y - 4, w, 24, "#2b1d14"); R(x + 2, l.y - 2, w - 4, 20, l.bg || "#f4e4b8"); T(x + 8, l.y + 1, l.text, 2, l.fg || "#c0392b"); R(x + w / 2 - 1, l.y - 10, 2, 6, "#5a3a1a"); },
    papel: function (l) {       // papel picado: paper pennants with cut-out pattern on a sagging string
      var n = Math.floor((l.x2 - l.x1) / 16);
      for (var i = 0; i <= n; i++) { var k = i / n, x = l.x1 + i * 16, y = l.y + Math.sin(k * Math.PI) * 6, c = l.colors[i % l.colors.length];
        R(x, y, 16, 1, "#333"); R(x + 2, y + 1, 12, 12, c); R(x + 5, y + 4, 2, 2, "#2b1d14"); R(x + 9, y + 4, 2, 2, "#2b1d14"); R(x + 7, y + 8, 2, 2, "#2b1d14"); R(x + 3, y + 11, 10, 1, "#2b1d14"); R(x + 4, y + 13, 2, 2, c); R(x + 10, y + 13, 2, 2, c); }
    },
    hearts: function (l) { var n = Math.floor((l.x2 - l.x1) / 20); for (var i = 0; i <= n; i++) { var k = i / n, x = l.x1 + i * 20, y = l.y + Math.sin(k * Math.PI) * 6; R(x, y, 20, 1, "#333"); heart(x + 7, y + 3, i % 2 ? "#e8453c" : "#ff9ad5"); } },
    flowers: function (l) { for (var i = 0; i < l.n; i++) flower(l.x + i * 14 + (i % 2) * 4, l.y - (i % 3) * 5, ["#ff9ad5", "#ffd36b", "#ff5e5e", "#c4a2ff", "#ffffff"][i % 5]); },
    marigolds: function (l) { for (var i = 0; i < l.n; i++) marigold(l.x + i * 16, l.y - (i % 2) * 6); },
    umbrella: function (l) { var x = l.x, y = l.y; R(x + 15, y - 30, 3, 36, "#8a5a2b"); for (var r = 0; r < 10; r++) { var w = 34 - r * 3; R(x + 16 - w / 2, y - 30 + r, w, 1, (Math.floor((r + 2) / 3) % 2) ? l.c1 : l.c2); } R(x + 2, y - 20, 29, 2, l.c1); },
    tourist: function (l) { person(l.x, l.y, l.pose, l.c); },
    whalesign: function (l) { var x = l.x, y = l.y; R(x + 10, y, 3, 40, "#8a5a2b"); R(x - 20, y - 26, 64, 28, "#2b1d14"); R(x - 18, y - 24, 60, 24, "#f4e4b8"); R(x - 12, y - 18, 30, 8, "#5aa0c8"); R(x - 14, y - 15, 6, 3, "#5aa0c8"); R(x + 18, y - 20, 6, 4, "#5aa0c8"); for (var i = 0; i < 8; i++) R(x - 10 + i * 4, y - 16 + (i % 2) * 3, 1, 1, "#ffffff"); T(x - 16, y - 8, "TIBURÓN", 1, "#1f5a7a"); T(x + 20, y - 18, "!", 2, "#c0392b"); },
    rake: function (l) { var x = l.x, y = l.y; R(x, y, 3, 56, "#8a5a2b"); R(x - 10, y + 54, 24, 3, "#6b3f1d"); for (var i = 0; i < 6; i++) R(x - 10 + i * 4, y + 57, 2, 5, "#6b3f1d"); for (var s = 0; s < 14; s++) R(20 + s * 70 + (s % 3) * 11, 396 + (s % 2) * 3, 10 + (s % 4) * 3, 2, "#7a5a2a"); },
    flagmx: function (l) { var x = l.x, y = l.y; R(x, y - 36, 2, 40, "#8a5a2b"); R(x + 2, y - 36, 8, 14, "#2f9e4f"); R(x + 10, y - 36, 8, 14, "#ffffff"); R(x + 18, y - 36, 8, 14, "#e8453c"); R(x + 13, y - 31, 2, 3, "#8a5a2b"); R(x + 12, y - 28, 4, 1, "#c0392b"); },
    pumpkin: function (l) { pumpkin(l.x, l.y, l.big ? 2 : 1); },
    ofrenda: function (l) {      // altar on the counter: two tiers, marigolds, candles, sugar skull, portrait, pan de muerto
      var x = l.x, y = l.y; R(x - 60, y - 28, 120, 10, "#5a2a6e"); R(x - 44, y - 46, 88, 18, "#7a3a8e"); R(x - 60, y - 29, 120, 2, "#ff9d3b");
      for (var i = 0; i < 7; i++) marigold(x - 54 + i * 18, y - 32); for (var j = 0; j < 4; j++) marigold(x - 36 + j * 24, y - 50);
      candle(x - 56, y - 44); candle(x + 50, y - 44); candle(x - 30, y - 60); candle(x + 26, y - 60);
      skull(x - 2, y - 60); R(x - 12, y - 68, 24, 2, "#ff9d3b");
      R(x + 6, y - 40, 14, 16, "#2b1d14"); R(x + 8, y - 38, 10, 12, "#f4e4b8"); R(x + 11, y - 35, 4, 4, "#d9a06b"); R(x + 10, y - 31, 6, 4, "#5ea8ff");
      R(x - 24, y - 38, 12, 8, "#c98b4a"); R(x - 22, y - 40, 8, 3, "#e0a860"); R(x - 20, y - 39, 2, 1, "#f4e4b8");
    },
    turkey: function (l) { var x = l.x, y = l.y; R(x - 12, y - 10, 24, 10, "#b5651d"); R(x - 8, y - 14, 16, 5, "#c9762a"); R(x - 14, y - 6, 4, 4, "#e0a860"); R(x + 10, y - 6, 4, 4, "#e0a860"); R(x - 16, y - 8, 2, 2, "#ffffff"); R(x + 14, y - 8, 2, 2, "#ffffff"); R(x - 18, y, 36, 3, "#f4e4b8"); for (var i = 0; i < 5; i++) R(x - 14 + i * 7, y - 2, 4, 2, "#2f9e4f"); },
    leaves: function (l) { for (var i = 0; i < l.n; i++) { var x = l.x + i * 29 + (i % 3) * 7, y = l.y + (i % 4) * 12; R(x, y, 3, 2, ["#c9762a", "#e8453c", "#ffd36b", "#b5651d"][i % 4]); R(x + 1, y - 1, 1, 1, "#8a5a2b"); } },
    xmaslights: function (l) {
      var cx = 588 + 156, colors = ["#e8453c", "#2f9e4f", "#ffffff", "#ffd36b"], rgb = ["232,69,60", "47,158,79", "255,255,255", "255,211,107"];
      for (var i = 0; i < 44; i++) { var x = cx - 190 + i * 9, y = 318 + Math.sin((i / 43) * Math.PI * 3) * 3; R(x, y, 1, 3, "#333"); R(x - 1, y + 3, 3, 3, colors[i % 4]); light(x, y + 4, rgb[i % 4], 7); }
      for (var r = 0; r < 10; r++) { R(cx - 92 + r * 20, 254 + (r % 2) * 2, 3, 3, colors[r % 4]); light(cx - 90 + r * 20, 255 + (r % 2) * 2, rgb[r % 4], 6); }
    },
    xmaspalm: function (l) {     // a small palm dressed as a Christmas tree: ornaments and a star
      var x = l.x, y = l.y; R(x, y - 40, 4, 44, "#8a5a2b"); for (var f = 0; f < 6; f++) { var a = -Math.PI * 0.95 + f * 0.38, px = x + 2, py = y - 40; for (var s = 0; s < 16; s++) { px += Math.cos(a) * 1.3; py += Math.sin(a) * 0.9 + 0.05 * s; R(px - 1, py - 1, 3, 2, s < 10 ? "#2f9e4f" : "#1f7a3a"); } }
      var orn = [[-12, -34], [8, -36], [-5, -28], [14, -26], [-16, -22], [4, -20]]; for (var o = 0; o < orn.length; o++) R(x + orn[o][0], y + orn[o][1], 3, 3, ["#e8453c", "#ffd36b", "#5ea8ff", "#ff9ad5"][o % 4]);
      R(x + 1, y - 46, 2, 2, "#ffd36b"); R(x - 1, y - 45, 6, 1, "#ffd36b"); R(x + 1, y - 48, 2, 6, "#ffd36b"); },
    pinata: function (l) { var x = l.x, y = l.y; R(x + 8, y - 14, 1, 14, "#333"); var cols = ["#e8453c", "#ffd36b", "#2f9e4f", "#5ea8ff", "#ff9ad5"]; for (var r = 0; r < 7; r++) R(x, y + r * 3, 18, 3, cols[r % 5]); for (var p = 0; p < 7; p++) { var a = p / 7 * Math.PI * 2; R(x + 9 + Math.cos(a) * 14, y + 10 + Math.sin(a) * 12, 4, 4, cols[(p + 2) % 5]); } for (var s = 0; s < 3; s++) R(x + 2 + s * 6, y + 21, 2, 6, cols[s]); },
    gifts: function (l) { var x = l.x, y = l.y; R(x, y - 10, 14, 12, "#e8453c"); R(x + 6, y - 10, 2, 12, "#ffd36b"); R(x, y - 5, 14, 2, "#ffd36b"); R(x + 16, y - 8, 10, 10, "#5ea8ff"); R(x + 20, y - 8, 2, 10, "#ffffff"); R(x + 16, y - 4, 10, 2, "#ffffff"); R(x + 4, y - 18, 8, 8, "#2f9e4f"); R(x + 7, y - 18, 2, 8, "#ff9ad5"); },
    rosca: function (l) { var x = l.x, y = l.y; for (var r = 0; r < 5; r++) { var w = 40 - Math.abs(r - 2) * 6; R(x - w / 2, y - 10 + r * 2, w, 2, r === 0 || r === 4 ? "#c98b4a" : "#e0a860"); } R(x - 6, y - 7, 12, 4, "#f4e4b8"); var f = ["#e8453c", "#2f9e4f", "#ffd36b", "#ff9ad5"]; for (var i = 0; i < 6; i++) R(x - 16 + i * 6, y - 9 + (i % 2) * 6, 3, 2, f[i % 4]); },
    countdown: function (l) { dynamic.push(l); }
  };
  function heart(x, y, c) { R(x - 3, y, 3, 2, c); R(x + 1, y, 3, 2, c); R(x - 4, y + 2, 9, 2, c); R(x - 3, y + 4, 7, 2, c); R(x - 2, y + 6, 5, 1, c); R(x - 1, y + 7, 3, 1, c); R(x, y + 8, 1, 1, c); }
  function flower(x, y, c) { R(x + 2, y, 2, 8, "#2f9e4f"); R(x + 4, y + 3, 3, 1, "#2f9e4f"); R(x + 1, y - 4, 4, 4, c); R(x, y - 3, 1, 2, c); R(x + 5, y - 3, 1, 2, c); R(x + 2, y - 5, 2, 1, c); R(x + 2, y - 3, 2, 2, "#ffd36b"); }
  function marigold(x, y) { R(x + 3, y, 2, 7, "#2f9e4f"); R(x, y - 6, 8, 6, "#ff9d3b"); R(x + 1, y - 7, 6, 1, "#ff9d3b"); R(x + 2, y - 5, 4, 3, "#ffb347"); R(x + 3, y - 4, 2, 1, "#c9762a"); }
  function candle(x, y) { R(x, y, 5, 12, "#f4e4b8"); R(x + 1, y - 2, 3, 2, "#ffd36b"); R(x + 2, y - 5, 1, 3, "#ff9d3b"); light(x + 2, y - 3, "255,200,110", 12); }
  function skull(x, y) { R(x - 5, y - 8, 10, 9, "#ffffff"); R(x - 4, y + 1, 8, 3, "#ffffff"); R(x - 4, y - 6, 3, 3, "#5a2a6e"); R(x + 1, y - 6, 3, 3, "#5a2a6e"); R(x - 1, y - 2, 2, 2, "#ff9ad5"); R(x - 3, y + 2, 1, 2, "#333"); R(x - 1, y + 2, 1, 2, "#333"); R(x + 1, y + 2, 1, 2, "#333"); R(x - 5, y - 9, 10, 1, "#ff9d3b"); R(x - 2, y - 11, 4, 2, "#ff9ad5"); }
  function pumpkin(x, y, s) { R(x - 7 * s, y - 8 * s, 14 * s, 8 * s, "#ff8c2b"); R(x - 8 * s, y - 6 * s, 16 * s, 4 * s, "#ff8c2b"); R(x - 1 * s, y - 10 * s, 2 * s, 2 * s, "#2f9e4f"); R(x - 5 * s, y - 6 * s, 2 * s, 2 * s, "#2b1d14"); R(x + 3 * s, y - 6 * s, 2 * s, 2 * s, "#2b1d14"); R(x - 4 * s, y - 3 * s, 8 * s, 1 * s, "#2b1d14"); R(x - 3 * s, y - 2 * s, 2 * s, 1 * s, "#2b1d14"); R(x + 1 * s, y - 2 * s, 2 * s, 1 * s, "#2b1d14"); }
  function person(x, y, pose, c) {
    var skin = "#d9a06b";
    if (pose === "lying") { R(x, y - 2, 30, 2, "#ffffff"); R(x + 2, y - 6, 8, 4, skin); R(x + 10, y - 7, 14, 5, c); R(x + 24, y - 5, 8, 3, skin); R(x, y - 8, 10, 2, "#2b1d14"); }
    else if (pose === "sitting") { R(x, y - 22, 8, 8, skin); R(x - 1, y - 24, 10, 3, "#2b1d14"); R(x - 1, y - 14, 10, 10, c); R(x - 3, y - 12, 2, 8, skin); R(x + 9, y - 12, 2, 8, skin); R(x - 1, y - 4, 14, 3, "#3b5a8a"); R(x + 9, y - 1, 4, 2, skin); }
    else { R(x, y - 34, 8, 8, skin); R(x - 1, y - 36, 10, 3, "#2b1d14"); R(x - 1, y - 26, 10, 12, c); R(x - 4, y - 25, 3, 9, skin); R(x + 9, y - 25, 3, 9, skin); R(x, y - 14, 3, 12, "#3b5a8a"); R(x + 5, y - 14, 3, 12, "#3b5a8a"); R(x - 1, y - 2, 4, 2, "#2b1d14"); R(x + 5, y - 2, 4, 2, "#2b1d14"); }
  }

  var glowCanvas = null, glowBox = null;
  function repaint(month, day) {
    var act = active(month, day); dynamic = []; lights = []; glowCanvas = null;
    for (var z in canvases) { canvases[z] = mk(); }
    for (var i = 0; i < act.length; i++) for (var j = 0; j < act[i].layers.length; j++) {
      var l = act[i].layers[j], c = canvases[l.z || "front"];
      P.withContext(c.getContext("2d"), function () { if (prim[l.type]) prim[l.type](l); });
    }
    key = month + "-" + day;
  }

  global.Decor = {
    init: function (painter) {
      P = painter; R = P.R; T = P.text;
      var x = new XMLHttpRequest(); x.open("GET", "decorations.json", true);
      x.onload = function () { try { rules = JSON.parse(x.responseText).rules; key = ""; } catch (e) {} };
      x.send();
    },
    layer: function (z, month, day) { if (key !== month + "-" + day) repaint(month, day); return canvases[z]; },
    /* glows for candles / Christmas lights, drawn after the night tint so they stay bright.
       Rendered once into a cached canvas (positions are static) and blitted with a global flicker. */
    lights: function (L, t) {
      if (L.night < 0.05 || !lights.length) return;
      if (!glowCanvas) {
        glowCanvas = mk(); var x0 = 960, y0 = 540, x1 = 0, y1 = 0;
        P.withContext(glowCanvas.getContext("2d"), function () {
          for (var i = 0; i < lights.length; i++) { var l = lights[i]; P.radial(l.x, l.y, l.r, "rgba(" + l.c + ",A)", 0.6); x0 = Math.min(x0, l.x - l.r); y0 = Math.min(y0, l.y - l.r); x1 = Math.max(x1, l.x + l.r); y1 = Math.max(y1, l.y + l.r); }
        });
        glowBox = [Math.max(0, x0), Math.max(0, y0), Math.min(960, x1) - Math.max(0, x0), Math.min(540, y1) - Math.max(0, y0)];
      }
      var g = P.ctx(), b = glowBox; g.globalAlpha = L.night * (0.8 + 0.2 * Math.sin(t * 7)); g.drawImage(glowCanvas, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]); g.globalAlpha = 1;
    },
    /* per-frame dynamic layers (New Year's Eve countdown) */
    dynamic: function (now) {
      for (var i = 0; i < dynamic.length; i++) {
        var l = dynamic[i], end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999), left = Math.max(0, end - now + 1000);
        var h = Math.floor(left / 3600000), m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
        var txt = "AÑO NUEVO EN " + (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        prim.sign({ text: txt, x: l.x, y: l.y, fg: "#1f5a7a" });
      }
    },
    active: active
  };
})(window);
