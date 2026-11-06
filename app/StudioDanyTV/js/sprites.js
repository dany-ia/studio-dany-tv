/* sprites.js — the pixel-art foreground: beach, palms, hammock, tiki bar, bartender, props.
   Drawn on a 960x540 logical grid and blitted 2x (nearest neighbour) onto the 1920x1080 #fg canvas,
   which sits over the WebGL background. Static parts are cached in offscreen canvases; only the
   animated sprites (palms, hammock, bartender) are redrawn per frame. A lighting pass at the end
   shades the sprites consistently with the shader's light state (night tint, twilight warmth,
   string-light glow on counter and sand, golden-hour shadows). The counter props and the ridge sign
   follow the bar schedule (coffee bar in the morning, tiki bar from noon); wind from Open-Meteo drives
   palms, hammock and string lights. */
(function (global) {
  "use strict";
  var LW = 960, LH = 540, SHORE_Y = 394;          // horizon is at y=292, shore at 394 (matches the shader)
  var X = 588;                                     // tiki bar left edge
  var fg, fctx, W, H, g;                           // g = current logical 2D context
  var layers = {};
  var bulbs = [];                                  // string-light positions for the glow pass

  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
  function hash(i, j) { var x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); }
  function mk() { var c = document.createElement("canvas"); c.width = LW; c.height = LH; return c; }

  /* ---------- 5x7 pixel font (uppercase, digits, a few signs) ---------- */
  var FONT = {
    A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 11110 10001 10001 10001 11110", C: "01111 10000 10000 10000 10000 10000 01111",
    D: "11110 10001 10001 10001 10001 10001 11110", E: "11111 10000 11110 10000 10000 10000 11111", F: "11111 10000 11110 10000 10000 10000 10000",
    G: "01111 10000 10000 10111 10001 10001 01111", H: "10001 10001 11111 10001 10001 10001 10001", I: "11111 00100 00100 00100 00100 00100 11111",
    J: "00001 00001 00001 00001 10001 10001 01110", K: "10001 10010 10100 11000 10100 10010 10001", L: "10000 10000 10000 10000 10000 10000 11111",
    M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 11001 10101 10011 10001 10001 10001", O: "01110 10001 10001 10001 10001 10001 01110",
    P: "11110 10001 10001 11110 10000 10000 10000", Q: "01110 10001 10001 10001 10101 10010 01101", R: "11110 10001 10001 11110 10100 10010 10001",
    S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100", U: "10001 10001 10001 10001 10001 10001 01110",
    V: "10001 10001 10001 10001 10001 01010 00100", W: "10001 10001 10001 10101 10101 11011 10001", X: "10001 01010 00100 00100 00100 01010 10001",
    Y: "10001 01010 00100 00100 00100 00100 00100", Z: "11111 00001 00010 00100 01000 10000 11111",
    "0": "01110 10001 10011 10101 11001 10001 01110", "1": "00100 01100 00100 00100 00100 00100 01110", "2": "01110 10001 00001 00110 01000 10000 11111",
    "3": "11110 00001 00001 01110 00001 00001 11110", "4": "00010 00110 01010 10010 11111 00010 00010", "5": "11111 10000 11110 00001 00001 10001 01110",
    "6": "01110 10000 11110 10001 10001 10001 01110", "7": "11111 00001 00010 00100 01000 01000 01000", "8": "01110 10001 10001 01110 10001 10001 01110",
    "9": "01110 10001 10001 01111 00001 00001 01110", "!": "00100 00100 00100 00100 00100 00000 00100", "¡": "00100 00000 00100 00100 00100 00100 00100",
    "É": "00010 11111 10000 11110 10000 10000 11111", "Í": "00010 11111 00100 00100 00100 00100 11111", "Á": "00010 01110 10001 11111 10001 10001 10001",
    " ": "00000 00000 00000 00000 00000 00000 00000", ".": "00000 00000 00000 00000 00000 00000 00100", "-": "00000 00000 00000 11111 00000 00000 00000"
  };
  function text(x, y, s, scale, color) {
    for (var i = 0; i < s.length; i++) {
      var rows = (FONT[s.charAt(i)] || FONT[" "]).split(" ");
      for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) if (rows[r].charAt(c) === "1") R(x + (i * 6 + c) * scale, y + r * scale, scale, scale, color);
    }
    return x + s.length * 6 * scale;
  }

  /* ---------- static: sand ---------- */
  function drawSand() {
    R(0, SHORE_Y, LW, LH - SHORE_Y, "#f1dfae");
    R(0, SHORE_Y, LW, 8, "#d8c48c"); R(0, SHORE_Y, LW, 2, "#fbf3dc");                   // wet sand + foam remnants
    for (var k = 0; k < 400; k++) { var x = Math.floor(hash(k, 7) * LW), y = SHORE_Y + 9 + Math.floor(hash(k, 8) * (LH - SHORE_Y - 9)); R(x, y, 1 + (k % 3 === 0 ? 1 : 0), 1, hash(k, 9) < 0.5 ? "#e4cf98" : "#f9ecc4"); }
    for (var b = 0; b < 6; b++) { var by = SHORE_Y + 20 + b * 22; for (var bx = 0; bx < LW; bx += 2) if (hash(bx, b) < 0.25) R(bx, by + Math.floor(hash(b, bx) * 6), 2, 1, "#e9d6a4"); }  // ripples
    // shells and small stuff
    R(90, 480, 4, 3, "#ffb6c1"); R(91, 479, 2, 1, "#ffdbe4"); R(450, 510, 5, 4, "#ffe9a8"); R(452, 509, 2, 1, "#fff"); R(300, 450, 3, 2, "#ffffff"); R(520, 470, 3, 3, "#f4a3a3");
    // driftwood log
    R(30, 500, 86, 8, "#8a6a44"); R(30, 498, 86, 2, "#a88a5e"); R(112, 496, 10, 12, "#8a6a44"); R(40, 503, 60, 1, "#6e5234");
    // footprints toward the bar and from the chairs to the water
    for (var f = 0; f < 7; f++) { R(560 + f * 14, 505 - f * 6, 4, 6, "#dcc58e"); R(568 + f * 14, 500 - f * 6, 4, 6, "#dcc58e"); }
    for (var f2 = 0; f2 < 8; f2++) { R(430 - f2 * 6, 462 - f2 * 8, 3, 5, "#dcc58e"); R(436 - f2 * 6, 458 - f2 * 8, 3, 5, "#dcc58e"); }
    drawMidground();
  }

  /* ---------- palms (dynamic: sway) ---------- */
  /* Palm: curved trunk + 10 fan fronds with volume. Each frond is a tapered stroke (wide at the base,
     thin at the tip) that droops with distance, serrated with leaflets; darker core, lighter tips. */
  function palm(bx, by, h, lean, sway, t, seed) {        // t here is a phase (frames are cached by phase)
    var x = bx;
    for (var i = 0; i < h; i += 3) { var k = i / h; x = bx + lean * k * k + sway * k * k; R(x, by - i, 7, 3, (i % 12 < 6) ? "#8a5a2b" : "#6f4521"); R(x + 6, by - i, 1, 3, "#5a3a1a"); R(x, by - i, 1, 3, "#a67c3b"); }
    var tx = x + 3, ty = by - h;
    var angles = [-172, -150, -125, -100, -80, -55, -30, -8, 12, -95];     // degrees, 0 = right, -90 = up
    for (var f = 0; f < angles.length; f++) {
      var a = angles[f] * Math.PI / 180, len = (f === 9) ? 30 : 48 + (f % 3) * 6, flutter = Math.sin(t * 2.1 + f + seed) * 0.06;
      var ux = Math.cos(a), uy = Math.sin(a), px = tx, py = ty;
      for (var s = 0; s < len; s++) {
        var k = s / len, droop = 0.022 * s + flutter;            // gravity bends the frond down along its length
        px += ux * 1.15 + sway * 0.015 * k * 10; py += uy * 0.85 + droop;
        var w = Math.max(2, Math.round(9 * Math.pow(1 - k, 0.7)));
        var body = k < 0.35 ? "#2a8f47" : (k < 0.75 ? "#3fb55d" : "#7fe08a");
        R(px - w / 2, py - w / 2, w, w, body);
        if (k < 0.85) R(px - 1, py - 1, 2, 2, "#176b31");           // dark core line
        if (s % 3 === 0 && s > 2) { var nx = -uy, ny = ux, L = w / 2 + 3; R(px + nx * L - 1, py + ny * L - 1, 2, 2, k < 0.6 ? "#1f7a3a" : "#5fd075"); R(px - nx * L - 1, py - ny * L - 1, 2, 2, k < 0.6 ? "#1f7a3a" : "#5fd075"); }
      }
    }
    R(tx - 5, ty + 2, 6, 6, "#5a3a1a"); R(tx + 3, ty + 4, 6, 6, "#6b4a22"); R(tx - 1, ty + 8, 5, 5, "#4e3014");   // coconuts
  }

  /* ---------- hammock (dynamic: swing) ---------- */
  /* Hammock: a catenary between the trunks (cosh profile), striped cloth, spreader bars and ropes. */
  function hammock(x1, x2, y, swing) {
    var n = x2 - x1, S = 24, c = 1.7, den = Math.cosh(c) - 1;
    for (var i = 0; i <= n; i++) {
      var k = i / n, u = 2 * k - 1, sag = S * (1 - (Math.cosh(u * c) - 1) / den), xx = x1 + i + swing * Math.sin(k * Math.PI);
      var thick = 5 + Math.round(3 * Math.sin(k * Math.PI));
      R(xx, y + sag, 1, thick, (Math.floor(i / 8) % 2 === 0) ? "#f6f6f6" : "#ff8c69"); R(xx, y + sag + thick, 1, 1, "#b9b9b9");
      if (i % 4 === 0) R(xx, y + sag + 1, 1, 1, "#ffd9c9");
    }
    R(x1 - 1, y - 3, 2, 10, "#8a5a2b"); R(x2, y - 3, 2, 10, "#8a5a2b");               // spreader bars
    R(x1 - 6, y - 5, 6, 2, "#5a3a1a"); R(x2 + 1, y - 5, 6, 2, "#5a3a1a");              // ropes to the trunks
    R(x1 + Math.round(n * 0.42), y + S - 2, 20, 6, "#5ea8ff"); R(x1 + Math.round(n * 0.42) + 2, y + S - 1, 16, 2, "#8cc4ff");   // pillow
  }

  /* ---------- tiki bar: back part (posts, wall, bottles, roof, sign, lights) ---------- */
  function drawBarBack() {
    var wood = "#8a5a2b", wood2 = "#6b3f1d";
    var posts = [X + 18, X + 150, X + 294];
    for (var p = 0; p < posts.length; p++) { R(posts[p], 300, 7, 186, wood2); R(posts[p], 300, 2, 186, wood); }
    // back wall + shelves with bottles
    R(X + 28, 352, 268, 70, "#3b2314"); for (var s = X + 28; s < X + 296; s += 8) R(s, 352, 1, 70, "#2b1a0e");
    R(X + 28, 352, 268, 3, "#8a5a2b"); R(X + 28, 386, 268, 3, "#8a5a2b");
    var bc = ["#ff5e5e", "#5ef2ff", "#ffd36b", "#9bff8a", "#ff9ad5", "#c4a2ff", "#ffffff", "#ff9d3b", "#5ef2ff", "#ffd36b"];
    for (var b = 0; b < 10; b++) { var bx = X + 40 + b * 25, c1 = bc[b], c2 = bc[(b + 4) % 10];
      R(bx, 362, 8, 22, c1); R(bx + 2, 356, 4, 6, c1); R(bx + 2, 370, 4, 6, "#ffffff"); R(bx + 1, 362, 1, 22, "rgba(255,255,255,0.35)");
      R(bx + 10, 396, 8, 22, c2); R(bx + 12, 390, 4, 6, c2); R(bx + 12, 404, 4, 6, "#ffffff"); R(bx + 11, 396, 1, 22, "rgba(255,255,255,0.35)"); }
    // palapa roof: ridge at y=252, eaves at y=312
    var apexY = 252, eaveY = 312, cx = X + 156;
    for (var y = apexY; y <= eaveY; y++) { var k = (y - apexY) / (eaveY - apexY), half = 90 + k * 100;
      R(cx - half, y, half * 2, 1, (y % 3 === 0) ? "#a67c3b" : (y % 3 === 1 ? "#c9a35a" : "#d9b86c")); }
    for (var st = 0; st < 140; st++) { var sx = cx - 186 + Math.floor(hash(st, 3) * 372), sy = apexY + 4 + Math.floor(hash(st, 4) * 54); R(sx, sy, 1, 4 + Math.floor(hash(st, 5) * 6), "#9a7230"); }  // straw strokes
    for (var e = 0; e < 380; e += 5) R(cx - 190 + e, eaveY + 1, 3, 3 + (e % 10 === 0 ? 2 : 0), "#8f6a2c");   // fringe
    R(cx - 95, apexY - 4, 190, 4, "#8f6a2c"); R(cx - 92, apexY - 7, 184, 3, "#a67c3b");                       // ridge cap
    // two tiki torches beside the ridge sign (the sign itself is a prop: DANICKYS board or the CAFÉ chalkboard)
    R(cx - 78, 262, 4, 26, "#5a3a1a"); R(cx - 80, 256, 8, 7, "#ff9d3b"); R(cx - 78, 253, 4, 4, "#ffd36b");
    R(cx + 74, 262, 4, 26, "#5a3a1a"); R(cx + 72, 256, 8, 7, "#ff9d3b"); R(cx + 74, 253, 4, 4, "#ffd36b");
  }

  /* ---------- tiki bar: front part (counter, props, stools, surfboard) ---------- */
  function drawBarFront() {
    var wood2 = "#6b3f1d";
    R(X + 6, 420, 300, 6, "#c08a4a"); R(X + 6, 420, 300, 2, "#e0a860"); R(X + 6, 426, 300, 57, "#8a5a2b");
    for (var s = X + 6; s < X + 306; s += 12) R(s, 426, 2, 57, wood2);
    for (var r = X + 8; r < X + 306; r += 6) R(r, 442, 3, 2, "#d9b86c");                                     // rope band
    R(X + 6, 481, 300, 2, "#4a2a10");
    // hurricane lamp (the counter props live in PROPS below: tiki set or coffee set by hour)
    R(X + 264, 394, 14, 26, "#d9d9ea"); R(X + 262, 418, 18, 3, "#2b1d14"); R(X + 262, 392, 18, 3, "#2b1d14"); R(X + 268, 391, 6, 2, "#2b1d14");  // lamp body (flame drawn at night)
    // stools
    for (var st = 0; st < 3; st++) { var sx = X + 36 + st * 100; R(sx, 474, 30, 8, "#c08a4a"); R(sx, 474, 30, 2, "#e0a860"); R(sx + 3, 482, 4, 37, wood2); R(sx + 23, 482, 4, 37, wood2); R(sx + 3, 500, 24, 2, wood2); }
    // surfboard leaning on the left post: pointed nose, center stripe, fin
    for (var i = 0; i < 150; i++) { var k = i / 150, w = Math.round(22 * Math.pow(Math.sin(k * Math.PI), 0.6)), bx = X - 40 + i * 0.12;
      R(bx - w / 2, 334 + i, w, 1, i % 2 === 0 ? "#ff7f50" : "#ff8d60"); if (w > 6) R(bx - 1, 334 + i, 3, 1, "#fff2cc"); }
    R(X - 34, 452, 6, 12, "#2b1d14"); R(X - 36, 460, 4, 8, "#2b1d14");                                           // fin
  }

  /* ---------- string lights (per frame so they swing with the wind; the bulbs stay bright at night) ---------- */
  var CX = X + 156, EAVE_Y = 312, BULB_COLORS = ["#ffd36b", "#ff8c69", "#9bff8a", "#5ef2ff", "#ff9ad5"];
  for (var bl = 0; bl < 22; bl++) { var blx = CX - 190 + bl * 18, bsag = Math.sin((bl / 21) * Math.PI * 3) * 3 + 3; bulbs.push({ lx: blx, ly: EAVE_Y + 8 + bsag, x: blx + 1, y: EAVE_Y + 10 + bsag, c: BULB_COLORS[bl % 5] }); }
  function stringLights(dx) {
    R(CX - 190, EAVE_Y + 6, 380, 1, "#2a2a2a");
    for (var l = 0; l < bulbs.length; l++) { var b = bulbs[l], sx = b.lx + dx * (0.6 + 0.4 * Math.sin(l * 1.7));   // each bulb swings a little differently
      R(sx, b.ly - 4, 1, 4, "#333"); R(sx - 1, b.ly, 3, 4, b.c); R(sx, b.ly, 1, 1, "#ffffff"); }
  }

  /* ---------- counter props + ridge sign: the tiki set (12:00 → 03:00) and the coffee set (morning).
     Between 11:30 and 12:00 they swap one by one, cocktail first and the sign last. The current
     combination is painted once into a cached layer. ---------- */
  function mug(x, y, c) { R(x, y, 10, 11, c); R(x + 10, y + 2, 3, 6, c); R(x + 11, y + 4, 1, 2, "#2b1d14"); R(x + 1, y, 8, 1, "#3b2314"); R(x + 1, y + 1, 1, 9, "rgba(255,255,255,0.4)"); }
  var PROPS = [
    { tiki: function () {                                   // cocktail with umbrella
        R(X + 40, 406, 10, 14, "#ff9d3b"); R(X + 42, 402, 6, 4, "#ffd36b"); R(X + 38, 419, 14, 1, "#fff"); R(X + 44, 396, 10, 6, "#ff5e7a"); R(X + 48, 390, 1, 10, "#5a3a1a"); },
      coffee: function () {                                 // espresso machine: chrome body, group head, portafilter, cup on the drip tray, pilot light, steam wand
        R(X + 30, 390, 46, 30, "#c8ccd8"); R(X + 30, 390, 46, 3, "#3b3b46"); R(X + 30, 388, 46, 2, "#e6e8f0"); R(X + 34, 395, 38, 8, "#3b3b46"); R(X + 36, 397, 14, 4, "#5ef2ff");
        R(X + 68, 397, 4, 4, "#ff5e5e"); R(X + 44, 403, 10, 4, "#2b2b33"); R(X + 42, 407, 14, 2, "#8a8a96"); R(X + 56, 406, 8, 2, "#2b2b33");
        R(X + 44, 412, 10, 7, "#f4f4f4"); R(X + 54, 414, 2, 3, "#f4f4f4"); R(X + 30, 418, 46, 2, "#8a8a96"); R(X + 76, 392, 3, 12, "#8a8a96"); R(X + 76, 404, 3, 10, "#555555"); } },
    { tiki: function () {                                   // coconut with straw
        R(X + 100, 404, 18, 16, "#6b4a22"); R(X + 104, 400, 10, 5, "#8a6a44"); R(X + 110, 390, 2, 12, "#ff5e5e"); R(X + 106, 406, 4, 3, "#ffffff"); },
      coffee: function () { mug(X + 88, 408, "#f4f4f4"); mug(X + 102, 408, "#e8453c"); mug(X + 116, 408, "#2bb3a9"); } },   // three mugs
    { tiki: function () {                                   // bowl of limes
        R(X + 150, 410, 22, 10, "#e8d7b0"); R(X + 152, 406, 6, 5, "#9bff8a"); R(X + 159, 405, 6, 5, "#8ae57a"); R(X + 166, 407, 5, 4, "#9bff8a"); },
      coffee: function () {                                 // coffee bag with a label
        R(X + 148, 396, 26, 24, "#6b4a22"); R(X + 150, 392, 22, 5, "#8a6a44"); R(X + 152, 390, 18, 2, "#5a3a1a"); R(X + 150, 403, 22, 10, "#f4e4b8"); text(X + 150, 405, "CAFÉ", 1, "#5a3a1a"); R(X + 158, 414, 6, 1, "#c0392b"); } },
    { tiki: function () {                                   // tiki mug
        R(X + 200, 402, 14, 18, "#c9a35a"); R(X + 203, 406, 8, 3, "#5a3416"); R(X + 203, 412, 8, 2, "#5a3416"); R(X + 205, 416, 4, 2, "#5a3416"); },
      coffee: function () {                                 // pastry basket: wicker, two conchas and a croissant
        R(X + 196, 410, 34, 10, "#c98b4a"); for (var i = 0; i < 8; i++) R(X + 198 + i * 4, 412 + (i % 2) * 2, 2, 2, "#a06a30"); R(X + 196, 410, 34, 1, "#e0a860");
        R(X + 198, 403, 10, 7, "#ff9ad5"); R(X + 200, 401, 6, 2, "#ff9ad5"); R(X + 201, 404, 2, 1, "#ffffff"); R(X + 205, 406, 2, 1, "#ffffff");
        R(X + 209, 403, 10, 7, "#ffd36b"); R(X + 211, 401, 6, 2, "#ffd36b"); R(X + 212, 404, 2, 1, "#f4e4b8"); R(X + 216, 406, 2, 1, "#f4e4b8");
        R(X + 220, 405, 9, 5, "#e0a860"); R(X + 219, 407, 2, 3, "#c98b4a"); R(X + 228, 407, 2, 3, "#c98b4a"); } },
    { tiki: function () {                                   // cocktail shaker and half a lime
        R(X + 236, 398, 10, 22, "#c8ccd8"); R(X + 238, 394, 6, 5, "#a9aeba"); R(X + 237, 398, 2, 22, "#eef0f5"); R(X + 236, 408, 10, 1, "#8a8a96"); R(X + 250, 414, 6, 6, "#9bff8a"); R(X + 252, 416, 2, 2, "#e8ffd8"); },
      coffee: function () {                                 // milk jug and a sugar jar
        R(X + 236, 404, 12, 16, "#f4f4f4"); R(X + 234, 402, 6, 3, "#f4f4f4"); R(X + 248, 408, 3, 6, "#f4f4f4"); R(X + 237, 404, 1, 16, "#dcdcdc");
        R(X + 254, 408, 10, 12, "#dff3ff"); R(X + 253, 406, 12, 3, "#8a8a96"); for (var j = 0; j < 6; j++) R(X + 255 + (j % 3) * 3, 411 + Math.floor(j / 3) * 4, 2, 2, "#ffffff"); } },
    { tiki: function () {                                   // "DANICKYS" board on the ridge
        R(CX - 66, 258, 132, 30, "#2b1d14"); R(CX - 63, 261, 126, 24, "#f4e4b8"); R(CX - 63, 261, 126, 2, "#fff6dc");
        var letters = "DANICKYS", cols = ["#c0392b", "#1f7a3a"]; for (var i = 0; i < letters.length; i++) text(CX - 48 + i * 12, 265, letters.charAt(i), 2, cols[i % 2]); },
      coffee: function () {                                 // chalkboard "CAFÉ" with a steaming cup in chalk
        R(CX - 66, 258, 132, 30, "#5a3a1a"); R(CX - 63, 261, 126, 24, "#1e2a24"); R(CX - 61, 263, 122, 1, "#5f6f66"); R(CX - 61, 283, 122, 1, "#5f6f66");
        text(CX - 34, 265, "CAFÉ", 2, "#f4f4f4"); R(CX + 22, 273, 10, 8, "#f4f4f4"); R(CX + 32, 275, 3, 4, "#f4f4f4"); R(CX + 24, 281, 6, 1, "#f4f4f4");
        R(CX + 24, 266, 1, 4, "#ffd36b"); R(CX + 27, 265, 1, 5, "#ffd36b"); R(CX + 30, 266, 1, 4, "#ffd36b"); R(CX - 58, 266, 8, 2, "#ff9ad5"); R(CX - 58, 278, 8, 2, "#9bff8a"); } }
  ];
  /* "t"/"c" per prop: tiki from its swap time (11:30 + i steps) until the bar closes at 03:00, coffee otherwise */
  function propState(hour) {
    var n = PROPS.length, s = "";
    for (var i = 0; i < n; i++) { var swapAt = 11.5 + (i + 1) * (0.5 / (n + 1)); s += (hour >= swapAt || hour < 3) ? "t" : "c"; }
    return s;
  }
  var propsKey = "", propsCanvas = null, PROPSBOX = [X - 70, 250, 400, 175];
  function propsLayer(hour) {
    var key = propState(hour);
    if (key !== propsKey) {
      propsKey = key; propsCanvas = propsCanvas || mk(); var G = g; g = propsCanvas.getContext("2d"); g.clearRect(0, 0, LW, LH);
      for (var i = 0; i < PROPS.length; i++) (key.charAt(i) === "t" ? PROPS[i].tiki : PROPS[i].coffee)();
      g = G;
    }
    return propsCanvas;
  }
  var STEAM = [[X + 49, 410, 1], [X + 93, 406, 2], [X + 107, 406, 2], [X + 121, 406, 2]];      // espresso cup and the three mugs (prop index that must be in coffee mode)
  function steam(t, key) {
    for (var i = 0; i < STEAM.length; i++) { if (key.charAt(STEAM[i][2]) !== "c") continue;
      for (var p = 0; p < 3; p++) { var ph = (t * 9 + p * 7 + i * 4) % 22, a = 0.5 * (1 - ph / 22); R(STEAM[i][0] + Math.sin(t * 2 + p * 2 + i) * 2, STEAM[i][1] - 6 - ph, 2, 2, "rgba(255,255,255," + a.toFixed(2) + ")"); } }
  }

  /* ---------- bartender, 1.5x scale, Hawaiian shirt. Tiki hours: wipe a glass / shake / pour; coffee hours: wipe a mug /
     grind / pour the kettle. Drawn after the lighting pass (clipped to above the counter) with its own palette: at night the
     face and shirt are warmed by the bulbs instead of being stained by the cast. ---------- */
  var shadeCache = {};
  function shade(hex, k, dark) {                           // mix toward warm bulb light (k) and darken (dark), cached per colour
    var key = hex + k + ":" + dark, c = shadeCache[key]; if (c) return c;
    var r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.round((r * (1 - k) + 255 * k) * (1 - dark)); gg = Math.round((gg * (1 - k) + 190 * k) * (1 - dark)); b = Math.round((b * (1 - k) + 110 * k) * (1 - dark));
    return (shadeCache[key] = "rgb(" + r + "," + gg + "," + b + ")");
  }
  function bartender(t, S, L, coffee) {
    var bx = X + 150, by = 438, Z = 1.5;              // feet below the counter top (hidden behind it); hat clears the string lights
    var lit = Math.max(0, L.lightsOn) * L.night, k = Math.round(0.35 * lit * 10) / 10, dark = Math.round(0.45 * L.night * (1 - 0.5 * lit) * 10) / 10;
    var C = function (h) { return (k || dark) ? shade(h, k, dark) : h; };
    var Q = function (x, y, w, h, c) { R(bx + x * Z, by + y * Z, w * Z, h * Z, C(c)); };   // scaled rect, origin at the feet
    var cycle = Math.floor(t / 9) % 3, ph = (t % 9) / 9;
    var bob = Math.round(Math.sin(t * 6) * (cycle === 1 ? 1.5 : 0.5));
    var skin = "#d9a06b", shirt = "#e8453c", hair = "#2b1d14";
    // torso: red Hawaiian shirt with white/yellow hibiscus, open collar
    Q(-15, -44 + bob, 30, 40, shirt); Q(-15, -44 + bob, 30, 2, "#c73a32"); Q(-2, -44 + bob, 4, 40, "#fff2cc"); Q(-6, -44 + bob, 4, 6, "#f6f6f6"); Q(2, -44 + bob, 4, 6, "#f6f6f6");
    var fl = [[-12, -38], [-7, -28], [-12, -16], [8, -36], [11, -24], [7, -12], [-9, -8]];
    for (var i = 0; i < fl.length; i++) { var fx = fl[i][0], fy = fl[i][1] + bob, c = i % 2 ? "#ffd36b" : "#ffffff";
      Q(fx, fy - 1, 1, 3, c); Q(fx - 1, fy, 3, 1, c); Q(fx, fy, 1, 1, "#ff9d3b"); Q(fx + 2, fy + 2, 1, 1, "#2f9e4f"); }
    // head, hair, face, straw hat with a red band
    Q(-8, -62 + bob, 16, 18, skin); Q(-9, -64 + bob, 18, 5, hair); Q(-8, -52 + bob, 2, 2, "#2b1d14"); Q(4, -52 + bob, 2, 2, "#2b1d14"); Q(-2, -47 + bob, 5, 1, "#a05a3a"); Q(-9, -50 + bob, 1, 6, hair); Q(8, -50 + bob, 1, 6, hair);
    Q(-15, -66 + bob, 30, 4, "#e6c87a"); Q(-9, -72 + bob, 18, 7, "#e6c87a"); Q(-9, -69 + bob, 18, 1, "#c0392b");
    // arms by activity
    if (cycle === 0) {                                  // wiping a glass (or a mug in the morning)
      Q(-22, -40 + bob, 7, 18, shirt); Q(-22, -24 + bob, 7, 5, skin);
      var wx = Math.round(Math.sin(ph * Math.PI * 8) * 3);
      Q(14, -40 + bob, 7, 10, shirt); Q(18 + wx, -32 + bob, 6, 6, skin); Q(16 + wx, -34 + bob, 10, 2, "#ffffff");
      if (coffee) { Q(-24, -34 + bob, 9, 9, "#f4f4f4"); Q(-15, -32 + bob, 2, 5, "#f4f4f4"); } else { Q(-24, -36 + bob, 10, 12, "#cfeeff"); Q(-22, -36 + bob, 2, 12, "#ffffff"); }
    } else if (cycle === 1 && !coffee) {                // shaking a cocktail shaker over the shoulder
      var sh = Math.round(Math.sin(t * 14) * 3);
      Q(14, -46 + bob, 7, 14, shirt); Q(18, -56 + sh + bob, 6, 10, skin);
      Q(16, -74 + sh + bob, 12, 20, "#c8ccd8"); Q(18, -78 + sh + bob, 8, 5, "#a9aeba"); Q(17, -74 + sh + bob, 2, 20, "#eef0f5");
      Q(-22, -40 + bob, 7, 18, shirt); Q(-22, -24 + bob, 7, 5, skin);
    } else if (cycle === 1) {                           // turning the crank of a hand grinder on the counter
      var a = t * 7, hx = -27 + Math.cos(a) * 4, hy = -22 + Math.sin(a) * 2;
      Q(14, -40 + bob, 7, 16, shirt); Q(14, -26 + bob, 7, 5, skin);
      Q(-30, -14, 12, 12, "#8a5a2b"); Q(-29, -13, 10, 2, "#a67c3b"); Q(-27, -18, 6, 4, "#3b3b46"); Q(-25, -24, 2, 6, "#8a8a96"); Q(-24 + Math.round((hx + 27) * 0.5), -24, 1, 1, "#8a8a96");
      Q(-22, -40 + bob, 7, 12, shirt); Q(-24, -30 + bob, 6, Math.max(4, Math.round(8 + hy + 22)), skin); Q(hx - 2, hy, 5, 4, skin); Q(hx - 1, hy - 1, 3, 1, "#5a3a1a");
    } else if (!coffee) {                               // pouring into a glass on the counter
      var pr = Math.round(ph * 4) % 2;
      Q(-22, -40 + bob, 7, 18, shirt); Q(-22, -24 + bob, 7, 5, skin);
      Q(14, -44 + bob, 8, 10, shirt); Q(20, -38 - pr + bob, 6, 6, skin); Q(22, -44 - pr + bob, 6, 12, "#5ef2ff"); Q(24, -32 + bob, 2, 10 + pr, "#ffd36b");
      Q(20, -12 + bob, 10, 12, "#cfeeff"); Q(22, -8 + bob, 6, 8, "#ffd36b");
    } else {                                            // pouring the kettle into a cup
      var tilt = Math.round(Math.sin(ph * Math.PI) * 2);
      Q(-22, -40 + bob, 7, 18, shirt); Q(-22, -24 + bob, 7, 5, skin);
      Q(14, -44 + bob, 8, 10, shirt); Q(20, -40 - tilt + bob, 6, 6, skin);
      Q(18, -50 - tilt + bob, 14, 10, "#c8ccd8"); Q(20, -53 - tilt + bob, 8, 3, "#8a8a96"); Q(32, -48 - tilt + bob, 4, 2, "#c8ccd8"); Q(35, -46 - tilt + bob, 2, 3, "#c8ccd8");
      if (tilt > 0) Q(36, -43 + bob, 1, 29, "#6b4a22");
      Q(32, -14 + bob, 10, 10, "#f4f4f4"); Q(42, -12 + bob, 3, 5, "#f4f4f4");
    }
  }

  /* ---------- middle ground: beach chairs, fire pit, crab path (static parts cached in the sand layer) ---------- */
  function drawMidground() {
    // two beach chairs (striped canvas on wooden frames), facing the sea
    function chair(x, y, c1, c2) {
      R(x, y - 26, 3, 30, "#8a5a2b"); R(x + 22, y - 10, 3, 14, "#8a5a2b"); R(x + 26, y - 12, 3, 16, "#8a5a2b");
      for (var i = 0; i < 24; i++) { var k = i / 24, yy = y - 24 + k * 14; R(x + 3 + i, yy, 1, 10, (Math.floor(i / 4) % 2) ? c1 : c2); }
      R(x + 3, y - 10, 24, 3, c1); R(x, y + 2, 30, 2, "#5a3a1a"); R(x + 4, y + 4, 2, 4, "#5a3a1a"); R(x + 24, y + 4, 2, 4, "#5a3a1a");
    }
    chair(436, 470, "#2bb3a9", "#f6f6f6"); chair(492, 486, "#e8453c", "#fff2cc");
    R(470, 494, 8, 5, "#ffd36b"); R(471, 490, 6, 4, "#ff9d3b"); R(473, 486, 2, 4, "#5a3a1a");          // drink in the sand
    // fire pit: ring of stones, logs (flames are drawn per frame after sunset)
    var fx = 300, fy = 505;
    for (var s = 0; s < 14; s++) { var a = s / 14 * Math.PI * 2; R(fx + Math.cos(a) * 20 - 2, fy + Math.sin(a) * 8 - 2, 5, 4, s % 2 ? "#8a8a8a" : "#a9a9a9"); }
    R(fx - 12, fy - 3, 24, 5, "#4e3014"); R(fx - 9, fy - 6, 18, 4, "#6b4a22"); R(fx - 3, fy - 8, 6, 3, "#3b2314");
    // crab path: paired dots crossing the sand (the crab walks it in step C)
    for (var i = 0; i < 26; i++) { var px = 120 + i * 13, py = 528 - i * 2.6 + Math.sin(i) * 2; R(px, py, 1, 1, "#d2b884"); R(px + 2, py + 2, 1, 1, "#d2b884"); }
  }
  var FIRE = { x: 300, y: 505 };
  function firePit(t, L) {                                     // lit after sunset: flickering flames
    for (var i = 0; i < 6; i++) { var h = 6 + Math.round(Math.abs(Math.sin(t * 9 + i * 1.3)) * 10), w = 4 + (i % 2), x = FIRE.x - 10 + i * 4 + Math.round(Math.sin(t * 7 + i) * 1.5);
      R(x, FIRE.y - 6 - h, w, h, i % 3 === 0 ? "#ffd36b" : "#ff9d3b"); R(x + 1, FIRE.y - 6 - Math.round(h * 0.5), w - 2, Math.round(h * 0.5), "#ffe8a8"); }
    R(FIRE.x - 2, FIRE.y - 9, 4, 3, "#fff6dc");
  }

  /* ---------- lighting pass (logical canvas) ---------- */
  var CAST = [X - 130, 380, 560, LH - 380];                   // where the bulb cast may land (sand around the bar, counter top)
  function radial(cx, cy, r, color, a) {
    var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, color.replace("A", a.toFixed(3))); gr.addColorStop(1, color.replace("A", "0"));
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  function lighting(S, L, closed, W, ldx) {
    var lightsOn = closed ? 0 : L.lightsOn;
    if (W && W.cloud > 0.3 && L.d > 0.05) {                    // overcast / rainy daylight: cooler, flatter light on the sprites
      g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(90,100,130," + (0.28 * W.cloud * L.d).toFixed(3) + ")";
      g.fillRect(0, SHORE_Y, LW, LH - SHORE_Y); g.fillRect(PALMS[0], PALMS[1], PALMS[2], SHORE_Y - PALMS[1]); g.fillRect(BAR[0], BAR[1], BAR[2], SHORE_Y - BAR[1]);
      g.globalCompositeOperation = "source-over";
    }
    // one combined tint fill: night blue-grey (a1) then twilight warmth (a2), merged into a single rgba.
    // Night sand ends up blue-grey (not white); only the bar's light cast warms it back up locally.
    var a1 = 0.74 * (1 - L.d), a2 = 0.16 * L.tw, A = 1 - (1 - a1) * (1 - a2);
    g.globalCompositeOperation = "source-atop";
    if (A > 0.003) {
      var k1 = a1 * (1 - a2) / A, k2 = a2 / A, rgb = Math.round(18 * k1 + 255 * k2) + "," + Math.round(28 * k1 + 130 * k2) + "," + Math.round(72 * k1 + 60 * k2);
      g.fillStyle = "rgba(" + rgb + "," + A.toFixed(3) + ")";
      g.fillRect(0, SHORE_Y, LW, LH - SHORE_Y); g.fillRect(PALMS[0], PALMS[1], PALMS[2], SHORE_Y - PALMS[1]);
      // the bar keeps its own night palette: the same blue tint a touch lighter, so roof, posts, bottles and sign read desaturated, not muddy
      g.fillStyle = "rgba(" + rgb + "," + (A * 0.8).toFixed(3) + ")"; g.fillRect(BAR[0], BAR[1], BAR[2], SHORE_Y - BAR[1]);
    }
    if (lightsOn > 0.01) {
      // the bulbs' warm cast lands only on the sand around the bar and the counter top (the bartender gets it through his own palette)
      g.save(); g.beginPath(); g.rect(CAST[0], SHORE_Y, CAST[2], LH - SHORE_Y); g.rect(X + 6, 418, 300, 9); g.clip();
      g.globalAlpha = lightsOn; blit(layers.cast, CAST); g.globalAlpha = 1; g.restore();
      radial(FIRE.x, FIRE.y - 4, 90, "rgba(255,150,60,A)", 0.45 * lightsOn);
    }
    if (L.night > 0.01) radial(X + 271, 408, 34, "rgba(255,200,120,A)", 0.35 * L.night);                   // hurricane lamp: a small pool of light
    if (closed) { g.fillStyle = "rgba(5,8,30,0.35)"; g.fillRect(X - 50, 240, 400, 300); }
    g.globalCompositeOperation = "source-over";
    if (lightsOn > 0.01) {                                      // the bulbs themselves and their bloom stay bright
      stringLights(ldx);
      g.globalAlpha = lightsOn; g.drawImage(layers.halos, BAR[0], BAR[1], BAR[2], BAR[3], BAR[0] + Math.round(ldx * 0.7), BAR[1], BAR[2], BAR[3]); g.globalAlpha = 1;
    }
    if (L.night > 0.01) { R(X + 269, 400, 4, 8, "#ffd36b"); R(X + 270, 398, 2, 4, "#fff2cc"); radial(X + 271, 404, 14, "rgba(255,210,130,A)", 0.6 * L.night); }
  }
  function hexToRgbaA(h) { return "rgba(" + parseInt(h.slice(1, 3), 16) + "," + parseInt(h.slice(3, 5), 16) + "," + parseInt(h.slice(5, 7), 16) + ",A)"; }
  function shadows(L) {                                         // golden-hour long shadows on the sand
    if (!L.isDay || L.elev > 0.45) return;
    var len = 40 + (1 - L.elev / 0.45) * 90, dir = L.sunX < 0.5 ? 1 : -1, a = 0.16 * (1 - L.elev / 0.45);
    g.fillStyle = "rgba(20,10,40," + a.toFixed(3) + ")";
    var bases = [[156, 456, 8], [348, 450, 8], [X + 18, 486, 7], [X + 150, 486, 7], [X + 294, 486, 7]];
    for (var i = 0; i < bases.length; i++) for (var s = 0; s < len; s += 2) g.fillRect(bases[i][0] + dir * s, bases[i][1] - s * 0.12, bases[i][2], 2);
  }

  /* ---------- animation frame caches ----------
     Palms and hammock sway on a quantized phase (PALM_FRAMES per cycle); each phase is drawn once into
     a small canvas and reused, so a frame costs a few drawImage calls instead of ~3000 fillRects. */
  var PALM_FRAMES = 16, HAM_FRAMES = 12, palmCache = {}, hamCache = {};
  function cached(store, key, w, h, painter) {
    var c = store[key];
    if (!c) { c = document.createElement("canvas"); c.width = w; c.height = h; var G = g; g = c.getContext("2d"); painter(); g = G; store[key] = c; }
    return c;
  }
  function palmAt(idx, bx, by, h, lean, amp, phase, seed) {
    var f = Math.floor(((phase % (2 * Math.PI)) / (2 * Math.PI)) * PALM_FRAMES), bucket = Math.round(amp);
    var key = idx + ":" + bucket + ":" + f, ox = bx - 120, oy = by - h - 80;
    var c = cached(palmCache, key, 260, h + 100, function () {
      var ph = (f + 0.5) / PALM_FRAMES * 2 * Math.PI;
      palm(bx - ox, by - oy, h, lean, Math.sin(ph) * amp, ph * 0.42, seed);     // flutter tied to the same phase
    });
    g.drawImage(c, ox, oy);
  }
  function hammockAt(x1, x2, y, amp, phase) {
    var f = Math.floor(((phase % (2 * Math.PI)) / (2 * Math.PI)) * HAM_FRAMES), key = Math.round(amp * 2) + ":" + f;
    var c = cached(hamCache, key, x2 - x1 + 24, 60, function () { hammock(12, x2 - x1 + 12, 12, Math.sin((f + 0.5) / HAM_FRAMES * 2 * Math.PI) * amp); });
    g.drawImage(c, x1 - 12, y - 12);
  }

  /* ---------- per frame (draws straight into the 960x540 #fg canvas; CSS scales it 2x, nearest neighbour) ----------
     Every cached layer is drawn cropped to its bounding box: on this GPU the cost is per pixel touched. */
  var BAR = [X - 60, 240, 420, 300], PALMS = [90, 100, 340, 370], SANDBAND = [0, 380, LW, LH - 380];   // bounding boxes [x, y, w, h]
  function blit(layer, b) { if (layer) g.drawImage(layer, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]); }
  var lastT = 0, palmPhase = 0, hamPhase = 0;
  function draw(t, S, L) {
    var dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t;
    var W = S.weather || { cloud: 0, rain: 0, fog: 0, storm: false }, D = global.Decor, A = global.Ambient, WX = global.Weather;
    g = fctx; g.clearRect(0, 0, LW, LH);
    if (A) { A.sky(t, L); A.horizon(t, L); }                      // pelican in the sky, ferry / sailboat on the horizon
    g.drawImage(layers.sand, 0, SHORE_Y, LW, LH - SHORE_Y, 0, SHORE_Y, LW, LH - SHORE_Y);
    shadows(L);
    if (D) blit(D.layer("sand", S.month, S.day), SANDBAND);
    // wind (Open-Meteo speed swelling toward the gusts): sway amplitude and speed for palms and hammock, swing for the string lights.
    // calm <8 km/h barely moves, gentle 8-20 sways, strong 20-35 whips, storm above bends everything. Phases integrate so speed changes don't jump.
    var ws = S.windEff != null ? S.windEff : (S.wind || 0), amp = 1 + ws * 0.22;
    palmPhase += dt * (0.7 + ws * 0.035); hamPhase += dt * (0.55 + ws * 0.02);
    if (Object.keys(palmCache).length > 100) palmCache = {};                     // wind changed a lot: drop stale frames
    if (Object.keys(hamCache).length > 60) hamCache = {};
    palmAt(0, 156, 456, 234, 30, amp, palmPhase, 0); palmAt(1, 348, 450, 258, -24, amp * 0.8, palmPhase + 1.3, 2);
    hammockAt(172, 341, 316, 0.6 + ws * 0.08, hamPhase);        // attached where the trunks pass y=316
    var fireLit = L.lightsOn > 0.05 && W.rain < 0.3;            // rain puts the fire out
    if (fireLit) firePit(t, L);
    if (A) A.sand(t, dt, S, L, fireLit);                          // crab, fireflies, grill, smoke, wind debris
    blit(layers.barBack, BAR);
    var ldx = Math.sin(t * 2.3) * ws * 0.07;                      // string-light swing in px (<1 px in a breeze, ~3 px in a storm)
    if (L.lightsOn <= 0.01) stringLights(ldx);                    // by day the bulbs are plain sprites; after dusk lighting() draws them lit
    if (D) blit(D.layer("back", S.month, S.day), BAR);
    var closed = S.hour >= 3 && S.hour < 6.5;                   // bar closed and dark, one lamp on
    blit(layers.barFront, BAR);
    var pk = propState(S.hour); blit(propsLayer(S.hour), PROPSBOX);
    if (!closed) steam(t, pk);                                    // steam over the espresso cup and the mugs in the morning
    if (D) { blit(D.layer("front", S.month, S.day), BAR); D.dynamic(new Date()); }
    if (A) A.front(t, dt, S, L);                                  // patrons, dog, kid, selfie
    lighting(S, L, closed, W, ldx);
    if (!closed) { g.save(); g.beginPath(); g.rect(X + 96, 300, 110, 120); g.clip(); bartender(t, S, L, S.hour < 12); g.restore(); }   // above the counter only
    if (D) D.lights(L, t);                                        // candle / Christmas-light glows stay bright at night
    if (WX) WX.draw(t, W, S, L);                                  // fog tint, rain, lightning
    if (post.on) g.drawImage(layers.post, 0, 0);                // vignette + scanlines, one cached layer
  }
  var post = { on: true, scan: true, vignette: true };
  function buildPost() {
    layers.post = mk(); var G = g; g = layers.post.getContext("2d");
    if (post.vignette) { var v = g.createRadialGradient(LW / 2, LH / 2, LH * 0.35, LW / 2, LH / 2, LW * 0.62); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.42)"); g.fillStyle = v; g.fillRect(0, 0, LW, LH); }
    if (post.scan) { g.fillStyle = "rgba(0,0,0,0.07)"; for (var y = 0; y < LH; y += 2) g.fillRect(0, y, LW, 1); }
    g = G;
  }

  global.Sprites = {
    start: function (canvas) {
      fg = canvas; fctx = fg.getContext("2d"); fg.width = W = LW; fg.height = H = LH;
      layers.sand = mk(); g = layers.sand.getContext("2d"); drawSand();
      layers.barBack = mk(); g = layers.barBack.getContext("2d"); drawBarBack();
      layers.barFront = mk(); g = layers.barFront.getContext("2d"); drawBarFront();
      layers.cast = mk(); g = layers.cast.getContext("2d");                         // warm light cast (applied source-atop)
      radial(X + 156, 430, 200, "rgba(255,200,130,A)", 0.34); radial(X + 156, 520, 260, "rgba(255,190,120,A)", 0.22);
      layers.halos = mk(); g = layers.halos.getContext("2d");                       // bulb bloom (applied source-over)
      for (var j = 0; j < bulbs.length; j++) radial(bulbs[j].x, bulbs[j].y, 8, hexToRgbaA(bulbs[j].c), 0.55);
      buildPost(); g = fctx;
    },
    setPost: function (o) { for (var k in o) post[k] = o[k]; buildPost(); },
    draw: draw, text: text,
    /* painter shared with decor.js / ambient.js / weather.js: they draw on whatever context is current */
    painter: { R: R, text: text, radial: radial, ctx: function () { return g; }, withContext: function (c, fn) { var G = g; g = c; fn(); g = G; } }
  };
})(window);
