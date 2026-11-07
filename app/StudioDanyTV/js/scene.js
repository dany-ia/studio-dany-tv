/* scene.js — the frame loop. Builds the scene state (real clock or forced date/hour, Open-Meteo
   weather, real astronomy from astro.js), owns the WebGL background (sky pass to texture every
   N frames, main pass every frame) and calls the sprite layer each frame. */
(function (global) {
  "use strict";
  var cv, G, gl, skyProg, mainProg;
  /* three sky textures: cur (newest complete), prev (the one before, for the crossfade) and work (being filled).
     The sky pass is spread over skyEvery frames, one horizontal slice per frame (scissor), so no single frame
     carries the whole 5-octave sky; when the last slice lands, work becomes cur and the crossfade restarts. */
  var skyRT = [null, null, null], skyCur = 0, skyPrev = 1, skyWork = 2, slice = 0, sinceRot = 0, skyFade = 0;
  var uptime = 0;                     // seconds added to the clock (URL ?uptime=604800 simulates a week of running, for precision checks)
  var cloudDrift = 0, seaDrift = 0;   // wind-driven noise drifts, integrated per frame in double precision, wrapped at the 1024-cell noise period
  // defaults measured on the UN98DU9000 (2026-11-05): 1280x720, quality 2, sky pass every 4th frame = 60 fps with the sprite layer
  var W = 1280, H = 720, quality = 2, skyEvery = 4, frame = 0, started = false, last = 0, t0 = 0;
  var fps = { frames: 0, acc: 0, value: 0, worst: 0, maxFrame: 0 };
  var info = { gl: "none", renderer: "", bench: "" };

  /* the scene's Date: real clock, with dev overrides for year / month / day / hour */
  function sceneDate() {
    var D = global.DEV || {}, now = new Date();
    if (D.hour == null && D.month == null && D.day == null && D.year == null) return now;
    var h = D.hour != null ? D.hour : now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.floor(((h - hh) * 60 - mm) * 60);
    return new Date(D.year || now.getFullYear(), (D.month || now.getMonth() + 1) - 1, D.day || now.getDate(), hh, mm, ss);
  }

  /* scene state: clock + Open-Meteo (window.ENV) + astronomy, overridden by the dev overlay (window.DEV) */
  function state() {
    var E = global.ENV || {}, D = global.DEV || {}, date = sceneDate(), A = global.Astro.at(date);
    var code = D.code != null ? D.code : (E.code != null ? E.code : 0);
    var wx = global.Weather ? global.Weather.params(code) : { cloud: 0.05, rain: 0, fog: 0, storm: false };
    // wind: Open-Meteo 10 m speed and gusts (the dev overlay forces a speed; gusts follow at x1.4);
    // windEff swells from the base speed toward the gust speed on a slow envelope and drives palms, sea, hammock, lights, debris
    var wind = D.wind != null ? D.wind : (E.wind != null ? E.wind : 10);
    var gust = D.wind != null ? D.wind * 1.4 : Math.max(wind, E.gust != null ? E.gust : wind);
    var windEff = wind + (gust - wind) * (global.Weather ? global.Weather.gustEnv(Date.now() / 1000) : 0);
    return {
      date: date, hour: date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600,
      astro: A, sunrise: A.sunriseH, sunset: A.sunsetH,
      cloud: wx.cloud, code: code, weather: wx,
      wind: wind, gust: gust, windEff: windEff, windLevel: global.Weather ? global.Weather.wind(windEff).level : 1,
      month: date.getMonth() + 1, day: date.getDate(), year: date.getFullYear()
    };
  }

  /* light model for the sprite layer (same numbers the shaders get) */
  function light(S) {
    var A = S.astro;
    return { elev: A.elev, d: A.d, tw: A.tw, isDay: A.isDay, sunX: A.sun.x, sunY: A.sun.y, night: A.night * (1 - 0.6 * A.moonBright), lightsOn: A.lightsOn, moonBright: A.moonBright };
  }

  var flash = 0;
  function setUniforms(p, S, t) {
    var A = S.astro;
    p.set2f("u_res", W, H);
    // time for the shaders in small pieces (see shaders.js): every drift phase k*t reduced modulo the 1024-cell noise period, in double precision
    var P = function (k) { return (k * t) % 1024; };
    p.set4f("u_T0", P(0.10), P(0.08), P(0.35), P(0.3)); p.set4f("u_T1", P(2.2), P(0.2), P(1.1), P(0.7)); p.set2f("u_T2", P(2.0), P(5.0));
    p.set1f("u_tLo", t % 1024); p.set1f("u_phase", (1.2 * t) % (2 * Math.PI));
    p.set1f("u_cloudDrift", cloudDrift); p.set1f("u_seaDrift", seaDrift); 
    p.set1f("u_cloud", S.cloud); p.set1f("u_wind", S.windEff); p.set1f("u_quality", quality);
    p.set1f("u_rain", S.weather.rain); p.set1f("u_fog", S.weather.fog); p.set1f("u_flash", flash);
    p.set1f("u_elev", A.elev); p.set1f("u_sunUp", A.sunUp); p.set2f("u_sunPos", A.sun.x, A.sun.y);
    p.set1f("u_moonUp", A.moonUp); p.set2f("u_moonPos", A.moon.x, A.moon.y); p.set2f("u_moonDir", A.moonDir.x, A.moonDir.y);
    p.set1f("u_moonFrac", A.moonFrac); p.set1f("u_moonBright", A.moonBright);
  }

  function resize(w, h) {
    W = w; H = h; cv.width = w; cv.height = h;
    for (var i = 0; i < 3; i++) { if (skyRT[i]) skyRT[i].dispose(); skyRT[i] = global.GLH.renderTarget(gl, w, h); }
    frame = 0; slice = 0; skyFade = 0;   // textures are blank: the next frame renders a full sky into cur and shows it at once
  }

  function draw(now) {
    if (!last) { last = now; t0 = now; }
    var dt = now - last; last = now; var t = (now - t0) / 1000 + uptime;
    fps.frames++; fps.acc += dt; if (dt > fps.maxFrame) fps.maxFrame = dt;
    if (fps.acc >= 1000) { fps.value = Math.round(fps.frames * 1000 / fps.acc); fps.worst = Math.round(fps.maxFrame); fps.frames = 0; fps.acc = 0; fps.maxFrame = 0; }
    var S = state(), L = light(S);
    if (global.Weather) { var f = global.Weather.update(t, dt / 1000, S.weather); if (f > 0.02 || flash > 0.02) global.Scene.skyDirty = true; flash = f; }

    // noise drifts: speed from the current effective wind, integrated here (the shader only ever sees a small number)
    var ds = Math.min(dt, 100) / 1000;
    cloudDrift = (cloudDrift + (0.006 + S.windEff * 0.0008) * 1.3 * ds) % 1024;
    seaDrift = (seaDrift + (0.05 + S.windEff * 0.004) * ds) % 1024;

    var sP = skyProg, mP = mainProg;
    var dirty = global.Scene.skyDirty;
    function skyPass(target, y0, y1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, skyRT[target].fb); gl.viewport(0, 0, W, H);
      if (y1 - y0 < H) { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, y0, W, y1 - y0); }
      sP.use(); setUniforms(sP, S, t); sP.draw();
      gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function rotate() { var p = skyPrev; skyPrev = skyCur; skyCur = skyWork; skyWork = p; sinceRot = 0; slice = 0; }
    if (frame === 0 || dirty) {                                   // first frame, or a lightning flash: full sky, shown at once
      skyPass(skyWork, 0, H); rotate(); skyFade = 0; global.Scene.skyDirty = false;
    } else {
      skyPass(skyWork, Math.floor(H * slice / skyEvery), Math.floor(H * (slice + 1) / skyEvery));
      if (++slice >= skyEvery) { rotate(); skyFade = 1; }
      else sinceRot++;
    }
    var mix = skyFade ? Math.min(1, (sinceRot + 1) / skyEvery) : 1;   // crossfade prev -> cur over the skyEvery frames after a rotation
    gl.viewport(0, 0, W, H);
    mP.use(); setUniforms(mP, S, t); mP.set1f("u_skyMix", mix);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, skyRT[skyCur].tex); mP.set1i("u_sky", 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, skyRT[skyPrev].tex); mP.set1i("u_skyPrev", 1);
    mP.draw();
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
    setUptime: function (sec) { uptime = sec; },
    setQuality: function (q) { quality = q; frame = 0; },
    setSkyEvery: function (n) { skyEvery = n; frame = 0; },
    state: state, light: light,
    /* benchmark: internal render size x quality tier x sky rate, 5 s each, median fps; ends on 720p / q2 / sky every 4 */
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
