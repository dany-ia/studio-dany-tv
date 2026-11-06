/* app.js — HUD (clock, Spanish date, Open-Meteo weather, lofi radio), remote keys, dev overlay. */
(function () {
  "use strict";

  var CFG = {
    lat: 20.63, lon: -87.07, tz: "America/Cancun",
    weatherEveryMs: 15 * 60 * 1000,
    devOnStart: true,           // show the dev/fps overlay at launch (0 key toggles it)
    benchOnStart: false         // run the resolution/quality benchmark 5 s after launch (measurement runs only)
  };

  var $ = function (id) { return document.getElementById(id); };
  var DIAS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  var MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };

  // shared environment for the scene (window.ENV) and dev overrides (window.DEV)
  window.ENV = { sunrise: 6.5, sunset: 18.1, code: 0, wind: 10, isDay: 1 };
  window.DEV = { on: false, field: 0, hour: null, code: null, month: null, day: null, wind: null, q: 2, res: 720, sky: 4 };

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
  function hourOf(iso) { var m = /T(\d\d):(\d\d)/.exec(iso || ""); return m ? (+m[1]) + (+m[2]) / 60 : -1; }
  var lastWx = null;
  function renderWx(j) {
    var c = j.current, d = j.daily, forced = window.DEV && window.DEV.code != null;
    $("wx").innerHTML = (WX[forced ? window.DEV.code : c.weather_code] || "clima") + (forced ? " (dev)" : "") + " <b>" + Math.round(c.temperature_2m) + "°</b> · " +
      Math.round(d.temperature_2m_min[0]) + "° / " + Math.round(d.temperature_2m_max[0]) + "° · " +
      Math.round(c.relative_humidity_2m) + "% hum · " + Math.round(c.wind_speed_10m) + " km/h";
    window.ENV.code = c.weather_code; window.ENV.wind = c.wind_speed_10m; window.ENV.isDay = c.is_day;
    var sr = hourOf(d.sunrise[0]), ss = hourOf(d.sunset[0]);
    if (sr > 0 && ss > sr) { window.ENV.sunrise = sr; window.ENV.sunset = ss; }
    if (window.Scene) Scene.skyDirty = true;
  }
  function weather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + CFG.lat + "&longitude=" + CFG.lon +
      "&current=temperature_2m,relative_humidity_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=" +
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
    else { $("wx").textContent = "clima no disponible · sin conexión"; }
  }
  try { var cached = JSON.parse(localStorage.getItem("wx")); if (cached && cached.data) { lastWx = cached; renderWx(cached.data); } } catch (e) {}

  // ---------- radio (js/radio.js + radio.json) ----------
  function radioUI(l) {
    $("bars").className = "bars " + (l.status === "sonando" ? "" : "off");
    $("radioSlot").textContent = l.slot.toLowerCase();
    $("radioLabel").textContent = (l.station ? l.station + " · " : "") + l.status;
  }
  function radioInit() {
    Radio.init($("radioA"), $("radioB"), function () { return Scene.state().hour; }, radioUI);   // forced hours switch the slot too
  }
  function toggleRadio() { Radio.toggle(); }

  // ---------- dev overlay (0 key) ----------
  // fields: hour / weather code / month / day / wind (scene overrides) + quality / resolution / sky rate (live switches)
  var CODES = [0, 1, 2, 3, 45, 51, 61, 63, 65, 80, 82, 95];
  var FIELDS = ["hora", "clima", "mes", "día", "viento", "calidad", "res", "cielo"];
  var RES = [540, 720, 1080], SKY = [1, 2, 4];
  // review presets on the number keys: 1-4 hours, 6 Día de Muertos, 7 Navidad, 8 lluvia, 9 tormenta; 5 clears everything
  var PRESETS = { 49: { hour: 6.5 }, 50: { hour: 12.0 }, 51: { hour: 18.25 }, 52: { hour: 23.0 },
                  54: { hour: 20.0, month: 11, day: 2, code: 0 }, 55: { hour: 19.0, month: 12, day: 20, code: 1 }, 56: { hour: 15.0, code: 63 }, 57: { hour: 21.0, code: 95 } };
  function devAdjust(dir) {
    var D = window.DEV, S = Scene.state();
    if (D.field === 0) D.hour = ((D.hour == null ? Math.floor(S.hour) : D.hour) + dir * 0.5 + 24) % 24;
    if (D.field === 1) { var i = Math.max(0, CODES.indexOf(S.code)); D.code = CODES[(i + dir + CODES.length) % CODES.length]; }
    if (D.field === 2) D.month = ((S.month - 1 + dir + 12) % 12) + 1;
    if (D.field === 3) D.day = ((S.day - 1 + dir + 31) % 31) + 1;
    if (D.field === 4) D.wind = Math.max(0, S.wind + dir * 5);
    if (D.field === 5) { D.q = (D.q + dir + 3) % 3; Scene.setQuality(D.q); }
    if (D.field === 6) { D.res = RES[(RES.indexOf(D.res) + dir + 3) % 3]; Scene.setRes(D.res * 16 / 9, D.res); }
    if (D.field === 7) { D.sky = SKY[(SKY.indexOf(D.sky) + dir + 3) % 3]; Scene.setSkyEvery(D.sky); }
    Scene.skyDirty = true; refreshWx();
  }
  function refreshWx() { if (lastWx) renderWx(lastWx.data); }
  function devRender() {
    if (!window.DEV.on) { if (!$("devmark").classList.contains("hidden")) $("devmark").textContent = "DEV · " + Scene.fps.value + " fps"; return; }
    var D = window.DEV, S = Scene.state(), f = Scene.fps, z = Scene.size(), I = Scene.info;
    var vals = [S.hour.toFixed(1) + "h", S.code + " " + (WX[S.code] || ""), MESES[S.month - 1].slice(0, 3), S.day, Math.round(S.wind) + "km/h", "q" + z.q, z.h + "p", "1/" + z.s];
    var line = "";
    for (var i = 0; i < FIELDS.length; i++) line += (i === D.field ? "[" : " ") + FIELDS[i] + " " + vals[i] + (i === D.field ? "]" : " ") + " ";
    $("dev").textContent = "FPS " + f.value + " (peor " + f.worst + " ms)  bg " + z.w + "x" + z.h + " q" + z.q + " cielo 1/" + z.s + "  " + I.gl + "  gpu " + I.renderer.slice(0, 22) + "\n" +
      "bench " + (I.bench || "…") + "   radio " + (Radio.testLog() || "(VERDE: probar estaciones)") + "\n" +
      line + "\n◄► campo  ▲▼ valor  1-4 horas  6 muertos  7 navidad  8 lluvia  9 tormenta  5 real  ROJO reset  VERDE radio  0 cerrar   sol " + window.ENV.sunrise.toFixed(2) + "/" + window.ENV.sunset.toFixed(2);
  }

  // ---------- keys ----------
  var KEY = { ENTER: 13, RETURN: 10009, PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, RED: 403, GREEN: 404, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ZERO: 48, FIVE: 53 };
  function registerKeys() {
    var names = ["MediaPlayPause", "MediaPlay", "MediaPause", "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    for (var i = 0; i < names.length; i++) { try { tizen.tvinputdevice.registerKey(names[i]); } catch (e) {} }
  }
  function clearOverrides() { var D = window.DEV; D.hour = D.code = D.month = D.day = D.wind = null; Scene.skyDirty = true; $("devmark").classList.add("hidden"); refreshWx(); }
  function hasOverrides() { var D = window.DEV; return D.hour != null || D.code != null || D.month != null || D.day != null || D.wind != null; }
  var hideTimer = null;
  function onKey(e) {
    var k = e.keyCode, D = window.DEV;
    if (k === KEY.ZERO) {                       // 0: show/hide the overlay. Forced states survive hiding (for photos) and auto-clear after 10 min.
      D.on = !D.on; $("dev").classList.toggle("hidden", !D.on); clearTimeout(hideTimer);
      if (!D.on && hasOverrides()) { $("devmark").classList.remove("hidden"); hideTimer = setTimeout(clearOverrides, 10 * 60 * 1000); }
      if (D.on) $("devmark").classList.add("hidden");
      return;
    }
    if (D.on || hasOverrides()) {
      if (k === KEY.LEFT) { D.field = (D.field + FIELDS.length - 1) % FIELDS.length; devRender(); return; }
      if (k === KEY.RIGHT) { D.field = (D.field + 1) % FIELDS.length; devRender(); return; }
      if (k === KEY.UP) { devAdjust(1); devRender(); return; }
      if (k === KEY.DOWN) { devAdjust(-1); devRender(); return; }
      if (k === KEY.RED) { clearOverrides(); devRender(); return; }
      if (k === KEY.GREEN) { Radio.test(7); devRender(); return; }
      if (PRESETS[k] != null) { var pr = PRESETS[k]; D.hour = pr.hour != null ? pr.hour : null; D.month = pr.month != null ? pr.month : null; D.day = pr.day != null ? pr.day : null; D.code = pr.code != null ? pr.code : null; Scene.skyDirty = true; refreshWx(); devRender(); return; }
      if (k === KEY.FIVE) { clearOverrides(); devRender(); return; }
    }
    if (k === KEY.ENTER || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) { toggleRadio(); e.preventDefault(); }
    else if (k === KEY.LEFT) Radio.next(-1);
    else if (k === KEY.RIGHT) Radio.next(1);
    else if (k === KEY.RETURN) { try { tizen.application.getCurrentApplication().exit(); } catch (err) {} }
  }

  // ---------- URL params (local preview in a desktop browser): ?hour=23&code=61&month=11&day=2&wind=20&dev=0 ----------
  function applyUrlParams() {
    var q = {}, m, re = /[?&]([^=&]+)=([^&]*)/g, s = location.search;
    while ((m = re.exec(s))) q[m[1]] = decodeURIComponent(m[2]);
    var D = window.DEV;
    if (q.hour != null) D.hour = parseFloat(q.hour); if (q.code != null) D.code = parseInt(q.code, 10);
    if (q.month != null) D.month = parseInt(q.month, 10); if (q.day != null) D.day = parseInt(q.day, 10); if (q.wind != null) D.wind = parseFloat(q.wind);
    if (q.dev != null) CFG.devOnStart = q.dev === "1";
    if (q.radio === "0") CFG.radio = false;
  }

  // ---------- boot ----------
  window.onload = function () {
    applyUrlParams();
    tick(); setInterval(tick, 1000);
    registerKeys(); document.addEventListener("keydown", onKey);
    try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF); } catch (e) {}
    Sprites.start($("fg"));
    Decor.init(Sprites.painter); Ambient.init(Sprites.painter); Weather.init(Sprites.painter);
    var ok = Scene.start($("bg"));
    weather(); setInterval(weather, CFG.weatherEveryMs);
    if (CFG.radio !== false) radioInit();
    if (CFG.devOnStart) { window.DEV.on = true; $("dev").classList.remove("hidden"); }
    setInterval(devRender, 500);
    if (ok && CFG.benchOnStart) setTimeout(function () { Scene.bench(); }, 5000);
  };
})();
