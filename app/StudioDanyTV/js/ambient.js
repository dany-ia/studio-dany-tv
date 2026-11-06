/* ambient.js — the living parts of the scene: pelican, crab, ferry and sailboat on the horizon,
   patrons who walk in along the sand, sit at the stools, chat, drink and leave (plus a dog, a kid
   with a bucket and someone taking a selfie), fire-pit and grill smoke, fireflies, wind debris.
   Characters are drawn from cached sprite frames (one small canvas per pose/frame/variant), so a
   frame costs a handful of drawImage calls plus a few rects for bubbles and particles. */
(function (global) {
  "use strict";
  var R, P, HOR_Y = 292, SHORE_Y = 394, X = 588;
  var pelican = { t: -1 }, crab = { t: -1 }, ferry = { t: -1 }, boat = { t: -1 }, next = { pelican: 20, crab: 35, ferry: 60, boat: 140 };
  var smoke = [], flies = [], debris = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- schedule of the one-off visitors ---------- */
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

  /* ---------- characters: cached frames ----------
     Each frame is painted once into a small canvas with the origin at the feet (x centred) and reused. */
  var VARIANTS = [
    { shirt: "#ffd36b", hair: "#2b1d14", skin: "#d9a06b", pants: "#3b5a8a", hat: null },
    { shirt: "#5ea8ff", hair: "#8a5a2b", skin: "#f1c9a5", pants: "#2b2b33", hat: null },
    { shirt: "#ff9ad5", hair: "#2b1d14", skin: "#8d5a3b", pants: "#f4f4f4", hat: "#e6c87a" },
    { shirt: "#2f9e4f", hair: "#5a3a1a", skin: "#d9a06b", pants: "#c0392b", hat: null },
    { shirt: "#f4f4f4", hair: "#c0392b", skin: "#f1c9a5", pants: "#2bb3a9", hat: "#ff5e5e" },
    { shirt: "#c4a2ff", hair: "#2b1d14", skin: "#8d5a3b", pants: "#3b5a8a", hat: null }
  ];
  var frames = {}, Z = 1.5;                                  // characters are drawn at 1.5x like the bartender
  function frame(key, w, h, ox, oy, paint) {                 // ox, oy = origin (feet) inside the canvas, in unscaled units
    var c = frames[key];
    if (!c) { c = document.createElement("canvas"); c.width = w * Z; c.height = h * Z; P.withContext(c.getContext("2d"), function () { paint(function (x, y, ww, hh, col) { R((ox + x) * Z, (oy + y) * Z, ww * Z, hh * Z, col); }); }); c.ox = ox * Z; c.oy = oy * Z; frames[key] = c; }
    return c;
  }
  function put(c, x, y) { P.ctx().drawImage(c, Math.round(x - c.ox), Math.round(y - c.oy)); }

  /* person walking (dir -1/1, two leg frames) */
  function walkFrame(v, f, dir) {
    var V = VARIANTS[v];
    return frame("w" + v + f + dir, 28, 44, 14, 42, function (Q) {
      var d = dir;
      Q(-4, -34, 8, 8, V.skin); Q(-5, -36, 10, 3, V.hair); Q(d > 0 ? 3 : -5, -33, 2, 5, V.hair);           // head, hair
      Q(d > 0 ? 1 : -2, -31, 1, 1, "#2b1d14");                                                             // eye
      if (V.hat) { Q(-6, -38, 12, 2, V.hat); Q(-4, -41, 8, 3, V.hat); }
      Q(-5, -26, 10, 12, V.shirt); Q(d * 2 - 1, -26, 2, 12, "#ffffff");                                      // body, shirt seam
      Q(-7, -25, 3, 9, V.skin); Q(4, -25, 3, 9, V.skin);                                                    // arms
      if (f === 0) { Q(-4, -14, 3, 12, V.pants); Q(1, -14, 3, 12, V.pants); Q(-5, -2, 4, 2, "#2b1d14"); Q(1, -2, 4, 2, "#2b1d14"); }
      else { Q(-6 + d, -14, 3, 11, V.pants); Q(2 - d, -14, 3, 12, V.pants); Q(-7 + d, -3, 4, 2, "#2b1d14"); Q(1 - d, -2, 4, 2, "#2b1d14"); }
    });
  }
  /* person sitting on a stool, back to the viewer (nod 0/1, sip 0/1) */
  function sitFrame(v, nod, sip) {
    var V = VARIANTS[v];
    return frame("s" + v + nod + sip, 30, 44, 15, 40, function (Q) {
      var n = nod;
      Q(-5, -36 + n, 10, 10, V.skin); Q(-6, -38 + n, 12, 4, V.hair); Q(-6, -34 + n, 1, 4, V.hair); Q(5, -34 + n, 1, 4, V.hair);
      if (V.hat) { Q(-8, -39 + n, 16, 2, V.hat); Q(-5, -42 + n, 10, 3, V.hat); }
      Q(-7, -26 + n, 14, 18, V.shirt); Q(-1, -26 + n, 2, 18, "rgba(0,0,0,0.12)");
      Q(-10, -24 + n, 3, 12, V.skin);
      if (sip) { Q(7, -30 + n, 3, 8, V.skin); Q(8, -36 + n, 4, 8, "#5ef2ff"); Q(9, -38 + n, 2, 2, "#ff5e7a"); } else Q(7, -24 + n, 3, 10, V.skin);
      Q(-6, -8, 5, 8, V.pants); Q(3, -8, 5, 8, V.pants);
    });
  }
  function dogFrame(f, dir) {
    return frame("d" + f + dir, 20, 14, 10, 12, function (Q) {
      var d = dir;
      Q(-6, -8, 12, 5, "#b5804a"); Q(d * 6 - 2, -11, 6, 5, "#b5804a"); Q(d * 6 - (d > 0 ? 0 : 4), -13, 3, 3, "#8a5a2b");    // body, head, ear
      Q(d * 8 + (d > 0 ? 0 : -1), -9, 1, 1, "#2b1d14"); Q(d * 9 + (d > 0 ? 0 : -2), -8, 2, 1, "#2b1d14");                   // eye, nose
      Q(-d * 7 - (d > 0 ? 1 : -1), -11 + f, 2, 4, "#b5804a");                                                                   // tail (wags)
      Q(-5, -3, 2, 3 + f, "#8a5a2b"); Q(-1, -3, 2, 3 - f + 1, "#8a5a2b"); Q(2, -3, 2, 3 + f, "#8a5a2b"); Q(5, -3, 2, 3 - f + 1, "#8a5a2b");
      Q(-3, -6, 6, 2, "#f4f4f4");                                                                                               // white chest patch
    });
  }
  function kidFrame(f, dir, dig) {
    return frame("k" + f + dir + dig, 24, 36, 12, 34, function (Q) {
      var d = dir;
      Q(-3, -24 + dig, 6, 6, "#d9a06b"); Q(-4, -26 + dig, 8, 3, "#5a3a1a"); Q(d > 0 ? 1 : -2, -22 + dig, 1, 1, "#2b1d14");
      Q(-5, -28 + dig, 10, 2, "#ff5e5e"); Q(-3, -30 + dig, 6, 2, "#ff5e5e");                                                 // cap
      Q(-4, -18 + dig, 8, 9, "#ffd36b"); Q(-1, -18 + dig, 2, 9, "#ffffff");
      Q(-6, -17 + dig, 2, 7, "#d9a06b"); Q(4, -17 + dig, 2, 7, "#d9a06b");
      if (f === 0) { Q(-3, -9, 2, 9, "#5ea8ff"); Q(1, -9, 2, 9, "#5ea8ff"); } else { Q(-4, -9, 2, 9, "#5ea8ff"); Q(2, -9, 2, 9, "#5ea8ff"); }
      Q(-4, -1, 3, 1, "#2b1d14"); Q(1, -1, 3, 1, "#2b1d14");
      Q(d * 8 - 3, -7, 6, 6, "#e8453c"); Q(d * 8 - 3, -9, 6, 1, "#8a8a96"); Q(d * 8 - 3, -7, 1, 6, "#ff9d3b");             // bucket
    });
  }
  function selfieFrame(v, flash) {
    var V = VARIANTS[v];
    return frame("f" + v + flash, 28, 48, 14, 46, function (Q) {
      Q(-4, -34, 8, 8, V.skin); Q(-5, -36, 10, 3, V.hair); Q(-1, -31, 1, 1, "#2b1d14"); Q(2, -31, 1, 1, "#2b1d14"); Q(0, -28, 2, 1, "#a05a3a");
      if (V.hat) { Q(-6, -38, 12, 2, V.hat); Q(-4, -41, 8, 3, V.hat); }
      Q(-5, -26, 10, 12, V.shirt); Q(-7, -25, 3, 9, V.skin);
      Q(4, -30, 3, 6, V.skin); Q(6, -36, 3, 7, V.skin); Q(7, -42, 3, 4, "#2b2b33"); Q(8, -41, 1, 2, flash ? "#ffffff" : "#5ef2ff");  // raised arm, phone
      Q(-4, -14, 3, 12, V.pants); Q(1, -14, 3, 12, V.pants); Q(-5, -2, 4, 2, "#2b1d14"); Q(1, -2, 4, 2, "#2b1d14");
    });
  }

  /* ---------- speech bubbles ---------- */
  var ICONS = {
    heart: ["01010", "11111", "11111", "01110", "00100", "#e8453c"], note: ["00110", "00100", "00100", "11100", "11100", "#2b1d14"],
    sun: ["10101", "01110", "11111", "01110", "10101", "#ff9d3b"], drink: ["11111", "01110", "00100", "00100", "01110", "#2bb3a9"],
    coffee: ["01000", "11110", "11111", "11110", "01110", "#6b4a22"], smile: ["01010", "00000", "10001", "01110", "00000", "#2b1d14"],
    zzz: ["11100", "00100", "01000", "11100", "00000", "#5ea8ff"], excl: ["00100", "00100", "00100", "00000", "00100", "#c0392b"],
    fish: ["00110", "01111", "11111", "01111", "00110", "#5ea8ff"], star: ["00100", "01110", "11111", "01110", "01010", "#ffd36b"]
  };
  function bubble(x, y, icon) {
    var I = ICONS[icon] || ICONS.smile;
    R(x - 5, y - 10, 11, 9, "#ffffff"); R(x - 6, y - 9, 13, 7, "#ffffff"); R(x - 2, y - 1, 2, 1, "#ffffff"); R(x - 1, y, 1, 1, "#ffffff");
    for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) if (I[r].charAt(c) === "1") R(x - 2 + c, y - 9 + r, 1, 1, I[5]);
  }

  /* ---------- patrons: state machine ----------
     in: walk from the left along the sand to a free stool. sit: nod, sip, chat (bubbles). out: walk back left.
     Specials: a dog with its owner, a kid with a bucket digging near the shore, someone taking a selfie. */
  var agents = [], stools = [false, false, false], STOOL_X = [X + 51, X + 151, X + 251], WALK_Y = 518, SIT_Y = 484, SPEED = 26;
  var nextArrival = 4, nextSpecial = 40, special = null;
  function wanted(h) {                                   // how many patrons the hour calls for (0-3)
    if (h >= 3 && h < 6.5) return 0;
    if (h < 10) return 1; if (h < 16) return 1 + (Math.random() < 0.5 ? 1 : 0);
    if (h < 23) return 3; return 1;
  }
  function freeStool() { var f = []; for (var i = 0; i < 3; i++) if (!stools[i]) f.push(i); return f.length ? pick(f) : -1; }
  function patronsHere() { var n = 0; for (var i = 0; i < agents.length; i++) if (agents[i].kind === "patron" && agents[i].state !== "out") n++; return n; }
  function spawnPatron(t, h) {
    var st = freeStool(); if (st < 0) return;
    stools[st] = true;
    var a = { kind: "patron", v: Math.floor(Math.random() * VARIANTS.length), x: -16, y: WALK_Y, dir: 1, state: "in", stool: st, tx: STOOL_X[st], t0: t,
      stay: rnd(70, 200), nextBubble: t + rnd(4, 10), bubbleUntil: 0, icon: "smile", sipUntil: 0, nextSip: t + rnd(6, 15), walk: 0 };
    agents.push(a);
    if (Math.random() < 0.3 && !special) { special = { kind: "dog", owner: a, x: -34, y: WALK_Y + 2, dir: 1, walk: 0 }; agents.push(special); }
  }
  function spawnSpecial(t, h) {
    if (special) return;
    var r = Math.random();
    if (h >= 8 && h < 18 && r < 0.45) special = { kind: "kid", x: -14, y: WALK_Y, dir: 1, state: "in", tx: rnd(200, 470), ty: rnd(404, 424), t0: t, stay: rnd(25, 45), walk: 0 };
    else if (h >= 9 && h < 21) special = { kind: "selfie", v: Math.floor(Math.random() * VARIANTS.length), x: -14, y: rnd(498, 514), dir: 1, state: "in", tx: rnd(120, 520), t0: t, stay: rnd(14, 24), flashAt: [], walk: 0 };
    else return;
    if (special.kind === "selfie") { for (var i = 0; i < 3; i++) special.flashAt.push(rnd(3, special.stay - 2)); }
    agents.push(special);
  }
  function stepWalk(a, dt, toX) {                        // returns true on arrival
    var d = toX - a.x, step = SPEED * dt; a.walk += dt * 6;
    if (Math.abs(d) <= step) { a.x = toX; return true; }
    a.x += d > 0 ? step : -step; a.dir = d > 0 ? 1 : -1; return false;
  }
  function updateAgents(t, dt, S, L) {
    var h = S.hour;
    if (t > nextArrival) { nextArrival = t + rnd(6, 20); if (patronsHere() < wanted(h) && Math.random() < 0.8) spawnPatron(t, h); }
    if (t > nextSpecial) { nextSpecial = t + rnd(60, 180); spawnSpecial(t, h); }
    var closing = h >= 3 && h < 6.5;
    for (var i = agents.length - 1; i >= 0; i--) {
      var a = agents[i];
      if (a.kind === "patron") {
        if (a.state === "in") { if (stepWalk(a, dt, a.tx)) { a.state = "sit"; a.t0 = t; a.y = SIT_Y; } }
        else if (a.state === "sit") {
          if (t - a.t0 > a.stay || closing || (patronsHere() > wanted(h) + 1)) { a.state = "out"; a.y = WALK_Y; stools[a.stool] = false; }
          if (t > a.nextBubble) { a.icon = pick(h < 12 ? ["coffee", "sun", "smile", "note", "heart", "fish"] : ["drink", "note", "heart", "smile", "sun", "star", "excl"]); a.bubbleUntil = t + rnd(2, 3.2); a.nextBubble = t + rnd(7, 18); }
          if (t > a.nextSip) { a.sipUntil = t + 1.6; a.nextSip = t + rnd(8, 20); }
        }
        else if (a.state === "out") { if (stepWalk(a, dt, -24)) { agents.splice(i, 1); continue; } }
      } else if (a.kind === "dog") {
        var o = a.owner, target = o.state === "sit" ? o.tx - 28 : o.x - 22;
        if (o.state === "out" && o.x < -20) { agents.splice(i, 1); special = null; continue; }
        a.sit = o.state === "sit" && Math.abs(a.x - target) < 1; if (!a.sit) stepWalk(a, dt, target); else a.walk += dt * 3;
        a.dir = o.state === "sit" ? 1 : o.dir;
      } else if (a.kind === "kid") {
        if (a.state === "in") { if (stepWalk(a, dt, a.tx)) { a.state = "dig"; a.t0 = t; } a.y += (a.ty - a.y) * Math.min(1, dt * 0.8); }
        else if (a.state === "dig") { if (t - a.t0 > a.stay || closing) { a.state = "out"; } }
        else if (stepWalk(a, dt, -20)) { agents.splice(i, 1); special = null; continue; }
        if (a.state === "out") a.y += (WALK_Y - a.y) * Math.min(1, dt * 0.8);
      } else if (a.kind === "selfie") {
        if (a.state === "in") { if (stepWalk(a, dt, a.tx)) { a.state = "pose"; a.t0 = t; } }
        else if (a.state === "pose") { if (t - a.t0 > a.stay || closing) a.state = "out"; }
        else if (stepWalk(a, dt, -20)) { agents.splice(i, 1); special = null; continue; }
      }
    }
  }
  function drawAgents(t, L) {
    agents.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i], f = Math.floor(a.walk) % 2;
      if (a.kind === "patron") {
        if (a.state === "sit") { var nod = Math.floor(t * 1.5 + a.stool) % 2, sip = t < a.sipUntil ? 1 : 0; put(sitFrame(a.v, nod, sip), a.x, a.y); if (t < a.bubbleUntil) bubble(a.x + 14, a.y - 66 - nod * Z, a.icon); }
        else put(walkFrame(a.v, f, a.dir), a.x, a.y);
      } else if (a.kind === "dog") { put(dogFrame(a.sit ? Math.floor(t * 4) % 2 : f, a.dir), a.x, a.y); }
      else if (a.kind === "kid") {
        if (a.state === "dig") { var dg = Math.floor(t * 3) % 2; put(kidFrame(0, a.dir, dg), a.x, a.y); if (dg) { R(a.x + a.dir * 15, a.y - 5, 3, 2, "#e4cf98"); R(a.x + a.dir * 19, a.y - 9, 2, 2, "#e4cf98"); } R(a.x - 12, a.y - 1, 24, 3, "#e4cf98"); }
        else put(kidFrame(f, a.dir, 0), a.x, a.y);
      } else if (a.kind === "selfie") {
        if (a.state === "pose") { var e = t - a.t0, fl = false; for (var k = 0; k < a.flashAt.length; k++) if (e > a.flashAt[k] && e < a.flashAt[k] + 0.12) fl = true;
          put(selfieFrame(a.v, fl ? 1 : 0), a.x, a.y); if (fl) P.radial(a.x + 13, a.y - 60, 34, "rgba(255,255,255,A)", 0.7); if (e > a.stay - 2) bubble(a.x + 6, a.y - 70, "heart"); }
        else put(walkFrame(a.v, f, a.dir), a.x, a.y);
      }
    }
  }

  /* ---------- particles ---------- */
  function updSmoke(t, dt, L, S, lit, grillOn) {
    var w = S.windEff != null ? S.windEff : S.wind;
    if (lit && Math.random() < 0.35) smoke.push({ x: 300 + rnd(-6, 6), y: 492, vx: rnd(-3, 3) + w * 0.4, vy: -rnd(10, 16), a: 0.35, life: 0 });
    if (grillOn && Math.random() < 0.25) smoke.push({ x: 936 + rnd(-4, 4), y: 492, vx: rnd(-2, 2) + w * 0.4, vy: -rnd(9, 14), a: 0.3, life: 0 });
    for (var i = smoke.length - 1; i >= 0; i--) { var p = smoke[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt; p.a -= dt * 0.07; if (p.a <= 0) { smoke.splice(i, 1); continue; }
      var s = 2 + Math.floor(p.life * 2); P.ctx().fillStyle = "rgba(200,200,210," + p.a.toFixed(2) + ")"; P.ctx().fillRect(Math.round(p.x), Math.round(p.y), s, s); }
  }
  function updFlies(t, dt, L) {
    if (L.night < 0.4) { flies.length = 0; return; }
    while (flies.length < 14) flies.push({ x: rnd(40, 560), y: rnd(300, 500), ph: rnd(0, 6.28), s: rnd(0.3, 0.8) });
    for (var i = 0; i < flies.length; i++) { var f = flies[i]; f.x += Math.sin(t * f.s + f.ph) * 0.4; f.y += Math.cos(t * f.s * 1.3 + f.ph) * 0.3;
      var a = Math.max(0, Math.sin(t * 2.2 + f.ph)); if (a > 0.5) { R(f.x, f.y, 2, 2, "rgba(190,255,120," + (a * L.night).toFixed(2) + ")"); } }
  }
  /* wind debris above ~20 km/h: leaves torn from the palm crowns and sand streaks skimming the ground, blown to the right */
  function updDebris(t, dt, S) {
    var w = S.windEff != null ? S.windEff : S.wind, k = Math.max(0, (w - 18) / 30);
    if (k > 0) {
      if (debris.length < 8 + k * 30 && Math.random() < k * 0.6) {
        if (Math.random() < 0.3) debris.push({ leaf: 1, x: rnd(120, 420), y: rnd(190, 270), vx: 40 + w * 3, vy: rnd(10, 30), ph: rnd(0, 6), life: rnd(2, 4), c: pick(["#3fb55d", "#7fe08a", "#a67c3b", "#1f7a3a"]) });
        else debris.push({ leaf: 0, x: rnd(-20, 900), y: rnd(470, 536), vx: 90 + w * 5, vy: 0, ph: 0, life: rnd(0.6, 1.4), c: "rgba(255,245,215,0.55)" });
      }
    }
    for (var i = debris.length - 1; i >= 0; i--) { var d = debris[i]; d.life -= dt; d.x += d.vx * dt; d.y += (d.vy + (d.leaf ? Math.sin(t * 5 + d.ph) * 25 : 0)) * dt;
      if (d.life <= 0 || d.x > 980 || d.y > 540) { debris.splice(i, 1); continue; }
      if (d.leaf) R(d.x, d.y, 3, 2, d.c); else R(d.x, d.y, 5 + Math.round(w * 0.1), 1, d.c); }
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
    sand: function (t, dt, S, L, fireLit) { if (crab.t >= 0) drawCrab(t); updFlies(t, dt, L); var grillOn = drawGrill(S); updSmoke(t, dt, L, S, fireLit, grillOn); updDebris(t, dt, S); },
    front: function (t, dt, S, L) { updateAgents(t, dt, S, L); drawAgents(t, L); },
    /* pre-simulate `sec` seconds (t from -sec to 0) so patrons are already seated in a fresh render (?warm=120) */
    warm: function (sec, S, L) { nextArrival = -sec + 3; nextSpecial = -sec + 20; for (var t = -sec; t < 0; t += 0.1) updateAgents(t, 0.1, S, L); },
    count: function () { return agents.length; }
  };
})(window);
