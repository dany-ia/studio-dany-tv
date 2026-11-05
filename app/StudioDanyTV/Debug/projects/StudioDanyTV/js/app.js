/* Studio Dany TV — HUD: clock, Spanish date, Open-Meteo weather, lofi radio, remote keys, debug overlay. */
(function () {
  "use strict";

  // ---------- config ----------
  var CFG = {
    render: "1080",            // "4k" | "1080" | "auto". Measured on the UN98DU9000 (2026-11-05): 1080 = 60 fps, 4K canvas = 17 fps.
    bisect: true,              // TEMP: perf bisect run on launch
    debugOnStart: true,        // show the FPS / resolution overlay for the first seconds (Red key toggles later)
    debugSeconds: 90,
    lat: 20.63, lon: -87.07, tz: "America/Cancun",
    weatherEveryMs: 15 * 60 * 1000,
    streams: [
      { name: "groove salad · somafm", url: "https://ice1.somafm.com/groovesalad-128-mp3" },
      { name: "fluid · somafm", url: "https://ice1.somafm.com/fluid-128-mp3" }
    ]
  };

  var $ = function (id) { return document.getElementById(id); };
  var DIAS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  var MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };

  // ---------- clock ----------
  function tick() {
    var d = new Date();
    $("hm").textContent = p2(d.getHours()) + ":" + p2(d.getMinutes());
    $("ss").textContent = p2(d.getSeconds());
    $("date").textContent = DIAS[d.getDay()] + " " + d.getDate() + " DE " + MESES[d.getMonth()];
  }

  // ---------- weather ----------
  var WX = {
    0: "despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "nublado", 45: "niebla", 48: "niebla",
    51: "llovizna", 53: "llovizna", 55: "llovizna", 56: "llovizna helada", 57: "llovizna helada",
    61: "lluvia ligera", 63: "lluvia", 65: "lluvia fuerte", 66: "lluvia helada", 67: "lluvia helada",
    71: "nieve", 73: "nieve", 75: "nieve", 77: "nieve", 80: "chubascos", 81: "chubascos", 82: "chubascos fuertes",
    85: "nieve", 86: "nieve", 95: "tormenta", 96: "tormenta con granizo", 99: "tormenta con granizo"
  };
  function iconKind(code, isDay) {
    if (code === 0 || code === 1) return isDay ? "sun" : "moon";
    if (code === 2) return isDay ? "suncloud" : "mooncloud";
    if (code === 3 || code === 45 || code === 48) return "cloud";
    if (code >= 95) return "storm";
    if (code >= 51) return "rain";
    return "cloud";
  }
  function drawIcon(kind) {
    var c = $("wxicon").getContext("2d"); c.clearRect(0, 0, 12, 12);
    var f = function (x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); };
    var sun = function (cx, cy) { f(cx - 1, cy - 1, 3, 3, "#ffd27a"); f(cx, cy - 3, 1, 1, "#ffb347"); f(cx, cy + 3, 1, 1, "#ffb347"); f(cx - 3, cy, 1, 1, "#ffb347"); f(cx + 3, cy, 1, 1, "#ffb347"); };
    var moon = function (cx, cy) { f(cx - 2, cy - 2, 4, 4, "#e8ecff"); f(cx - 1, cy - 2, 3, 3, "#05060f"); f(cx - 2, cy + 1, 1, 1, "#e8ecff"); };
    var cloud = function (y, col) { f(2, y + 2, 8, 3, col); f(4, y, 4, 2, col); f(3, y + 1, 7, 1, col); };
    if (kind === "sun") sun(6, 6);
    if (kind === "moon") moon(6, 6);
    if (kind === "suncloud") { sun(8, 3); cloud(5, "#cfd8ea"); }
    if (kind === "mooncloud") { moon(8, 3); cloud(5, "#cfd8ea"); }
    if (kind === "cloud") cloud(3, "#cfd8ea");
    if (kind === "rain") { cloud(1, "#aab6cc"); f(3, 7, 1, 2, "#5ef2ff"); f(6, 8, 1, 2, "#5ef2ff"); f(9, 7, 1, 2, "#5ef2ff"); }
    if (kind === "storm") { cloud(1, "#8e9ab0"); f(6, 6, 2, 2, "#ffe08a"); f(5, 8, 2, 2, "#ffe08a"); f(4, 10, 2, 1, "#ffe08a"); }
  }
  function hourOf(iso) { var m = /T(\d\d):(\d\d)/.exec(iso || ""); return m ? (+m[1]) + (+m[2]) / 60 : -1; }
  var lastWx = null;
  function renderWx(j) {
    var c = j.current, d = j.daily;
    $("wx").innerHTML = (WX[c.weather_code] || "clima") + " <b>" + Math.round(c.temperature_2m) + "°</b> · " +
      Math.round(d.temperature_2m_min[0]) + "° / " + Math.round(d.temperature_2m_max[0]) + "° · " + Math.round(c.relative_humidity_2m) + "% hum";
    drawIcon(iconKind(c.weather_code, c.is_day === 1));
    if (window.Scene) Scene.setSun(hourOf(d.sunrise[0]), hourOf(d.sunset[0]));
  }
  function weather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + CFG.lat + "&longitude=" + CFG.lon +
      "&current=temperature_2m,relative_humidity_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=" +
      encodeURIComponent(CFG.tz) + "&forecast_days=1";
    var x = new XMLHttpRequest(); x.open("GET", url, true); x.timeout = 12000;
    x.onload = function () {
      try {
        if (x.status !== 200) throw new Error("http " + x.status);
        var j = JSON.parse(x.responseText); lastWx = { at: Date.now(), data: j }; renderWx(j);
        try { localStorage.setItem("wx", JSON.stringify(lastWx)); } catch (e) {}
      } catch (e) { wxFail(); }
    };
    x.onerror = wxFail; x.ontimeout = wxFail;
    try { x.send(); } catch (e) { wxFail(); }
  }
  function wxFail() {
    if (lastWx) { renderWx(lastWx.data); $("wx").innerHTML += " · <span style='color:#7a6a4a'>sin conexión</span>"; }
    else { $("wx").textContent = "clima no disponible · sin conexión"; drawIcon("cloud"); }
  }
  try { var cached = JSON.parse(localStorage.getItem("wx")); if (cached && cached.data) { lastWx = cached; renderWx(cached.data); } } catch (e) {}

  // ---------- radio ----------
  var audio, bars, lbl, streamIdx = 0, autoplayMuted = false;
  function setRadioUI(state, extra) {
    bars.className = "bars " + (state === "playing" ? "" : state === "muted" ? "muted" : "off");
    var names = { idle: "OK para reproducir", playing: CFG.streams[streamIdx].name, muted: "en silencio · OK para activar sonido", error: "sin señal · OK para reintentar", loading: "conectando…" };
    lbl.textContent = "lofi radio · " + (extra || names[state]);
  }
  function play() {
    audio.src = CFG.streams[streamIdx].url; setRadioUI("loading");
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { setRadioUI(audio.muted ? "muted" : "playing"); })
       .catch(function (err) {
         if (err && err.name === "NotAllowedError" && !audio.muted) { audio.muted = true; autoplayMuted = true; play(); }
         else setRadioUI("error");
       });
    }
  }
  function toggleRadio() {
    if (audio.muted && !audio.paused) { audio.muted = false; autoplayMuted = false; setRadioUI("playing"); return; }
    if (audio.paused) { audio.muted = false; play(); }
    else { audio.pause(); setRadioUI("idle"); }
  }
  function radioInit() {
    audio = $("radio"); bars = $("bars"); lbl = $("radioLabel");
    audio.addEventListener("error", function () {
      if (streamIdx < CFG.streams.length - 1) { streamIdx++; play(); } else { streamIdx = 0; setRadioUI("error"); }
    });
    audio.addEventListener("stalled", function () { setRadioUI(audio.muted ? "muted" : "playing", "reconectando…"); });
    audio.addEventListener("playing", function () { setRadioUI(audio.muted ? "muted" : "playing"); });
    play();  // autoplay attempt; falls back to muted if the engine blocks it
  }

  // ---------- keys ----------
  var KEY = { ENTER: 13, RETURN: 10009, PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
  function registerKeys() {
    try {
      var names = ["MediaPlayPause", "MediaPlay", "MediaPause", "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue"];
      for (var i = 0; i < names.length; i++) { try { tizen.tvinputdevice.registerKey(names[i]); } catch (e) {} }
    } catch (e) {}
  }
  function onKey(e) {
    var k = e.keyCode;
    if (k === KEY.ENTER || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) { toggleRadio(); e.preventDefault(); }
    else if (k === KEY.RETURN) { try { tizen.application.getCurrentApplication().exit(); } catch (err) {} }
    else if (k === KEY.RED) { $("debug").classList.toggle("hidden"); }
    else if (k === KEY.GREEN) { setRender(renderMode === "4k" ? "1080" : "4k"); }
    else if (k === KEY.YELLOW) { window.SCENE_HOUR_OVERRIDE = (window.SCENE_HOUR_OVERRIDE == null ? 0 : window.SCENE_HOUR_OVERRIDE + 1.5) % 24; if (window.SCENE_HOUR_OVERRIDE === 0 && yellowPresses++ > 0) { window.SCENE_HOUR_OVERRIDE = null; } }
    else if (k === KEY.BLUE) { window.SCENE_HOUR_OVERRIDE = null; }
  }
  var yellowPresses = 0;

  // ---------- perf bisect: disable one effect at a time, 5 s each, print fps table ----------
  var bisectLog = "";
  function bisect() {
    var F = window.SCENE_FLAGS, names = ["all", "none", "vignette", "scan", "eq", "debugbox", "hud", "all2"], i = 0, samples = [];
    function apply(n) {
      for (var k in F) F[k] = (n === "none") ? false : true; if (F.hasOwnProperty(n)) F[n] = false;
      document.body.className = (n === "vignette" ? "novig " : "") + (n === "scan" ? "noscan " : "");
      $("bars").classList.toggle("noanim", n === "eq");
      $("debug").style.visibility = (n === "debugbox") ? "hidden" : "visible";
      var hud = [$("hm").parentNode.parentNode, $("radioLabel").parentNode, document.querySelector(".corner")];
      for (var h = 0; h < hud.length; h++) hud[h].style.visibility = (n === "hud") ? "hidden" : "visible";
    }
    function step() {
      if (i > 0) { samples.sort(function (a, b) { return a - b; }); bisectLog += names[i - 1] + ":" + samples[Math.floor(samples.length / 2)] + " "; }
      if (i >= names.length) { apply("all"); bisectLog += "| fin"; return; }
      apply(names[i]); samples = []; i++;
      var n = 0, iv = setInterval(function () { samples.push(Scene.fps.value); if (++n >= 5) { clearInterval(iv); step(); } }, 1000);
    }
    setTimeout(step, 4000);
  }

  // ---------- render size / debug ----------
  var renderMode = "1080";
  function setRender(mode) {
    renderMode = mode;
    var w = mode === "4k" ? 3840 : 1920, h = mode === "4k" ? 2160 : 1080;
    if (!window.Scene) return;
    if (Scene.size().w) Scene.resize(w, h); else Scene.start($("scene"), w, h);
  }
  function debugLoop() {
    var s = Scene.size(), f = Scene.fps;
    $("debug").textContent =
      "FPS " + f.value + "  (peor frame " + f.worst + " ms)\n" +
      "bisect(fps sin X) " + bisectLog + "\n" +
      "ms " + Object.keys(f.prof || {}).map(function (k) { return k + " " + f.prof[k]; }).join("  ") + "\n" +
      "canvas " + s.w + "x" + s.h + "  px=" + s.px + "  modo " + renderMode + "\n" +
      "viewport " + window.innerWidth + "x" + window.innerHeight + "  dpr " + (window.devicePixelRatio || 1) + "\n" +
      "screen " + screen.width + "x" + screen.height + "\n" +
      "radio " + (audio ? (audio.paused ? "pausa" : (audio.muted ? "muda" : "sonando")) + " rs" + audio.readyState : "-") + "\n" +
      "ua " + navigator.userAgent.replace(/.*(Tizen[^;)]*|SMART-TV[^;)]*).*/, "$1").slice(0, 40);
  }

  // ---------- boot ----------
  window.onload = function () {
    tick(); setInterval(tick, 1000);
    registerKeys(); document.addEventListener("keydown", onKey);
    try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF); } catch (e) {}

    var mode = CFG.render;
    if (mode === "auto") mode = (window.innerWidth >= 3840 || screen.width >= 3840) ? "4k" : "1080";
    setRender(mode);

    weather(); setInterval(weather, CFG.weatherEveryMs);
    radioInit();

    if (CFG.bisect) bisect();
    if (CFG.debugOnStart) { $("debug").classList.remove("hidden"); setTimeout(function () { $("debug").classList.add("hidden"); }, CFG.debugSeconds * 1000); }
    setInterval(debugLoop, 500);
  };
})();
