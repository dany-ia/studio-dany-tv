/* radio.js — lofi radio by time of day.
   Stations and slots come from radio.json (editable without touching code). Two <audio> elements
   crossfade at slot boundaries (and on manual skips). OK toggles play/pause, left/right skip within
   the slot. A test mode plays every station for a few seconds and reports which ones start. */
(function (global) {
  "use strict";
  var cfg = { crossfadeMs: 2000, slots: [] };
  var els = [], active = 0, slot = -1, idx = 0, playing = false, fadeTimer = null, status = "cargando…", onChange = null, testLog = "";
  var hourFn = function () { var d = new Date(); return d.getHours() + d.getMinutes() / 60; };

  function slotFor(h) {
    for (var i = 0; i < cfg.slots.length; i++) { var s = cfg.slots[i]; var inside = s.from <= s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to); if (inside) return i; }
    return 0;
  }
  function station() { var s = cfg.slots[slot]; return s ? s.stations[idx % s.stations.length] : null; }
  function label() { var s = cfg.slots[slot], st = station(); return s && st ? { slot: s.name, station: st.name, status: status } : { slot: "lofi radio", station: "", status: status }; }
  function emit() { if (onChange) onChange(label()); }

  /* start `st` on the inactive element and crossfade to it over `ms` */
  function silence(el) { el.onplaying = el.onerror = el.onstalled = null; el.pause(); try { el.removeAttribute("src"); el.load(); } catch (e) {} }
  function start(st, ms) {
    var next = 1 - active, a = els[next], old = els[active];
    clearInterval(fadeTimer); silence(a); a.src = st.url; a.volume = 0; status = "conectando…"; emit();
    var started = false;
    a.onplaying = function () {
      if (started || els[active] !== a) return; started = true; status = "sonando"; emit();
      var t0 = Date.now();
      fadeTimer = setInterval(function () {
        var k = Math.min(1, (Date.now() - t0) / Math.max(50, ms));
        a.volume = k; old.volume = 1 - k;
        if (k >= 1) { clearInterval(fadeTimer); silence(old); }     // handlers removed first: clearing src fires a bogus error otherwise
      }, 50);
    };
    a.onerror = function () { if (els[active] !== a) return; status = "sin señal"; emit(); setTimeout(function () { if (playing && els[active] === a) skip(1); }, 1500); };
    a.onstalled = function () { if (els[active] === a && status === "sonando") { status = "reconectando…"; emit(); } };
    active = next; playing = true;
    var p = a.play();
    if (p && p.catch) p.catch(function (err) { if (els[active] !== a) return; status = (err && err.name === "NotAllowedError") ? "bloqueado · OK para reproducir" : "sin señal"; emit(); });
  }
  function skip(dir) { var s = cfg.slots[slot]; if (!s) return; idx = (idx + dir + s.stations.length) % s.stations.length; start(station(), 800); }
  function tick() {
    if (!playing) return;
    var s = slotFor(hourFn());
    if (s !== slot) { slot = s; idx = 0; start(station(), cfg.crossfadeMs); }
  }

  global.Radio = {
    init: function (audioA, audioB, hour, change, autoplay) {
      els = [audioA, audioB]; hourFn = hour || hourFn; onChange = change;
      var x = new XMLHttpRequest(); x.open("GET", "radio.json", true);
      x.onload = function () {
        try { cfg = JSON.parse(x.responseText); } catch (e) { status = "radio.json inválido"; emit(); return; }
        slot = slotFor(hourFn()); idx = 0; status = "en espera"; emit();
        if (autoplay !== false) start(station(), 300);
        setInterval(tick, 5000);
      };
      x.onerror = function () { status = "radio.json no encontrado"; emit(); };
      x.send();
    },
    toggle: function () {
      var a = els[active];
      if (playing) { playing = false; clearInterval(fadeTimer); a.pause(); status = "pausa · OK para reproducir"; emit(); }
      else { playing = true; if (a.src) { a.volume = 1; a.play(); status = "sonando"; emit(); } else start(station(), 300); tick(); }
    },
    next: function (dir) { if (cfg.slots.length) { playing = true; skip(dir); } },
    /* used by the Spotify fallback: start / stop the stream without touching the user's play state */
    play: function () { if (!playing && cfg.slots.length) { playing = true; slot = slotFor(hourFn()); idx = 0; start(station(), 600); } },
    stop: function () { if (playing) { playing = false; clearInterval(fadeTimer); silence(els[0]); silence(els[1]); status = "en espera"; emit(); } },
    label: label,
    isPlaying: function () { return playing && status === "sonando"; },
    testLog: function () { return testLog; },
    /* play every station for `secs` seconds (volume 0.05) and log whether it started */
    test: function (secs, done) {
      var list = []; cfg.slots.forEach(function (s) { s.stations.forEach(function (st) { list.push({ slot: s.name, st: st }); }); });
      var wasPlaying = playing; playing = false; clearInterval(fadeTimer); silence(els[0]); silence(els[1]);
      var a = els[1 - active], i = 0; testLog = "";
      function one() {
        if (i >= list.length) { silence(a); testLog += "| fin"; if (wasPlaying) { playing = true; slot = -1; tick(); } if (done) done(testLog); return; }
        var it = list[i++], t0 = Date.now(), ok = false;
        a.onplaying = function () { if (!ok) { ok = true; testLog += it.st.name.slice(0, 14) + ":✓" + ((Date.now() - t0) / 1000).toFixed(1) + "s "; } };
        a.onerror = function () { if (!ok) { ok = true; testLog += it.st.name.slice(0, 14) + ":✗err "; } };
        a.src = it.st.url; a.volume = 0.05; var p = a.play(); if (p && p.catch) p.catch(function () {});
        setTimeout(function () { if (!ok) { ok = true; testLog += it.st.name.slice(0, 14) + ":✗timeout "; } one(); }, secs * 1000);
      }
      one();
    }
  };
})(window);
