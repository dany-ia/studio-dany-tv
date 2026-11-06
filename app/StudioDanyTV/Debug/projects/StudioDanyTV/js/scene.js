/* scene.js — the frame loop. Owns the WebGL background (sky pass to texture every N frames,
   main pass every frame) and calls the sprite layer each frame. Exposes the light state so the
   2D layer can shade sprites consistently with the shader. */
(function (global) {
  "use strict";
  var cv, G, gl, skyProg, mainProg, skyRT = null;
  // defaults measured on the UN98DU9000 (2026-11-05): 1280x720, quality 2, sky pass every 4th frame = 60 fps with the sprite layer
  var W = 1280, H = 720, quality = 2, skyEvery = 4, frame = 0, started = false, last = 0, t0 = 0;
  var fps = { frames: 0, acc: 0, value: 0, worst: 0, maxFrame: 0 };
  var info = { gl: "none", renderer: "", bench: "" };
  var PI = Math.PI;

  function moonPhase(date) {   // 0 new, 0.5 full (synodic month from the new moon of 2000-01-06 18:14 UTC)
    var ref = Date.UTC(2000, 0, 6, 18, 14), days = (date.getTime() - ref) / 86400000;
    return ((days / 29.530588853) % 1 + 1) % 1;
  }

  /* scene state: real clock + Open-Meteo (window.ENV), overridden by the dev overlay (window.DEV) */
  function state() {
    var E = global.ENV || {}, D = global.DEV || {}, d = new Date();     // overrides apply even with the overlay hidden (app.js clears them)
    var code = D.code != null ? D.code : (E.code != null ? E.code : 0);
    var wx = global.Weather ? global.Weather.params(code) : { cloud: 0.05, rain: 0, fog: 0, storm: false };
    return {
      hour: D.hour != null ? D.hour : d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600,
      sunrise: E.sunrise || 6.5, sunset: E.sunset || 18.1, cloud: wx.cloud, code: code, weather: wx,
      wind: D.wind != null ? D.wind : (E.wind != null ? E.wind : 10),
      month: D.month != null ? D.month : d.getMonth() + 1, day: D.day != null ? D.day : d.getDate(),
      moon: moonPhase(d)
    };
  }

  /* same light model as the shader prelude, for the sprite layer */
  function light(S) {
    var dayLen = S.sunset - S.sunrise, df = (S.hour - S.sunrise) / dayLen, nightLen = 24 - dayLen;
    var nf = S.hour < S.sunrise ? (S.hour + 24 - S.sunset) / nightLen : (S.hour - S.sunset) / nightLen;
    var isDay = df >= 0 && df <= 1, elev = isDay ? Math.sin(PI * df) : -Math.sin(PI * Math.max(0, Math.min(1, nf)));
    var ss = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    var cdf = Math.max(0, Math.min(1, df));
    return { elev: elev, d: ss(-0.10, 0.28, elev), tw: Math.exp(-Math.pow(elev / 0.16, 2)), isDay: isDay,
             sunX: 0.12 + 0.50 * cdf, sunY: 0.46 + 0.52 * Math.sin(PI * cdf), night: ss(0.03, -0.10, elev), lightsOn: ss(0.08, -0.02, elev) };
  }

  var flash = 0;
  function setUniforms(p, S, t) {
    p.set2f("u_res", W, H); p.set1f("u_time", t);
    p.set1f("u_hour", S.hour); p.set1f("u_sunrise", S.sunrise); p.set1f("u_sunset", S.sunset);
    p.set1f("u_cloud", S.cloud); p.set1f("u_wind", S.wind); p.set1f("u_moon", S.moon); p.set1f("u_quality", quality);
    p.set1f("u_rain", S.weather.rain); p.set1f("u_fog", S.weather.fog); p.set1f("u_flash", flash);
  }

  function resize(w, h) {
    W = w; H = h; cv.width = w; cv.height = h;
    if (skyRT) skyRT.dispose(); skyRT = global.GLH.renderTarget(gl, w, h); frame = 0;
  }

  function draw(now) {
    if (!last) { last = now; t0 = now; }
    var dt = now - last; last = now; var t = (now - t0) / 1000;
    fps.frames++; fps.acc += dt; if (dt > fps.maxFrame) fps.maxFrame = dt;
    if (fps.acc >= 1000) { fps.value = Math.round(fps.frames * 1000 / fps.acc); fps.worst = Math.round(fps.maxFrame); fps.frames = 0; fps.acc = 0; fps.maxFrame = 0; }
    var S = state(), L = light(S);
    if (global.Weather) { var f = global.Weather.update(t, dt / 1000, S.weather); if (f > 0.02 || flash > 0.02) global.Scene.skyDirty = true; flash = f; }

    if (frame % skyEvery === 0 || global.Scene.skyDirty) {       // sky pass to texture every N frames
      gl.bindFramebuffer(gl.FRAMEBUFFER, skyRT.fb); gl.viewport(0, 0, W, H);
      skyProg.use(); setUniforms(skyProg, S, t); skyProg.draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); global.Scene.skyDirty = false;
    }
    gl.viewport(0, 0, W, H);
    mainProg.use(); setUniforms(mainProg, S, t);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, skyRT.tex); mainProg.set1i("u_sky", 0);
    mainProg.draw();
    frame++;

    if (global.Sprites) global.Sprites.draw(t, S, L);
    global.requestAnimationFrame(draw);
  }

  global.Scene = {
    start: function (canvas) {
      cv = canvas; G = global.GLH.create(cv);
      if (!G) { info.gl = "none"; return false; }
      gl = G.gl; info.gl = "WebGL" + G.version; info.renderer = (G.vendor + " " + G.renderer).slice(0, 48);
      try { skyProg = global.GLH.fullscreenProgram(gl, global.SHADERS.SKY); mainProg = global.GLH.fullscreenProgram(gl, global.SHADERS.MAIN); }
      catch (e) { info.gl += " shader error: " + e.message.slice(0, 90); return false; }
      resize(W, H);
      if (!started) { started = true; global.requestAnimationFrame(draw); }
      return true;
    },
    setRes: function (w, h) { resize(w, h); },
    setQuality: function (q) { quality = q; frame = 0; },
    setSkyEvery: function (n) { skyEvery = n; frame = 0; },
    state: state, light: light,
    /* benchmark: each config 5 s, median fps; ends on 720p / q1 / sky every 4 */
    bench: function (done) {
      var cfgs = [["720q1s4", 1280, 720, 1, 4], ["720q2s4", 1280, 720, 2, 4], ["720q2s1", 1280, 720, 2, 1], ["1080q1s4", 1920, 1080, 1, 4], ["1080q2s4", 1920, 1080, 2, 4], ["540q2s4", 960, 540, 2, 4]], i = 0, out = [];
      function step() {
        if (i > 0) { var s = out[out.length - 1].s.sort(function (a, b) { return a - b; }); out[out.length - 1].v = s[Math.floor(s.length / 2)]; }
        info.bench = out.map(function (o) { return o.n + ":" + (o.v == null ? "…" : o.v); }).join("  ");
        if (i >= cfgs.length) { resize(1280, 720); quality = 2; skyEvery = 4; info.bench += "  | fin"; if (done) done(out); return; }
        var c = cfgs[i++]; resize(c[1], c[2]); quality = c[3]; skyEvery = c[4]; out.push({ n: c[0], s: [] });
        var n = 0, iv = setInterval(function () { if (n >= 1) out[out.length - 1].s.push(fps.value); if (++n >= 6) { clearInterval(iv); step(); } }, 1000);
      }
      step();
    },
    fps: fps, info: info,
    size: function () { return { w: W, h: H, q: quality, s: skyEvery }; }
  };
})(window);
