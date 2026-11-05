/* scene.js — orchestrates the WebGL background (sky + sea) and, from step B on, the sprite layers.
   Step A: feasibility + benchmark. `Scene.bench()` cycles resolution x quality and records fps. */
(function (global) {
  "use strict";
  var cv, G, prog, W = 1920, H = 1080, quality = 1, started = false, last = 0, t0 = 0;
  var fps = { frames: 0, acc: 0, value: 0, worst: 0, maxFrame: 0 };
  var info = { gl: "none", renderer: "", bench: "" };

  function moonPhase(date) {   // 0 new, 0.5 full (synodic month from a known new moon, 2000-01-06 18:14 UTC)
    var ref = Date.UTC(2000, 0, 6, 18, 14), days = (date.getTime() - ref) / 86400000;
    return ((days / 29.530588853) % 1 + 1) % 1;
  }

  function state() {
    var E = global.ENV || {}, D = (global.DEV && global.DEV.on) ? global.DEV : {}, d = new Date();
    var code = D.code != null ? D.code : (E.code != null ? E.code : 0);
    var cloud = code === 0 ? 0.05 : code === 1 ? 0.25 : code === 2 ? 0.5 : code === 3 ? 0.9 : (code >= 45 && code < 50) ? 0.7 : 0.95;
    return {
      hour: D.hour != null ? D.hour : d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600,
      sunrise: E.sunrise || 6.5, sunset: E.sunset || 18.1, cloud: cloud,
      wind: D.wind != null ? D.wind : (E.wind != null ? E.wind : 10),
      moon: moonPhase(d)
    };
  }

  function resize(w, h) {
    W = w; H = h; cv.width = w; cv.height = h; G.gl.viewport(0, 0, w, h);
  }

  function draw(now) {
    if (!last) { last = now; t0 = now; }
    var dt = now - last; last = now; var t = (now - t0) / 1000;
    fps.frames++; fps.acc += dt; if (dt > fps.maxFrame) fps.maxFrame = dt;
    if (fps.acc >= 1000) { fps.value = Math.round(fps.frames * 1000 / fps.acc); fps.worst = Math.round(fps.maxFrame); fps.frames = 0; fps.acc = 0; fps.maxFrame = 0; }
    var S = state();
    prog.use();
    prog.set2f("u_res", W, H); prog.set1f("u_time", t);
    prog.set1f("u_hour", S.hour); prog.set1f("u_sunrise", S.sunrise); prog.set1f("u_sunset", S.sunset);
    prog.set1f("u_cloud", S.cloud); prog.set1f("u_wind", S.wind); prog.set1f("u_moon", S.moon); prog.set1f("u_quality", quality);
    prog.draw();
    global.requestAnimationFrame(draw);
  }

  global.Scene = {
    start: function (canvas) {
      cv = canvas; G = global.GLH.create(cv);
      if (!G) { info.gl = "none"; return false; }
      info.gl = "WebGL" + G.version; info.renderer = (G.vendor + " " + G.renderer).slice(0, 48);
      try { prog = global.GLH.fullscreenProgram(G.gl, global.SHADERS.SKYSEA); } catch (e) { info.gl += " shader error: " + e.message.slice(0, 80); return false; }
      resize(1920, 1080);
      if (!started) { started = true; global.requestAnimationFrame(draw); }
      return true;
    },
    setRes: function (w, h) { resize(w, h); },
    setQuality: function (q) { quality = q; },
    /* benchmark: internal render size x quality tier (0: 2 oct, 1: 3 oct, 2: 5 oct), 6 s each, median fps.
       The canvas is CSS-stretched to the screen, so a smaller internal size = GPU upscaling. Ends on 1080p/q1. */
    bench: function (done) {
      var cfgs = [["1080q2", 1920, 1080, 2], ["1080q1", 1920, 1080, 1], ["900q1", 1600, 900, 1], ["720q2", 1280, 720, 2], ["720q1", 1280, 720, 1], ["540q2", 960, 540, 2], ["540q1", 960, 540, 1], ["540q0", 960, 540, 0]], i = 0, out = [];
      function step() {
        if (i > 0) { var s = out[out.length - 1].s.sort(function (a, b) { return a - b; }); out[out.length - 1].v = s[Math.floor(s.length / 2)]; }
        info.bench = out.map(function (o) { return o.n + ":" + (o.v == null ? "…" : o.v); }).join("  ");
        if (i >= cfgs.length) { resize(1920, 1080); quality = 1; info.bench += "  | fin"; if (done) done(out); return; }
        var c = cfgs[i++]; resize(c[1], c[2]); quality = c[3]; out.push({ n: c[0], s: [] });
        var n = 0, iv = setInterval(function () { if (n >= 1) out[out.length - 1].s.push(fps.value); if (++n >= 6) { clearInterval(iv); step(); } }, 1000);
      }
      step();
    },
    fps: fps, info: info,
    size: function () { return { w: W, h: H, q: quality }; }
  };
})(window);
