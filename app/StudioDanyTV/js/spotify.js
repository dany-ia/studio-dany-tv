/* spotify.js — Spotify Connect as the primary audio source.
   - Access tokens come from the LAN token broker (tools/spotify-broker.js) using config.local.json
     ({ brokerUrl, brokerScan, appKey, deviceId, deviceName }); the TV never sees the refresh token.
   - The broker machine's IP can change (no DHCP reservations on the ISP modem), so the broker is found at
     startup, each candidate verified with GET /status answering { broker: "studiodany" }:
       1. brokerUrl as configured (an mDNS name such as http://My-Mac.local:8899, when the TV resolves it)
       2. the last URL that worked (localStorage "brokerUrl")
       3. a one-off scan of brokerScan (e.g. "192.168.0.") hosts 2-254 on port 8899, 24 probes at a time
     The hit is cached; when the broker stops answering the search runs again (at most once a minute).
   - Slots: coffee 06-12, reggae 12-19, jazz 19-06 (playlists.json holds the three URIs), chosen from the
     hour function given to init(): the real clock (app.js), never the scene's forced hour. At a slot
     boundary (and at launch when nothing is playing) the slot playlist starts on the chosen Connect
     device with shuffle on and repeat off, volume untouched.
   - Playback state is polled every few seconds for the HUD (track, artist, album art).
   - If the broker, the API or the device is unavailable, the stream radio takes over automatically,
     and Spotify takes back control when it returns. */
