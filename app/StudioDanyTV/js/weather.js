/* weather.js — turns an Open-Meteo weather code (+ wind) into scene parameters, and draws the
   foreground weather on the sprite canvas: rain streaks, drops bouncing off the palapa, puddles on
   the counter, fog tint, lightning flashes. The shader gets the same numbers (rain, fog, flash). */
(function (global) {
  "use strict";
  var R, P, flash = 0, nextBolt = 0, bolt = null, drops = [];

  /* weather code -> {cloud, rain (0..1), fog (0..1), storm} */
  function params(code) {
    var c = code | 0, p = { cloud: 0.05, rain: 0, fog: 0, storm: false };
    if (c === 1) p.cloud = 0.25; else if (c === 2) p.cloud = 0.5; else if (c === 3) p.cloud = 0.9;
    else if (c === 45 || c === 48) { p.cloud = 0.7; p.fog = c === 48 ? 1.0 : 0.75; }
    else if (c >= 51 && c <= 57) { p.cloud = 0.85; p.rain = 0.25; }
    else if (c === 61 || c === 66 || c === 80) { p.cloud = 0.9; p.rain = 0.45; }
    else if (c === 63 || c === 81) { p.cloud = 0.95; p.rain = 0.7; }
    else if (c === 65 || c === 67 || c === 82) { p.cloud = 1.0; p.rain = 1.0; }
    else if (c >= 71 && c <= 77 || c === 85 || c === 86) { p.cloud = 0.9; p.rain = 0.5; }
    else if (c >= 95) { p.cloud = 1.0; p.rain = 0.85; p.storm = true; }
    return p;
  }

  function update(t, dt, W) {                      // lightning scheduler: a flash every 6-18 s during storms
    if (W.storm) {
      if (t > nextBolt) { flash = 1; bolt = { x: 120 + Math.random() * 700, t: t, segs: [] }; var x = bolt.x, y = 20; while (y < 280) { var nx = x + (Math.random() - 0.5) * 40, ny = y + 15 + Math.random() * 25; bolt.segs.push([x, y, nx, ny]); x = nx; y = ny; } nextBolt = t + 6 + Math.random() * 12; }
      flash = Math.max(0, flash - dt * 2.5); if (bolt && t - bolt.t > 0.25) bolt = null;
    } else { flash = 0; bolt = null; }
    return flash;
  }

  function drawRain(t, W, S, L) {
    if (W.rain <= 0) return;
    var n = Math.round(60 + W.rain * 160), wind = (S.wind || 0) * 0.25, col = L.d > 0.3 ? "rgba(220,235,255,0.55)" : "rgba(170,190,230,0.45)";
    P.ctx().fillStyle = col;
    for (var i = 0; i < n; i++) {               // deterministic streaks scrolling down, wind-sheared
      var sx = (i * 173) % 960, speed = 420 + (i % 5) * 60, y = ((t * speed) + i * 61) % 600 - 30, x = (sx + wind * (y / 50) + t * wind * 6) % 980 - 10;
      P.ctx().fillRect(Math.round(x), Math.round(y), 1, 8 + (i % 3) * 3);
    }
    // drops hitting the palapa eave and the sand: small bounces
    for (var k = drops.length - 1; k >= 0; k--) { var d = drops[k]; d.life += 1; if (d.life > 6) { drops.splice(k, 1); continue; } R(d.x, d.y - d.life, 1, 1, "#dff3ff"); R(d.x + d.life, d.y - 2, 1, 1, "#dff3ff"); }
    if (Math.random() < W.rain * 0.6) drops.push({ x: 560 + Math.random() * 380, y: 318, life: 0 });
    if (Math.random() < W.rain * 0.5) drops.push({ x: Math.random() * 960, y: 400 + Math.random() * 130, life: 0 });
    // puddles on the counter (shimmer)
    var shimmer = 0.25 + 0.15 * Math.sin(t * 3);
    P.ctx().fillStyle = "rgba(200,230,255," + (shimmer * W.rain).toFixed(2) + ")"; P.ctx().fillRect(620, 421, 40, 2); P.ctx().fillRect(760, 421, 60, 2); P.ctx().fillRect(850, 422, 28, 1);
  }
  function drawFog(W) {
    if (W.fog <= 0) return;
    P.ctx().globalCompositeOperation = "source-atop"; P.ctx().fillStyle = "rgba(200,208,220," + (0.45 * W.fog).toFixed(2) + ")"; P.ctx().fillRect(0, 0, 960, 540); P.ctx().globalCompositeOperation = "source-over";
    P.ctx().fillStyle = "rgba(210,216,228," + (0.35 * W.fog).toFixed(2) + ")"; P.ctx().fillRect(0, 250, 960, 160);     // a band of haze over the water
  }
  function drawFlash(W) {
    if (bolt) { P.ctx().fillStyle = "#f4f8ff"; for (var i = 0; i < bolt.segs.length; i++) { var s = bolt.segs[i], steps = 8; for (var j = 0; j < steps; j++) { var k = j / steps; P.ctx().fillRect(Math.round(s[0] + (s[2] - s[0]) * k), Math.round(s[1] + (s[3] - s[1]) * k), 2, 3); } } }
    if (flash > 0.02) { P.ctx().fillStyle = "rgba(255,255,255," + (flash * 0.35).toFixed(2) + ")"; P.ctx().fillRect(0, 0, 960, 540); }
  }

  /* wind model (km/h): 0 calm < 8 <= 1 gentle < 20 <= 2 strong < 35 <= 3 storm. `s` is a 0..1.2 strength for animations. */
  function wind(v) { v = Math.max(0, v || 0); var lvl = v < 8 ? 0 : v < 20 ? 1 : v < 35 ? 2 : 3; return { level: lvl, name: ["calma", "brisa", "viento fuerte", "temporal"][lvl], s: Math.min(1.2, v / 45) }; }
  /* gust envelope 0..1: slow irregular swells so gusts come and go every 20-40 s */
  function gustEnv(t) { return Math.max(0, Math.min(1, Math.sin(t * 0.23) * 0.6 + Math.sin(t * 0.61 + 2) * 0.4 + Math.sin(t * 0.07) * 0.3)); }

  global.Weather = {
    init: function (painter) { P = painter; R = P.R; },
    params: params, update: update, wind: wind, gustEnv: gustEnv,
    flash: function () { return flash; },
    draw: function (t, W, S, L) { drawFog(W); drawRain(t, W, S, L); drawFlash(W); }
  };
})(window);
