/* ambient.js — the living parts of the scene: pelican, crab, ferry and sailboat on the horizon,
   patrons at golden hour, fire-pit and grill smoke, fireflies, splashes in the rain.
   Everything here is cheap per frame (a few dozen rects) and scheduled with simple timers. */
(function (global) {
  "use strict";
  var R, P, HOR_Y = 292, SHORE_Y = 394;
  var pelican = { t: -1 }, crab = { t: -1 }, ferry = { t: -1 }, boat = { t: -1 }, next = { pelican: 20, crab: 35, ferry: 60, boat: 140 };
  var smoke = [], flies = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- schedule ---------- */
  function schedule(t) {
    if (pelican.t < 0 && t > next.pelican) { pelican = { t: t, y: rnd(60, 160), dir: Math.random() < 0.5 ? 1 : -1, v: rnd(26, 40) }; next.pelican = t + rnd(90, 240); }
    if (crab.t < 0 && t > next.crab) { crab = { t: t, dir: Math.random() < 0.5 ? 1 : -1, v: rnd(10, 16) }; next.crab = t + rnd(120, 300); }
    if (ferry.t < 0 && t > next.ferry) { ferry = { t: t, dir: 1, v: 9 }; next.ferry = t + rnd(400, 900); }
    if (boat.t < 0 && t > next.boat) { boat = { t: t, dir: -1, v: 7 }; next.boat = t + rnd(300, 700); }
  }

  /* ---------- sprites ---------- */
  function drawPelican(t, L) {
    var e = t - pelican.t, x = pelican.dir > 0 ? -30 + e * pelican.v : 990 - e * pelican.v; if (x < -40 || x > 1000) { pelican.t = -1; return; }
    var y = pelican.y + Math.sin(e * 1.2) * 4, flap = Math.sin(e * 7) > 0, d = pelican.dir, body = L.d > 0.3 ? "#f0eee6" : "#8a8ea0", dark = "#5a5a66";
    R(x - 8, y, 16, 3, body); R(x + d * 8, y - 1, 6 * d, 2, body); R(x + d * 13, y, 7 * d, 2, "#ff9d3b");       // body, neck, pouch/bill
    if (flap) { R(x - 10, y - 6, 8, 2, dark); R(x - 12, y - 8, 4, 2, dark); R(x + 2, y - 6, 8, 2, dark); R(x + 8, y - 8, 4, 2, dark); }
    else { R(x - 12, y + 3, 10, 2, dark); R(x + 2, y + 3, 10, 2, dark); }
  }
  function drawCrab(t) {
    var e = t - crab.t, len = 340, s = e * crab.v; if (s > len) { crab.t = -1; return; }
    var k = crab.dir > 0 ? s / len : 1 - s / len, x = 120 + k * 338, y = 528 - k * 68 + Math.sin(k * 26) * 2, legs = Math.floor(e * 8) % 2;
    R(x - 6, y - 4, 12, 5, "#e8532f"); R(x - 4, y - 6, 8, 2, "#f06a45"); R(x - 5, y - 8, 2, 2, "#2b1d14"); R(x + 3, y - 8, 2, 2, "#2b1d14");
    R(x - 11, y - 6 + legs, 4, 3, "#e8532f"); R(x + 7, y - 6 + legs, 4, 3, "#e8532f");                           // claws
    for (var i = 0; i < 3; i++) { R(x - 9 - i, y + 1 + (i + legs) % 2, 3, 1, "#c9411f"); R(x + 7 + i, y + 1 + (i + legs + 1) % 2, 3, 1, "#c9411f"); }
  }
  function drawFerry(t, L) {
    var e = t - ferry.t, x = -70 + e * ferry.v; if (x > 1000) { ferry.t = -1; return; }
    var y = HOR_Y - 2, hull = L.d > 0.3 ? "#f4f4f4" : "#9aa0b8", bob = Math.round(Math.sin(e * 0.8));
    R(x, y + bob, 60, 5, hull); R(x + 6, y - 5 + bob, 48, 5, hull); R(x + 14, y - 9 + bob, 30, 4, hull); R(x + 24, y - 13 + bob, 6, 4, "#2bb3a9");
    for (var i = 0; i < 8; i++) R(x + 9 + i * 6, y - 3 + bob, 2, 2, L.night > 0.3 ? "#ffd36b" : "#5aa0c8");
    R(x, y + 5 + bob, 60, 1, "#1b6f8a"); R(x - 6, y + 2 + bob, 6, 1, "#eafcff"); R(x + 60, y + 3 + bob, 8, 1, "#eafcff");    // wake
    R(x + 40, y - 17 + bob, 1, 5, "#333"); R(x + 41, y - 17 + bob, 4, 3, "#e8453c");
  }
  function drawBoat(t, L) {
    var e = t - boat.t, x = 1000 - e * boat.v; if (x < -40) { boat.t = -1; return; }
    var y = HOR_Y - 1, bob = Math.round(Math.sin(e * 1.1)), sail = L.d > 0.3 ? "#ffffff" : "#aab0c4";
    R(x, y + bob, 22, 3, "#8a5a2b"); R(x + 10, y - 16 + bob, 1, 16, "#5a3a1a");
    for (var i = 0; i < 14; i++) R(x + 11, y - 16 + i + bob, Math.round(i * 0.7) + 1, 1, sail);
    for (var j = 0; j < 10; j++) R(x + 10 - Math.round(j * 0.5), y - 12 + j + bob, Math.round(j * 0.5) + 1, 1, sail);
  }
  function drawPatrons(t, S) {                      // two regulars on the stools at golden hour (16-21)
    if (!(S.hour >= 16 && S.hour < 21)) return;
    var X = 588, nod = Math.round(Math.sin(t * 1.5)), skin = "#d9a06b";
    function sit(x, shirt, hair, sip) { R(x + 4, 446 + nod, 10, 10, skin); R(x + 3, 444 + nod, 12, 3, hair); R(x + 2, 456 + nod, 14, 18, shirt); R(x - 1, 458 + nod, 3, 12, skin); R(x + 16, 458 + nod, 3, 10, skin); R(x + 2, 474, 5, 8, "#3b5a8a"); R(x + 11, 474, 5, 8, "#3b5a8a"); if (sip) { R(x + 17, 450 + nod, 4, 8, "#5ef2ff"); } }
    sit(X + 46, "#ffd36b", "#2b1d14", Math.sin(t * 0.4) > 0.6); sit(X + 246, "#5ea8ff", "#8a5a2b", Math.sin(t * 0.3 + 2) > 0.5);
  }

  /* ---------- particles ---------- */
  function updSmoke(t, dt, L, S, lit, grillOn) {
    if (lit && Math.random() < 0.35) smoke.push({ x: 300 + rnd(-6, 6), y: 492, vx: rnd(-3, 3) + S.wind * 0.3, vy: -rnd(10, 16), a: 0.35, life: 0 });
    if (grillOn && Math.random() < 0.25) smoke.push({ x: 936 + rnd(-4, 4), y: 492, vx: rnd(-2, 2) + S.wind * 0.3, vy: -rnd(9, 14), a: 0.3, life: 0 });
    for (var i = smoke.length - 1; i >= 0; i--) { var p = smoke[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt; p.a -= dt * 0.07; if (p.a <= 0) { smoke.splice(i, 1); continue; }
      var s = 2 + Math.floor(p.life * 2); P.ctx().fillStyle = "rgba(200,200,210," + p.a.toFixed(2) + ")"; P.ctx().fillRect(Math.round(p.x), Math.round(p.y), s, s); }
  }
  function updFlies(t, dt, L) {
    if (L.night < 0.4) { flies.length = 0; return; }
    while (flies.length < 14) flies.push({ x: rnd(40, 560), y: rnd(300, 500), ph: rnd(0, 6.28), s: rnd(0.3, 0.8) });
    for (var i = 0; i < flies.length; i++) { var f = flies[i]; f.x += Math.sin(t * f.s + f.ph) * 0.4; f.y += Math.cos(t * f.s * 1.3 + f.ph) * 0.3;
      var a = Math.max(0, Math.sin(t * 2.2 + f.ph)); if (a > 0.5) { R(f.x, f.y, 2, 2, "rgba(190,255,120," + (a * L.night).toFixed(2) + ")"); } }
  }
  function drawGrill(S) {                           // charcoal grill on the sand beside the bar, lit 18-22 (dinner hours)
    var x = 935, y = 500, on = S.hour >= 18 && S.hour < 22;
    R(x - 11, y - 6, 24, 9, "#333"); R(x - 9, y - 8, 20, 2, "#555"); R(x - 8, y + 3, 2, 14, "#333"); R(x + 8, y + 3, 2, 14, "#333"); R(x - 6, y + 10, 14, 1, "#333");
    for (var i = 0; i < 5; i++) R(x - 9 + i * 5, y - 7, 3, 1, "#777");
    if (on) { R(x - 6, y - 10, 4, 3, "#ff9d3b"); R(x + 2, y - 11, 4, 4, "#ffd36b"); R(x - 2, y - 9, 3, 2, "#ff5e5e"); R(x - 8, y - 5, 18, 2, "#c43d1f"); }
    return on;
  }

  global.Ambient = {
    init: function (painter) { P = painter; R = P.R; },
    /* called every frame from sprites.js at the right z positions */
    sky: function (t, L) { if (pelican.t >= 0) drawPelican(t, L); },
    horizon: function (t, L) { schedule(t); if (ferry.t >= 0) drawFerry(t, L); if (boat.t >= 0) drawBoat(t, L); },
    sand: function (t, dt, S, L, fireLit) { if (crab.t >= 0) drawCrab(t); updFlies(t, dt, L); var grillOn = drawGrill(S); updSmoke(t, dt, L, S, fireLit, grillOn); },
    front: function (t, S) { drawPatrons(t, S); }
  };
})(window);