(function (global) {
  "use strict";
  var cfg = null, playlists = null, token = null, tokenExp = 0, deviceId = null;
  var state = { ok: false, reason: "iniciando", playing: false, track: "", artist: "", art: "", slot: "", device: "", broker: "" };
  var slotNow = null, lastSlotStarted = null, onChange = null, hourFn = null, pollTimer = null, failures = 0;
  var SLOTS = [{ key: "coffee", name: "Lofi Coffee", from: 6, to: 12 }, { key: "reggae", name: "Lofi Reggae", from: 12, to: 19 }, { key: "jazz", name: "Jazz Lofi", from: 19, to: 6 }];

  function slotFor(h) { for (var i = 0; i < SLOTS.length; i++) { var s = SLOTS[i], inside = s.from <= s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to); if (inside) return s; } return SLOTS[0]; }
  function emit() { if (onChange) onChange(state); }
  function xhr(method, url, headers, body, cb) {
    var x = new XMLHttpRequest(); x.open(method, url, true); x.timeout = 8000;
    for (var k in headers) x.setRequestHeader(k, headers[k]);
    x.onload = function () { var j = null; try { j = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) {} cb(null, x.status, j); };
    x.onerror = function () { cb(new Error("network")); }; x.ontimeout = function () { cb(new Error("timeout")); };
    try { x.send(body ? JSON.stringify(body) : null); } catch (e) { cb(e); }
  }
  // ---- broker discovery (see the header) ----
  var brokerUrl = null, discovering = false, lastDiscover = 0;
  function probe(url, ms, cb) {
    var x = new XMLHttpRequest(), done = false;
    function fin(ok) { if (!done) { done = true; cb(ok); } }
    try { x.open("GET", url + "/status", true); x.timeout = ms; } catch (e) { return fin(false); }
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) {} fin(!!(j && j.broker === "studiodany")); };
    x.onerror = x.ontimeout = x.onabort = function () { fin(false); };
    try { x.send(null); } catch (e) { fin(false); }
  }
  function discover(cb) {
    if (discovering) return cb(null); discovering = true; lastDiscover = Date.now();
    var cached = null; try { cached = localStorage.getItem("brokerUrl"); } catch (e) {}
    var named = [cfg.brokerUrl]; if (cached && cached !== cfg.brokerUrl) named.push(cached);
    state.reason = "buscando broker…"; emit();
    var i = 0;
    function tryNamed() {
      if (i >= named.length) return scan();
      var u = named[i++]; probe(u, 3000, function (ok) { ok ? found(u, /\.local(:|\/|$)/.test(u) ? "mdns" : (u === cfg.brokerUrl ? "config" : "cache")) : tryNamed(); });
    }
    function scan() {
      var prefix = cfg.brokerScan || (cached ? cached.replace(/^http:\/\/(\d+\.\d+\.\d+\.)\d+.*$/, "$1") : null);
      if (!prefix || !/^\d+\.\d+\.\d+\.$/.test(prefix)) return finish(null);
      var n = 2, hit = null, active = 0;
      function next() {
        if (hit) return;
        while (active < 24 && n <= 254) (function (h) {
          active++; probe("http://" + prefix + h + ":8899", 1500, function (ok) { active--; if (ok && !hit) { hit = "http://" + prefix + h + ":8899"; found(hit, "scan"); } else next(); });
        })(n++);
        if (!active && n > 254 && !hit) finish(null);
      }
      next();
    }
    function found(u, how) { brokerUrl = u; state.broker = u.replace(/^http:\/\//, "").replace(/:8899$/, "") + " (" + how + ")"; try { localStorage.setItem("brokerUrl", u); } catch (e) {} finish(u); }
    function finish(u) { discovering = false; if (!u) state.broker = "no encontrado"; cb(u); }
    tryNamed();
  }
  function getToken(cb) {
    if (token && Date.now() < tokenExp - 30000) return cb(null, token);
    if (!brokerUrl) return discover(function (u) { if (!u) return cb(new Error("broker no encontrado")); getToken(cb); });
    xhr("GET", brokerUrl + "/token", { "X-App-Key": cfg.appKey }, null, function (err, st, j) {
      if (err || st !== 200 || !j || !j.access_token) {
        if ((err || st === 0) && Date.now() - lastDiscover > 60000) brokerUrl = null;   // unreachable: search again on the next call
        return cb(new Error("broker " + (err ? err.message : st)));
      }
      token = j.access_token; tokenExp = Date.now() + (j.expires_in || 3000) * 1000; cb(null, token);
    });
  }
  function api(method, path, body, cb) {
    getToken(function (err, t) {
      if (err) return cb(err);
      xhr(method, "https://api.spotify.com/v1" + path, { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body, function (e, st, j) {
        if (e) return cb(e); if (st === 401) { token = null; return cb(new Error("401")); }
        cb(null, st, j);
      });
    });
  }

  /* start the slot playlist on the device: transfer + play with context, then shuffle on / repeat off */
  function startSlot(slot, cb) {
    if (global.SPOTIFY_READONLY) { lastSlotStarted = slot.key; state.slot = slot.name; emit(); return cb && cb(null); }
    var uri = playlists && playlists[slot.key]; if (!uri) return cb && cb(new Error("no playlist for " + slot.key));
    api("PUT", "/me/player/play?device_id=" + deviceId, { context_uri: uri }, function (err, st) {
      if (err || st >= 400) return cb && cb(err || new Error("play " + st));
      api("PUT", "/me/player/shuffle?state=true&device_id=" + deviceId, null, function () {
        api("PUT", "/me/player/repeat?state=off&device_id=" + deviceId, null, function () { lastSlotStarted = slot.key; state.slot = slot.name; emit(); cb && cb(null); });
      });
    });
  }

  var simulateDown = false;                                     // dev overlay (Blue key): pretend Spotify is unreachable
  function poll() {
    if (simulateDown) return fail("simulación: Spotify caído");
    api("GET", "/me/player", null, function (err, st, j) {
      if (err) return fail(err.message);
      failures = 0;
      var slot = slotFor(hourFn());
      if (st === 204 || !j || !j.device) {                       // nothing playing anywhere
        state.ok = true; state.playing = false; state.track = ""; state.artist = ""; state.art = ""; state.device = ""; state.reason = "";
        if (lastSlotStarted !== slot.key) { if (!state.wasPaused) return startSlot(slot, function (e) { if (e) fail(e.message); else { state.ok = true; emit(); } }); }
        return emit();
      }
      var onOurDevice = j.device.id === deviceId;
      state.ok = true; state.reason = ""; state.playing = !!j.is_playing; state.device = j.device.name; state.slot = slot.name;
      if (j.item) { state.track = j.item.name; state.artist = (j.item.artists || []).map(function (a) { return a.name; }).join(", "); var imgs = (j.item.album && j.item.album.images) || []; state.art = imgs.length ? imgs[imgs.length - 1].url : ""; }
      if (onOurDevice && slot.key !== lastSlotStarted && slotNow !== null && slotNow !== slot.key) startSlot(slot);   // boundary crossed
      slotNow = slot.key; if (lastSlotStarted === null) lastSlotStarted = slot.key;
      emit();
    });
  }
  function fail(reason) { failures++; if (failures >= 2 && state.ok !== false) { state.ok = false; state.reason = reason; emit(); } else if (!state.ok) { state.reason = reason; emit(); } }

  function load(path, cb) { xhr("GET", path, {}, null, function (err, st, j) { cb(err || (st >= 400 ? new Error(path + " " + st) : null), j); }); }

  global.Spotify = {
    init: function (hour, change) {
      hourFn = hour; onChange = change;
      load("config.local.json", function (err, c) {
        if (err || !c || !c.brokerUrl) { state.ok = false; state.reason = "sin config.local.json"; emit(); return; }
        cfg = c; deviceId = c.deviceId;
        if (global.BROKER_OVERRIDE) { cfg.brokerUrl = brokerUrl = global.BROKER_OVERRIDE; state.broker = "override"; }   // headless renders: no discovery
        load("playlists.json", function (e2, p) {
          playlists = p || {}; if (e2) { state.ok = false; state.reason = "sin playlists.json"; emit(); return; }
          poll(); pollTimer = setInterval(poll, 5000);
        });
      });
    },
    toggle: function () {
      if (!state.ok || global.SPOTIFY_READONLY) return;
      if (state.playing) { api("PUT", "/me/player/pause", null, function () { state.playing = false; state.wasPaused = true; emit(); }); }
      else { state.wasPaused = false; api("PUT", "/me/player/play?device_id=" + deviceId, null, function (err, st) { if (err || st >= 400) startSlot(slotFor(hourFn())); else { state.playing = true; emit(); } }); }
    },
    next: function (dir) { if (!state.ok || global.SPOTIFY_READONLY) return; api("POST", dir > 0 ? "/me/player/next?device_id=" + deviceId : "/me/player/previous?device_id=" + deviceId, null, function () { setTimeout(poll, 600); }); },
    state: function () { return state; },
    simulateDown: function (on) { simulateDown = on; failures = on ? 1 : 0; poll(); },
    slotFor: slotFor
  };
})(window);
