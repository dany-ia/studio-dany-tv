/* ambient.js — the living parts of the scene: pelican, crab, ferry and sailboat on the horizon,
   patrons who walk in along the sand, sit at the stools, chat, drink and leave (plus a dog, a kid
   with a bucket and someone taking a selfie), fire-pit and grill smoke, fireflies, wind debris.
   Since v0.4 also the random beach life (see "beach life" below): hammock guest, marshmallows at the
   fire pit, swimmers, a surfer, dolphins, couples, a bar scuffle, seagulls, kite, fireworks...
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
  function schedule(t, L) {
    if (pelican.t < 0 && t > next.pelican && !(L.d > 0.35)) next.pelican = t + rnd(60, 180);   // no birds at night: try again later
    if (pelican.t < 0 && t > next.pelican) { pelican = { t: t, y: rnd(60, 160), dir: Math.random() < 0.5 ? 1 : -1, v: rnd(26, 40) }; next.pelican = t + rnd(90, 240); }
    if (crab.t < 0 && t > next.crab) { crab = { t: t, dir: Math.random() < 0.5 ? 1 : -1, v: rnd(10, 16) }; next.crab = t + rnd(120, 300); }
    if (ferry.t < 0 && t > next.ferry) { ferry = { t: t, dir: 1, v: 9 }; next.ferry = t + rnd(400, 900); }
    if (boat.t < 0 && t > next.boat) { boat = { t: t, dir: -1, v: 7 }; next.boat = t + rnd(300, 700); }
  }

  /* ---------- sprites ---------- */
  function drawPelican(t, L) {
    var e = t - pelican.t, x = pelican.dir > 0 ? -30 + e * pelican.v : 990 - e * pelican.v; if (x < -40 || x > 1000 || L.d < 0.2) { pelican.t = -1; return; }
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
    CTX = context(t, S, L);
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
        /* state "fight": driven by the scuffle controller (evFight) */
      } else if (a.step) { if (a.step(a, t, dt) === false) { agents.splice(i, 1); continue; }
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
      if (a.layer) continue;                                // sea / sky actors are painted in their own pass
      if (a.draw) { a.draw(a, t, L); continue; }
      if (a.kind === "patron") {
        if (a.state === "sit") { var nod = Math.floor(t * 1.5 + a.stool) % 2, sip = t < a.sipUntil ? 1 : 0; put(sitFrame(a.v, nod, sip), a.x, a.y); if (t < a.bubbleUntil) bubble(a.x + 14, a.y - 66 - nod * Z, a.icon); }
        else if (a.state === "fight") { put(a.brawl ? punchFrame(a.v, a.dir, a.punch) : walkFrame(a.v, 0, a.dir), a.x, a.y); if (t < a.bubbleUntil) bubble(a.x + a.dir * 4, a.y - 70, a.dizzy ? "star" : a.icon); }
        else { put(walkFrame(a.v, f, a.dir), a.x, a.y); if (a.dizzy && t < a.bubbleUntil) bubble(a.x + 4, a.y - 70, Math.floor(t * 2) % 2 ? "star" : "zzz"); }
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

  /* ================= beach life (v0.4): random events driven by hour, weekday, date and weather =================
     A director picks one eligible event every 20-60 s (weighted by the context below); each event owns a zone
     (hammock, fire, swim, surf, dolph, sand, bar, path, sky) and only one event per zone runs at a time.
     Events are plain actors in `agents` with step(a, t, dt) (return false = gone) and draw / drawSea / drawSky.
     Sea actors are painted before the sand and palms (so they sit behind them) and get the night tint there.
     The dev overlay ("evento" field) and ?event=name fire any of them on demand, ignoring the conditions. */
  var CTX = null, fireOn = false, lastRun = {}, nextEvent = 25, lastEvent = "", pending = [], hamGuest = null, HAMG = { x1: 166, x2: 346, y: 388, S: 24 }, splashes = [];
  var FIESTAS = { "9-15": 1, "9-16": 1, "12-24": 1, "12-31": 1, "1-1": 1 };                 // fireworks nights
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function context(t, S, L) {
    var E = global.ENV || {}, W = S.weather || {}, dow = S.date ? S.date.getDay() : 0, h = S.hour, A = S.astro || {};
    return { t: t, h: h, S: S, L: L, day: L.d > 0.5, night: L.d < 0.1, rain: W.rain || 0, wet: (W.rain || 0) > 0.3, storm: !!W.storm,
      wind: S.wind || 0, windEff: S.windEff != null ? S.windEff : (S.wind || 0), temp: E.temp != null ? E.temp : 28,
      weekend: dow === 0 || dow === 6 || (dow === 5 && h >= 18), sat: dow === 6, month: S.month, dom: S.day, fiesta: !!FIESTAS[S.month + "-" + S.day], love: S.month === 2 && S.day === 14,
      fullMoon: A.moonFrac > 0.9 && A.moonUp > 0.2, closing: h >= 3 && h < 6.5, fire: fireOn };
  }
  /* walk in 2D toward (tx, ty); true on arrival */
  function go(a, dt, tx, ty, sp) {
    var dx = tx - a.x, dy = ty - a.y, d = Math.sqrt(dx * dx + dy * dy), st = (sp || SPEED) * dt; a.walk += dt * 6;
    if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
    if (d <= st) { a.x = tx; a.y = ty; return true; }
    a.x += dx / d * st; a.y += dy / d * st; return false;
  }
  function actor(o) { o.walk = 0; if (!o.dir) o.dir = 1; if (o.v == null) o.v = Math.floor(Math.random() * VARIANTS.length); agents.push(o); return o; }
  function busy(z) { for (var i = 0; i < agents.length; i++) if (agents[i].zone === z) return true; return false; }
  function sandX(a, b) { var x = rnd(a, b); return x > 258 && x < 342 ? (x < 300 ? x - 84 : x + 84) : x; }   // a free spot on the open sand, never on the fire pit
  function walker(a) { put(walkFrame(a.v, Math.floor(a.walk) % 2, a.dir), a.x, a.y); }
  function say(a, t, icons, every) { if (t > (a.nextBubble || 0)) { a.icon = pick(icons); a.bubbleUntil = t + rnd(2, 3); a.nextBubble = t + rnd(every, every * 2.2); } }

  /* ---------- extra cached frames ---------- */
  function groundSitFrame(v, dir, arm) {                  // sitting cross-legged on the sand, side view; arm 0 = holding a stick out, 1 = hand at the mouth
    var V = VARIANTS[v];
    return frame("g" + v + dir + arm, 30, 36, 15, 34, function (Q) {
      var d = dir;
      Q(-4, -25, 8, 8, V.skin); Q(-5, -27, 10, 3, V.hair); Q(d > 0 ? -5 : 3, -24, 2, 5, V.hair); Q(d > 0 ? 2 : -3, -22, 1, 1, "#2b1d14");
      if (V.hat) { Q(-6, -29, 12, 2, V.hat); Q(-4, -32, 8, 3, V.hat); }
      Q(-5, -17, 10, 12, V.shirt);
      Q(d > 0 ? -3 : -7, -6, 10, 5, V.pants); Q(d > 0 ? 6 : -9, -9, 3, 7, V.pants); Q(d > 0 ? 8 : -11, -2, 3, 2, "#2b1d14");
      if (arm) Q(d > 0 ? 3 : -6, -19, 3, 6, V.skin); else Q(d > 0 ? 3 : -10, -14, 7, 3, V.skin);
    });
  }
  function lieFrame(v, knee) {                            // lying in the hammock, head to the left; knee 0/1 = one knee up
    var V = VARIANTS[v];
    return frame("l" + v + knee, 44, 18, 22, 16, function (Q) {
      Q(-17, -9, 7, 7, V.skin); Q(-19, -10, 3, 8, V.hair); Q(-17, -11, 7, 2, V.hair);
      if (V.hat) Q(-16, -13, 9, 4, V.hat); else Q(-12, -6, 1, 1, "#2b1d14");
      Q(-10, -8, 13, 6, V.shirt); Q(-7, -10, 7, 2, V.skin);
      Q(3, -7, 12, 5, V.pants);
      if (knee) { Q(8, -12, 3, 6, V.pants); Q(11, -8, 5, 3, V.pants); } Q(15, -9, 3, 5, V.skin);
    });
  }
  function surfFrame(v, dir) {                            // crouched on a board, arms out
    var V = VARIANTS[v];
    return frame("u" + v + dir, 26, 28, 13, 26, function (Q) {
      var d = dir;
      Q(-3 + d, -23, 6, 6, V.skin); Q(-4 + d, -25, 8, 3, V.hair); Q(d > 0 ? 3 : -2, -21, 1, 1, "#2b1d14");
      Q(-4, -17, 8, 9, V.shirt); Q(-10, -16, 6, 2, V.skin); Q(4, -16, 6, 2, V.skin);
      Q(-6, -8, 4, 5, V.pants); Q(2, -8, 4, 5, V.pants); Q(-8, -3, 4, 3, V.skin); Q(4, -3, 4, 3, V.skin);
    });
  }
  function punchFrame(v, dir, f) {                        // standing, fists up; f = 1 throws the front arm
    var V = VARIANTS[v];
    return frame("p" + v + dir + f, 36, 44, 18, 42, function (Q) {
      var d = dir;
      Q(-4, -34, 8, 8, V.skin); Q(-5, -36, 10, 3, V.hair); Q(d > 0 ? -5 : 3, -33, 2, 5, V.hair); Q(d > 0 ? 1 : -2, -31, 1, 1, "#2b1d14"); Q(d > 0 ? 1 : -3, -28, 2, 1, "#a05a3a");
      if (V.hat) { Q(-6, -38, 12, 2, V.hat); Q(-4, -41, 8, 3, V.hat); }
      Q(-5, -26, 10, 12, V.shirt);
      Q(d > 0 ? -7 : 4, -25, 3, 6, V.skin); Q(d > 0 ? -6 : 3, -28, 3, 4, V.skin);
      if (f) { Q(d > 0 ? 4 : -14, -25, 10, 3, V.skin); Q(d > 0 ? 13 : -16, -26, 3, 5, V.skin); } else { Q(d > 0 ? 4 : -7, -25, 3, 5, V.skin); Q(d > 0 ? 5 : -9, -28, 4, 4, V.skin); }
      Q(-6, -14, 3, 12, V.pants); Q(3, -14, 3, 12, V.pants); Q(-7, -2, 4, 2, "#2b1d14"); Q(3, -2, 4, 2, "#2b1d14");
    });
  }
  /* a walk frame standing in water: only the top `vis` px show, with a foam line at the waterline (y) */
  function putWater(c, x, y, vis) {
    vis = Math.round(clamp(vis, 4, c.height));
    P.ctx().drawImage(c, 0, 0, c.width, vis, Math.round(x - c.ox), Math.round(y - vis), c.width, vis);
    R(x - 8, y - 1, 16, 2, "rgba(255,255,255,0.75)");
  }
  function splash(x, y, n) { if (CTX) splashes.push({ x: x, y: y, t0: CTX.t, n: n }); }
  function drawSplashes(t) {
    for (var i = splashes.length - 1; i >= 0; i--) { var s = splashes[i], e = t - s.t0; if (e > 0.8 || e < 0) { splashes.splice(i, 1); continue; }
      for (var k = 0; k < s.n; k++) { var vx = (((k * 37) % 17) / 17 - 0.5) * 60, vy = -22 - ((k * 53) % 13) * 3.2, y = s.y + vy * e + 75 * e * e; if (y < s.y + 1) R(s.x + vx * e, y, 2, 2, "#ffffff"); } }
  }

  /* ---------- 1. hammock: someone climbs in, rocks, naps, sits up for a drink, leaves ---------- */
  function evHammock(t, C, force) {
    hamGuest = actor({ zone: "hammock", x: -16, y: WALK_Y, state: "in", stay: rnd(60, 150), forced: force, pose: 0, knee: 0, nextPose: 0, sipUntil: 0, nextBubble: t + rnd(10, 18),
      step: function (a, t, dt) {
        var C = CTX, mx = (HAMG.x1 + HAMG.x2) / 2;
        if (a.state === "in") { if (a.x < 150) go(a, dt, 150, WALK_Y); else if (go(a, dt, mx - 8, 470)) { a.state = "lie"; a.t0 = t; a.nextPose = t + rnd(10, 20); } }
        else if (a.state === "lie") {
          if (t - a.t0 > a.stay || C.closing || (!a.forced && (C.wet || C.wind > 34))) { a.state = "out"; return; }
          if (t > a.nextPose) { a.pose = a.pose ? 0 : (Math.random() < 0.55 ? 1 : 0); a.knee = Math.random() < 0.5 ? 1 : 0; a.nextPose = t + (a.pose ? rnd(7, 13) : rnd(9, 20)); if (a.pose) a.sipUntil = t + rnd(2, 4); }
          say(a, t, a.pose ? ["drink", "sun", "note", "smile"] : ["zzz", "zzz", "note", "heart"], 9);
        }
        else if (go(a, dt, -26, WALK_Y)) { hamGuest = null; return false; }
      },
      draw: function (a) { if (a.state !== "lie") walker(a); } });
  }
  function hammockGuest(t, swing, G, front) {
    HAMG = G; var a = hamGuest; if (!a || a.state !== "lie") return;
    var x = (G.x1 + G.x2) / 2 + swing, top = G.y + G.S;
    if (!front && a.pose) put(sitFrame(a.v, Math.floor(t * 1.5) % 2, t < a.sipUntil ? 1 : 0), x, top + 15);       // sitting up, back to us, legs behind the cloth
    if (front && !a.pose) put(lieFrame(a.v, a.knee), x + 3, top + 5);
    if (front && t < a.bubbleUntil) bubble(x + 14, top - (a.pose ? 52 : 18), a.icon);
  }

  /* ---------- 2. bonfire: a few people sit around the fire pit at night and roast marshmallows ---------- */
  var SPOTS = [[256, 497, 1], [344, 497, -1], [228, 508, 1], [372, 508, -1], [252, 524, 1], [348, 524, -1]];
  function evBonfire(t, C, force) {
    var n = Math.min(6, 2 + Math.floor(rnd(0, C.weekend || C.fiesta ? 4.99 : 2.99))), stay = rnd(90, 210);
    for (var i = 0; i < n; i++) actor({ zone: "fire", x: -16 - i * 20, y: WALK_Y, spot: SPOTS[i], state: "in", stay: stay + i * 3, forced: force, m: 0, cook: rnd(12, 20), burn: false, eating: false, eatUntil: 0, coldAt: 0, nextBubble: t + rnd(6, 16), step: stepRoast, draw: drawRoast });
  }
  function stepRoast(a, t, dt) {
    var C = CTX;
    if (a.state === "in") { if (go(a, dt, a.spot[0], a.spot[1])) { a.state = "roast"; a.t0 = t; a.dir = a.spot[2]; } }
    else if (a.state === "roast") {
      if (!fireOn && !a.forced) { if (!a.coldAt) a.coldAt = t; } else a.coldAt = 0;                       // the fire went out (rain, dawn): they get up
      if (t - a.t0 > a.stay || C.closing || (a.coldAt && t - a.coldAt > 4)) { a.state = "out"; return; }
      if (t >= a.eatUntil) {
        if (a.eating) { a.eating = false; a.m = 0; a.cook = rnd(12, 20); a.burn = Math.random() < 0.2; }
        a.m += dt / a.cook;
        if (a.m >= (a.burn ? 1.22 : 1)) { a.eating = true; a.eatUntil = t + 2.6; a.icon = a.burn ? "excl" : pick(["heart", "smile", "star"]); a.bubbleUntil = t + 2.2; a.nextBubble = t + rnd(8, 18); }
      }
      if (!a.eating) say(a, t, ["note", "note", "smile", "star", "heart"], 10);
    }
    else if (go(a, dt, -26, WALK_Y)) return false;
  }
  function drawRoast(a, t) {
    if (a.state !== "roast") { walker(a); return; }
    var d = a.dir; put(groundSitFrame(a.v, d, a.eating ? 1 : 0), a.x, a.y);
    if (!a.eating) {                                        // the stick toward the flames and the marshmallow: white, golden, brown... or on fire
      var hx = a.x + d * 14, hy = a.y - 20, tx = 300 - d * 13, ty = hy + 4, m = a.m, n = Math.max(2, Math.round(Math.abs(tx - hx) / 4));
      for (var i = 0; i < n; i++) R(hx + (tx - hx) * i / n - (d > 0 ? 0 : 4), hy + Math.round(4 * i / n), 4, 1, "#5a3a1a");
      R(tx - 2, ty - 2, 4, 4, m < 0.45 ? "#ffffff" : (m < 0.8 ? "#f4dcae" : (m < 1 ? "#c98b4a" : "#3b2314")));
      if (m >= 1) { var fl = Math.floor(t * 10) % 2; R(tx - 2, ty - 6 - fl, 4, 4, "#ff9d3b"); R(tx - 1, ty - 8 - fl, 2, 3, "#ffd36b"); }
    } else if (!a.burn) R(a.x + d * 7, a.y - 31, 3, 3, "#f4dcae");
    if (t < a.bubbleUntil) bubble(a.x + d * 3, a.y - 52, a.icon);
  }

  /* ---------- 3. a dip in the sea: 2-4 people normally, up to 12 on hot days and weekends ---------- */
  function evSwim(t, C, force, big) {
    var n = big ? 12 : ((C.weekend || C.temp >= 30) && Math.random() < 0.3 ? 5 + Math.floor(rnd(0, 3.99)) : 2 + Math.floor(rnd(0, 2.99)));
    var cx = rnd(140, 420), stay = rnd(45, 110);
    for (var i = 0; i < n; i++) { var sx = clamp(cx + rnd(-1, 1) * (40 + n * 16), 30, 540);
      actor({ zone: "swim", x: -16 - i * 15, y: WALK_Y + rnd(-5, 8), state: "in", sx: sx, wx: clamp(sx + rnd(-24, 24), 24, 546), wy: rnd(346, 384), stay: stay + rnd(-10, 25), forced: force, ph: rnd(0, 6.28), vis: 66, nextBubble: t + rnd(8, 30), step: stepSwim, draw: walker, drawSea: drawSwim }); }
  }
  function stepSwim(a, t, dt) {
    var C = CTX, FULL = 66, HEAD = 27, top = SHORE_Y + 4;
    if (a.state === "in") { if (go(a, dt, a.sx, top)) { a.state = "wade"; a.layer = "sea"; } }
    else if (a.state === "wade") { var done = go(a, dt, a.wx, a.wy, 15); a.vis = HEAD + (FULL - HEAD) * clamp((a.y - a.wy) / (top - a.wy), 0, 1); if (done) { a.state = "swim"; a.t0 = t; a.hx = a.wx; a.hy = a.wy; a.nextMove = t + rnd(3, 8); } }
    else if (a.state === "swim") {
      a.vis = HEAD;
      if (t - a.t0 > a.stay || C.closing || (!a.forced && (C.wet || C.storm || C.L.d < 0.3))) { a.state = "back"; return; }
      if (t > a.nextMove) { a.hx = clamp(a.wx + rnd(-30, 30), 24, 546); a.hy = clamp(a.wy + rnd(-8, 8), 344, 386); a.nextMove = t + rnd(4, 10); if (Math.random() < 0.35) splash(a.x, a.y - 6, 6); }
      go(a, dt, a.hx, a.hy, 7); say(a, t, ["sun", "smile", "fish", "heart", "note"], 16);
    }
    else if (a.state === "back") { var d2 = go(a, dt, a.sx, top, 15); a.vis = HEAD + (FULL - HEAD) * clamp((a.y - a.wy) / (top - a.wy), 0, 1); if (d2) { a.state = "out"; a.layer = null; } }
    else if (go(a, dt, -26, WALK_Y)) return false;
  }
  function drawSwim(a, t) {
    var sw = a.state === "swim", y = a.y + (sw ? Math.sin(t * 2 + a.ph) * 1.5 : 0);
    putWater(walkFrame(a.v, sw ? 0 : Math.floor(a.walk) % 2, a.dir), a.x, y, a.vis);
    if (sw && Math.sin(t * 1.1 + a.ph * 3) > 0.82) { var V = VARIANTS[a.v], up = Math.floor(t * 6) % 2; R(a.x - 12, y - 12 - up * 3, 3, 9, V.skin); R(a.x + 9, y - 9 - (1 - up) * 3, 3, 9, V.skin); R(a.x - 14, y - 16, 2, 2, "#ffffff"); R(a.x + 13, y - 14, 2, 2, "#ffffff"); }
    if (t < a.bubbleUntil) bubble(a.x + 12, y - a.vis - 2, a.icon);
  }

  /* ---------- 4. surfer: rides in from the left, carves, turns back (or wipes out and paddles home) ---------- */
  function evSurf(t, C, force) {
    var y0 = rnd(346, 372);
    actor({ zone: "surf", layer: "sea", x: -30, y: y0, y0: y0, dir: 1, state: "ride", turnX: rnd(330, 500), wipe: Math.random() < 0.3, forced: force, sp: rnd(34, 46) + Math.min(14, C.wind * 0.4), ph: rnd(0, 6), board: pick(["#ff7f50", "#ffd36b", "#e8453c", "#f4f4f4", "#ff9ad5"]),
      step: function (a, t, dt) {
        if (a.state === "ride") { a.x += a.dir * a.sp * dt; a.y = a.y0 + Math.sin(t * 1.4 + a.ph) * 5;
          if (a.dir > 0 && a.x >= a.turnX) { if (a.wipe) { a.state = "wipe"; a.t0 = t; splash(a.x, a.y, 14); } else a.dir = -1; }
          if (a.x < -44) return false; }
        else if (a.state === "wipe") { if (t - a.t0 > 2.2) a.state = "paddle"; }
        else { a.x -= 17 * dt; a.y = a.y0 + Math.sin(t * 2) * 1; if (a.x < -44) return false; }
      },
      drawSea: function (a, t) {
        var x = a.x, y = a.y, d = a.dir, V = VARIANTS[a.v], i;
        if (a.state === "ride") {
          R(x - d * 8 - 22, y - 7, 44, 1, "rgba(255,255,255,0.35)"); R(x - d * 10 - 14, y - 5, 28, 2, "rgba(255,255,255,0.55)");      // the lip of the wave behind the rider
          for (i = 0; i < 5; i++) R(d > 0 ? x - 18 - i * 7 : x + 12 + i * 7, y + 1 + (i % 2), 6 - i, 1, "rgba(255,255,255," + (0.8 - i * 0.15).toFixed(2) + ")");   // wake
          R(x - 13, y, 26, 3, a.board); R(d > 0 ? x + 13 : x - 16, y - 1, 3, 3, a.board); R(x - 13, y + 3, 26, 1, "rgba(0,20,40,0.45)"); R(x - 6, y + 1, 12, 1, "#2b2b33");
          put(surfFrame(a.v, d), x, y);
        } else if (a.state === "wipe") {
          var e = t - a.t0; R(x + 6 + e * 3, y + Math.round(Math.sin(t * 3)), 22, 2, a.board);
          if (e > 1.1) putWater(walkFrame(a.v, 0, -1), x - 8, y + 3, 24);
        } else {                                              // paddling home, lying on the board
          var pd = Math.floor(t * 3) % 2;
          R(x - 11, y, 22, 2, a.board); R(x - 13, y - 1, 2, 2, a.board); R(x - 6, y - 4, 13, 4, V.shirt); R(x + 7, y - 3, 5, 3, V.pants); R(x - 11, y - 6, 5, 5, V.skin); R(x - 11, y - 7, 5, 2, V.hair);
          R(x - 4 + pd * 5, y + 1, 2, 3, V.skin); R(x + 12, y + 1, 5 - pd * 2, 1, "rgba(255,255,255,0.6)");
        }
      } });
  }

  /* ---------- 5. dolphins: a pod of 2-4 leaping far out, by day only ---------- */
  function drawDolphin(x, y, d, ang) {
    var cs = Math.cos(ang), sn = Math.sin(ang), body = "#2f4d68", SZ = [3, 5, 7, 8, 7, 5, 4];
    R(x - d * 13 * cs - 1, y - 13 * sn - 5, 3, 10, body);                                                                        // tail flukes
    for (var j = -3; j <= 3; j++) { var px = x + d * j * 3.4 * cs, py = y + j * 3.4 * sn, s = SZ[j + 3]; R(px - s / 2, py - s / 2, s + 1, s, body);
      if (j === 0) R(px - d * 2 - 2, py - s / 2 - 3, 4, 3, body);                                                                 // dorsal fin
      if (j >= -1 && j <= 2) R(px - 2, py + s / 2 - 2, 5, 2, "#c9dde6"); }                                                         // pale belly
    R(x + d * 13.5 * cs - 2, y + 13.5 * sn - 1, 4, 2, body);                                                                      // snout
  }
  function evDolphins(t, C, force) {
    var d = Math.random() < 0.5 ? 1 : -1, n = 2 + Math.floor(rnd(0, 2.99)), pod = [];
    for (var i = 0; i < n; i++) pod.push({ off: i * rnd(20, 30), per: rnd(2.8, 3.8), ph: rnd(0, 1), hgt: rnd(17, 26), dy: rnd(-4, 5), u: 1, jump: false });
    actor({ zone: "dolph", layer: "sea", x: d > 0 ? -20 : 545, y: rnd(308, 322), dir: d, pod: pod, t0: t, sp: rnd(24, 32), forced: force,
      step: function (a, t, dt) {
        a.x += a.dir * a.sp * dt; var off = a.pod[a.pod.length - 1].off, quit = !a.forced && (CTX.L.d < 0.4 || CTX.storm);
        for (var i = 0; i < a.pod.length; i++) { var p = a.pod[i], x = a.x - a.dir * p.off, u = ((t - a.t0) / p.per + p.ph) % 1;
          if (u < p.u) { p.jump = !quit && x > 10 && x < 490; if (p.jump) splash(x, a.y + p.dy, 4); }                           // a new cycle starts: leap only while in open water
          p.u = u; }
        if (a.dir > 0 ? a.x - off > 560 : a.x + off < -30) return false;
      },
      drawSea: function (a, t) {
        for (var i = 0; i < a.pod.length; i++) { var p = a.pod[i], x = a.x - a.dir * p.off, y = a.y + p.dy, u = p.u;
          if (p.jump && u < 0.36) { var s = u / 0.36; drawDolphin(x + a.dir * s * 16, y - Math.sin(s * Math.PI) * p.hgt, a.dir, -0.85 * Math.cos(s * Math.PI)); if (s > 0.88) { R(x + a.dir * 18 - 5, y - 2, 10, 2, "#ffffff"); R(x + a.dir * 18 - 2, y - 5, 2, 3, "#ffffff"); R(x + a.dir * 18 + 3, y - 4, 2, 2, "#ffffff"); } }
          else if (p.jump && u > 0.6 && u < 0.76) { R(x - 2, y - 4, 4, 4, "#2f4d68"); R(x - 7, y, 14, 1, "rgba(255,255,255,0.6)"); } }      // just the fin between leaps
      } });
  }

  /* ---------- 6. two people meet on the sand and chat; a couple ends with a kiss ---------- */
  var TALK = ["smile", "sun", "drink", "note", "fish", "star", "smile", "excl"];
  function evMeet(t, C, force, kiss) {
    var tx = sandX(150, 520), ty = rnd(507, 526), v1 = Math.floor(Math.random() * VARIANTS.length), v2 = (v1 + 1 + Math.floor(Math.random() * (VARIANTS.length - 1))) % VARIANTS.length;
    var G = { here: 0, t0: 0, kiss: kiss, dur: rnd(8, 16), seed: Math.floor(rnd(0, 8)), tx: tx };
    for (var i = 0; i < 2; i++) actor({ zone: "sand", grp: G, i: i, v: i ? v2 : v1, x: -16 - i * 22, y: ty, tx: tx + (i ? -9 : 9), state: "in", forced: force,
      step: function (a, t, dt) {
        var G = a.grp;
        if (a.state === "in") { if (go(a, dt, a.tx, a.y)) { a.state = "talk"; a.dir = a.i ? 1 : -1; if (++G.here === 2) G.t0 = t; } }
        else if (a.state === "talk") { if (G.here === 2 && (t - G.t0 > G.dur || CTX.closing || (!a.forced && CTX.wet))) { if (G.kiss && !CTX.closing) { a.state = "kiss"; a.x = a.tx + (a.i ? 4 : -4); G.k0 = t; } else a.state = "out"; } }
        else if (a.state === "kiss") { if (t - G.k0 > 4.5) a.state = "out"; }
        else if (go(a, dt, -26, a.y)) return false;
      },
      draw: function (a, t) {
        var G = a.grp;
        if (a.state === "talk" || a.state === "kiss") put(walkFrame(a.v, 0, a.dir), a.x, a.y); else walker(a);
        if (a.state === "talk" && G.here === 2) { var turn = Math.floor((t - G.t0) / 2.4); if (turn % 2 === a.i && (t - G.t0) % 2.4 < 2) bubble(a.x + (a.i ? -4 : 8), a.y - 70, G.kiss && turn > 2 && turn % 3 === 0 ? "heart" : TALK[(turn * 3 + G.seed) % TALK.length]); }
        if (a.state === "kiss" && a.i === 0) { var e = t - G.k0, hy = a.y - 70 - e * 5; bubble(G.tx + 1, hy, "heart"); if (e > 1) { R(G.tx - 12, hy + 10 - e * 2, 2, 2, "#e8453c"); R(G.tx + 13, hy + 16 - e * 3, 2, 2, "#ff9ad5"); } }
      } });
  }

  /* ---------- 7. a scuffle at the bar: two seated patrons argue, a cartoon dust cloud, then they make up or one walks off dizzy ---------- */
  function evFight(t, C, force) {
    var s = [], i; for (i = 0; i < agents.length; i++) if (agents[i].kind === "patron" && agents[i].state === "sit") s.push(agents[i]);
    if (s.length < 2) return false;
    s.sort(function (p, q) { return p.stool - q.stool; }); var k = Math.floor(rnd(0, s.length - 1.001)), a = s[k], b = s[k + 1], cx = (a.tx + b.tx) / 2;
    a.state = b.state = "fight"; a.y = b.y = WALK_Y - 2; a.punch = b.punch = 0; a.brawl = b.brawl = false; a.bubbleUntil = b.bubbleUntil = 0; a.dizzy = b.dizzy = false;
    actor({ zone: "bar", x: cx, y: WALK_Y - 1, a: a, b: b, t0: t, dur: rnd(5, 8), makeup: Math.random() < 0.55, phase: 0,
      step: function (c, t, dt) {
        var e = t - c.t0, a = c.a, b = c.b, cx = c.x;
        if (e < 3) { if (go(a, dt, cx - 11, a.y)) a.dir = 1; if (go(b, dt, cx + 11, b.y)) b.dir = -1;
          var sp = Math.floor(e / 0.8) % 2 ? a : b; sp.icon = "excl"; sp.bubbleUntil = t + 0.1; }
        else if (e < 3 + c.dur) { c.phase = 1; a.dir = 1; b.dir = -1; a.x = cx - 7 + Math.sin(t * 11) * 2; b.x = cx + 7 + Math.sin(t * 13 + 1) * 2; a.brawl = b.brawl = true; a.punch = Math.floor(t * 5) % 2; b.punch = 1 - a.punch; }
        else if (c.phase < 2) { c.phase = 2; c.t1 = t; a.brawl = b.brawl = false; a.x = cx - 12; b.x = cx + 12;
          if (c.makeup) { a.icon = "smile"; b.icon = "heart"; a.bubbleUntil = b.bubbleUntil = t + 2.4; }
          else { c.loser = Math.random() < 0.5 ? a : b; c.loser.dizzy = true; c.loser.bubbleUntil = t + 9; } }
        else if (t - c.t1 > 2.6) {
          a.y = b.y = WALK_Y; a.state = b.state = "in";                                                   // back to their stools...
          if (!c.makeup) { c.loser.state = "out"; stools[c.loser.stool] = false; }                          // ...except the one who has had enough
          return false;
        }
      },
      draw: function (c, t) {
        var e = t - c.t0, i;
        if (e < 3 + c.dur && Math.floor(t * 2) % 2) bubble(X + 174, 330, "excl");                         // the bartender is not amused
        if (c.phase === 1) {
          for (i = 0; i < 7; i++) R(c.x + Math.sin(t * 9 + i * 2.1) * 17 - 5, WALK_Y - 30 + Math.cos(t * 7 + i * 1.7) * 20 - 4, 9 + (i % 3) * 2, 7, i % 2 ? "rgba(244,236,214,0.9)" : "rgba(228,207,152,0.9)");
          for (i = 0; i < 3; i++) { var sx = c.x + Math.sin(t * 5 + i * 2.4) * 24, sy = WALK_Y - 34 + Math.cos(t * 6 + i * 2) * 26; R(sx - 2, sy, 5, 1, "#ffd36b"); R(sx, sy - 2, 1, 5, "#ffd36b"); }
        }
      } });
  }

  /* ---------- 8. feeding the seagulls: someone scatters crumbs and a few gulls fly in, peck around and leave ---------- */
  function drawGull(g, t) {
    var x = g.x, y = g.y, d = g.d, W = "#f4f4f4", G = "#a9aeba";
    if (g.st === "land") { var pk = t < g.peck ? 3 : 0;
      R(x - 4, y - 6, 8, 4, W); R(x - 3, y - 6, 6, 2, G); R(d > 0 ? x - 6 : x + 4, y - 6, 2, 2, "#555555");
      R(d > 0 ? x + 3 : x - 6, y - 9 + pk, 3, 3, W); R(d > 0 ? x + 6 : x - 8, y - 8 + pk, 2, 1, "#ff9d3b"); R(x - 2, y - 2, 1, 2, "#ff9d3b"); R(x + 1, y - 2, 1, 2, "#ff9d3b"); }
    else { var up = Math.sin(t * 16 + x * 0.1) > 0;
      R(x - 4, y, 8, 3, W); R(d > 0 ? x + 4 : x - 6, y - 1, 2, 2, W); R(d > 0 ? x + 6 : x - 8, y, 2, 1, "#ff9d3b");
      if (up) { R(x - 7, y - 3, 6, 2, G); R(x + 1, y - 3, 6, 2, G); R(x - 9, y - 5, 3, 2, G); R(x + 6, y - 5, 3, 2, G); } else { R(x - 7, y + 2, 6, 2, G); R(x + 1, y + 2, 6, 2, G); } }
  }
  function flyTo(g, dt, sp) { var dx = g.tx - g.x, dy = g.ty - g.y, d = Math.sqrt(dx * dx + dy * dy), st = sp * dt; if (Math.abs(dx) > 1) g.d = dx > 0 ? 1 : -1; if (d <= st) { g.x = g.tx; g.y = g.ty; return true; } g.x += dx / d * st; g.y += dy / d * st; return false; }
  function evGulls(t, C, force) {
    var tx = sandX(170, 500), ty = rnd(508, 522), n = 4 + Math.floor(rnd(0, 3.99)), gs = [];
    for (var i = 0; i < n; i++) gs.push({ x: tx + rnd(-320, 320), y: -12 - rnd(0, 80), tx: 0, ty: 0, st: "wait", at: rnd(1.5, 9), d: 1, next: 0, peck: 0 });
    actor({ zone: "sand", x: -16, y: WALK_Y, tx: tx, ty: ty, state: "in", stay: rnd(26, 46), gulls: gs, forced: force, nextThrow: 0, throwUntil: 0, crumbT: -9, cx: 0, cy: 0,
      step: function (a, t, dt) {
        var C = CTX, i, g, alive = 0;
        if (a.state === "in") { if (go(a, dt, a.tx, a.ty)) { a.state = "feed"; a.t0 = t; a.dir = a.tx < 330 ? 1 : -1; } }
        else if (a.state === "feed") {
          if (t - a.t0 > a.stay || C.closing || (!a.forced && (C.wet || C.L.d < 0.3))) { a.state = "out"; a.tOut = t; }
          else if (t > a.nextThrow) { a.nextThrow = t + rnd(1.4, 2.6); a.throwUntil = t + 0.45; a.cx = a.x + a.dir * rnd(22, 60); a.cy = a.y + rnd(-6, 8); a.crumbT = t; }
        } else if (!a.gone && go(a, dt, -26, WALK_Y)) a.gone = true;
        for (i = 0; i < a.gulls.length; i++) { g = a.gulls[i]; if (g.st === "done") continue; alive++;
          if (g.st === "wait") { if (a.state === "feed" && t - a.t0 > g.at) { g.st = "fly"; g.tx = a.x + a.dir * rnd(18, 66); g.ty = a.y + rnd(-8, 10); } else if (a.state === "out") g.st = "done"; }
          else if (g.st === "fly") { if (flyTo(g, dt, 90)) { g.st = "land"; g.next = t + rnd(0.3, 1); } }
          else if (g.st === "land") {
            if (a.state === "out" && t - a.tOut > g.at * 0.4) { g.st = "away"; g.tx = g.x + rnd(-260, 260); g.ty = -30; }
            else if (t > g.next) { g.next = t + rnd(0.5, 1.6); var mx = clamp(a.cx + rnd(-12, 12) - g.x, -9, 9); g.x += mx; g.y += clamp(a.cy + rnd(-6, 6) - g.y, -4, 4); if (Math.abs(mx) > 1) g.d = mx > 0 ? 1 : -1; g.peck = t + 0.35; } }
          else if (flyTo(g, dt, 110)) g.st = "done";
        }
        if (a.gone && !alive) return false;
      },
      draw: function (a, t) {
        var i, V = VARIANTS[a.v], d = a.dir;
        if (!a.gone) {
          if (a.state === "feed") { put(walkFrame(a.v, 0, d), a.x, a.y); R(a.x - d * 10 - 2, a.y - 26, 6, 8, "#c9a35a");                                   // paper bag in the other hand
            if (t < a.throwUntil) R(d > 0 ? a.x + 7 : a.x - 16, a.y - 44, 9, 4, V.skin); } else walker(a);
          var e = t - a.crumbT;
          if (e >= 0 && e < 0.45) { for (i = 0; i < 3; i++) { var k = e / 0.45, px = a.x + d * 12 + (a.cx - a.x - d * 12 + (i - 1) * 6) * k, py = a.y - 42 + (a.cy - a.y + 42) * k - Math.sin(k * Math.PI) * 14; R(px, py, 2, 2, "#f4e4b8"); } }
          else if (e < 2.2) for (i = 0; i < 3; i++) R(a.cx + (i - 1) * 6, a.cy + (i % 2) * 2, 2, 1, "#f4e4b8");
        }
        for (i = 0; i < a.gulls.length; i++) if (a.gulls[i].st !== "wait" && a.gulls[i].st !== "done") drawGull(a.gulls[i], t);
      } });
  }

  /* ---------- 9. weather and date extras: kite (wind), jogger (early), umbrella (rain), fireworks (fiestas), sea turtle (nesting season) ---------- */
  function evKite(t, C, force) {
    actor({ zone: "sand", x: -16, y: WALK_Y, tx: rnd(440, 480), ty: rnd(510, 522), state: "in", stay: rnd(45, 95), k: 0, forced: force, c1: pick(["#e8453c", "#ffd36b", "#ff9ad5"]), c2: pick(["#2bb3a9", "#5ea8ff", "#c4a2ff"]),
      step: function (a, t, dt) {
        var C = CTX;
        if (a.state === "in") { if (go(a, dt, a.tx, a.ty)) { a.state = "fly"; a.t0 = t; a.dir = 1; } }
        else if (a.state === "fly") { a.k = Math.min(1, a.k + dt / 5); if (t - a.t0 > a.stay || C.closing || (!a.forced && (C.wet || C.wind < 7))) a.state = "reel"; }
        else if (a.state === "reel") { a.k -= dt / 3; if (a.k <= 0) { a.k = 0; a.state = "out"; } }
        else if (go(a, dt, -26, WALK_Y)) return false;
      },
      draw: function (a, t) {
        if (a.state === "in" || a.state === "out") { walker(a); return; }
        put(walkFrame(a.v, 0, 1), a.x, a.y); R(a.x + 6, a.y - 47, 3, 10, VARIANTS[a.v].skin);
        var w = CTX ? CTX.windEff : 12, k = a.k, hx = a.x + 8, hy = a.y - 47, kx = hx + (58 + Math.sin(t * 0.5) * 11 + Math.min(18, w * 0.5)) * k, ky = hy - (258 + Math.sin(t * 0.83 + 1) * 9 + Math.sin(t * 2.7) * 2) * k, i, n = 36, sh = Math.ceil((hy - ky) / n) + 1;
        for (i = 1; i < n; i++) { var u = i / n; R(hx + (kx - hx) * u * u, hy + (ky - hy) * u, 1, sh, "rgba(255,255,255,0.65)"); }       // the line, bellied by the wind
        var ws = [2, 6, 10, 8, 6, 4, 2]; for (i = 0; i < 7; i++) R(kx - ws[i] / 2, ky - 6 + i * 2, ws[i], 2, i < 3 ? a.c1 : a.c2);
        for (i = 0; i < 5; i++) R(kx - 1 + Math.sin(t * 4 + i) * 2 - i, ky + 10 + i * 4, 2, 2, i % 2 ? a.c1 : a.c2);
      } });
  }
  function evCross(t, C, force, kind) {
    var d = Math.random() < 0.6 ? 1 : -1;
    actor({ zone: "path", mode: kind, x: d > 0 ? -16 : 976, y: rnd(512, 528), dir: d, sp: kind === "jog" ? 62 : (C.storm ? 58 : 36), c: pick(["#e8453c", "#2b2b33", "#ffd36b", "#5ea8ff"]),
      step: function (a, t, dt) { a.x += a.dir * a.sp * dt; a.walk += dt * a.sp / 4.4; return a.x > -30 && a.x < 990; },
      draw: function (a) {
        var f = Math.floor(a.walk) % 2; put(walkFrame(a.v, f, a.dir), a.x, a.y - (a.mode === "jog" ? f : 0));
        if (a.mode === "rain") { var ux = a.x + a.dir * 2, uy = a.y - 70; R(ux - 13, uy, 26, 3, a.c); R(ux - 10, uy - 3, 20, 3, a.c); R(ux - 6, uy - 5, 12, 2, a.c); R(ux, uy + 3, 1, 26, "#2b2b33"); }
      } });
  }
  var FWC = ["255,211,107", "255,94,122", "94,242,255", "155,255,138", "196,162,255", "255,157,59"];
  function evFireworks(t, C, force) {
    actor({ zone: "sky", layer: "glow", x: 0, y: 0, t0: t, dur: C.fiesta ? rnd(40, 70) : rnd(20, 34), next: t + 0.5, rockets: [], sparks: [], forced: force,
      step: function (a, t, dt) {
        var i, k, r, s, on = t - a.t0 < a.dur && (a.forced || !CTX.wet);
        if (on && t > a.next && a.sparks.length < 96) { a.next = t + rnd(0.7, 2.2); a.rockets.push({ x: rnd(60, 600), y: HOR_Y - 2, ty: rnd(46, 150), vy: -rnd(110, 140), c: pick(FWC) }); }
        for (i = a.rockets.length - 1; i >= 0; i--) { r = a.rockets[i]; r.y += r.vy * dt;
          if (r.y <= r.ty) { for (k = 0; k < 24; k++) { var an = k / 24 * 6.283, sp = k % 2 ? rnd(40, 58) : rnd(20, 30); a.sparks.push({ x: r.x, y: r.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: rnd(1.1, 1.7), c: k % 3 ? r.c : "255,255,255" }); } a.rockets.splice(i, 1); } }
        for (i = a.sparks.length - 1; i >= 0; i--) { s = a.sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 24 * dt; s.vx *= 1 - dt * 0.8; s.life -= dt; if (s.life <= 0) a.sparks.splice(i, 1); }
        if (!on && !a.rockets.length && !a.sparks.length) return false;
      },
      drawSky: function (a) {
        var i, r, s;
        for (i = 0; i < a.rockets.length; i++) { r = a.rockets[i]; R(r.x, r.y, 2, 3, "#fff2cc"); R(r.x, r.y + 3, 1, 5, "rgba(255,200,120,0.5)"); }
        for (i = 0; i < a.sparks.length; i++) { s = a.sparks[i]; var z = s.life > 0.8 ? 3 : 2; R(s.x, s.y, z, z, "rgba(" + s.c + "," + Math.min(1, s.life).toFixed(2) + ")"); R(s.x - s.vx * 0.06, s.y - s.vy * 0.06, 1, 1, "rgba(" + s.c + ",0.5)"); }
      } });
  }
  function evTurtle(t, C, force) {
    actor({ zone: "sand", x: rnd(44, 124), y: SHORE_Y + 3, ty: rnd(430, 446), state: "up", forced: force,
      step: function (a, t, dt) {
        if (a.state === "up") { if (go(a, dt, a.x, a.ty, 5)) { a.state = "nest"; a.t0 = t; } }
        else if (a.state === "nest") { if (t - a.t0 > 24) a.state = "down"; }
        else if (go(a, dt, a.x, SHORE_Y + 2, 6)) return false;
      },
      draw: function (a, t) {
        var x = a.x, y = a.y, f = a.state === "nest" ? Math.floor(t * 3) % 2 : Math.floor(t * 1.5) % 2, sk = "#7a9a6a";
        R(x - 2, a.state === "down" ? y : y - 13, 4, 4, sk); R(x - 9, y - 9 + f, 3, 4, sk); R(x + 6, y - 8 - f, 3, 4, sk); R(x - 8, y - 2 - f, 3, 2, sk); R(x + 5, y - 3 + f, 3, 2, sk);
        R(x - 6, y - 9, 12, 8, "#3f6b4a"); R(x - 4, y - 10, 8, 10, "#3f6b4a"); R(x - 3, y - 7, 2, 2, "#5f8f62"); R(x + 1, y - 5, 2, 2, "#5f8f62"); R(x - 2, y - 3, 2, 1, "#5f8f62");
        if (a.state === "nest") { R(x - 11 - f * 2, y, 2, 2, "#e4cf98"); R(x + 10 + f * 2, y - 1, 2, 2, "#e4cf98"); }
      } });
  }

  /* ---------- the director: what can happen now, and how likely ----------
     w(C) = weight in the current context (0 = cannot happen), cd = seconds before the same event may repeat. */
  var EVENTS = {
    hamaca:    { zone: "hammock", cd: 240, go: evHammock,  w: function (C) { return !C.closing && !C.wet && C.wind < 30 ? (C.day ? 1.3 : 0.7) : 0; } },
    fogata:    { zone: "fire",    cd: 300, go: evBonfire,  w: function (C) { return C.fire && !C.closing ? (C.weekend || C.fiesta ? 2.6 : 1.7) * (C.fullMoon ? 1.4 : 1) : 0; } },
    nadar:     { zone: "swim",    cd: 200, go: evSwim,     w: function (C) { return C.L.d > 0.45 && !C.wet && !C.storm && C.wind < 32 && !C.closing ? 1.4 * (C.temp >= 30 ? 1.6 : (C.temp < 24 ? 0.4 : 1)) * (C.weekend ? 1.4 : 1) : 0; } },
    chapuzon:  { zone: "swim",    cd: 900, go: function (t, C, f) { return evSwim(t, C, f, true); }, w: function (C) { return C.L.d > 0.6 && !C.wet && !C.storm && C.wind < 28 && C.h >= 10 && C.h < 17.5 ? (C.weekend || C.temp >= 30 ? 0.4 : 0.08) : 0; } },
    surf:      { zone: "surf",    cd: 150, go: evSurf,     w: function (C) { return C.L.d > 0.45 && !C.storm && C.rain < 0.5 && !C.closing ? 0.5 + (C.wind >= 14 ? 1.2 : 0) + (C.wind >= 22 ? 0.6 : 0) : 0; } },
    delfines:  { zone: "dolph",   cd: 400, go: evDolphins, w: function (C) { return C.L.d > 0.6 && !C.storm && C.rain < 0.3 && C.wind < 25 ? ((C.h >= 7 && C.h < 10) || (C.h >= 16 && C.h < 18) ? 1.5 : 0.9) : 0; } },
    pareja:    { zone: "sand",    cd: 180, go: function (t, C, f) { return evMeet(t, C, f, true); }, w: function (C) { return !C.wet && !C.closing ? 0.8 * (C.love ? 4 : 1) * (C.L.tw > 0.3 ? 1.8 : 1) * (C.fullMoon && C.night ? 1.6 : 1) : 0; } },
    platica:   { zone: "sand",    cd: 150, go: function (t, C, f) { return evMeet(t, C, f, false); }, w: function (C) { return !C.wet && !C.closing ? 0.9 : 0; } },
    pelea:     { zone: "bar",     cd: 600, go: evFight,    w: function (C) { return C.closing ? 0 : ((C.h >= 20 || C.h < 3) ? 0.5 : (C.h >= 14 ? 0.12 : 0)) * (C.weekend ? 1.8 : 1); } },
    gaviotas:  { zone: "sand",    cd: 220, go: evGulls,    w: function (C) { return C.L.d > 0.5 && !C.wet && C.wind < 28 ? 1.1 : 0; } },
    papalote:  { zone: "sand",    cd: 300, go: evKite,     w: function (C) { return C.L.d > 0.5 && !C.wet && C.wind >= 12 && C.wind < 34 ? 1.3 : 0; } },
    corredor:  { zone: "path",    cd: 120, go: function (t, C, f) { return evCross(t, C, f, "jog"); }, w: function (C) { return C.wet || C.closing ? 0 : (C.h >= 6.3 && C.h < 9.5 ? 1.5 : (C.h >= 17 && C.h < 19 ? 0.8 : 0)); } },
    paraguas:  { zone: "path",    cd: 50,  go: function (t, C, f) { return evCross(t, C, f, "rain"); }, w: function (C) { return C.rain > 0.2 && !C.closing ? 2.5 : 0; } },
    fuegos:    { zone: "sky",     cd: 420, go: evFireworks, w: function (C) { return C.night && C.rain < 0.2 ? (C.fiesta && (C.h >= 20 || C.h < 1.5) ? 6 : (C.sat && C.h >= 20.5 && C.h < 23.5 ? 0.3 : 0)) : 0; } },
    tortuga:   { zone: "sand",    cd: 900, go: evTurtle,   w: function (C) { return C.night && !C.wet && C.month >= 5 && C.month <= 10 && (C.h >= 21 || C.h < 4.5) ? 0.9 : 0; } }
  };
  var EXCL = { hammock: 1, fire: 1, bar: 1 };                // zones where a forced event must still wait for the current one
  function run(name, t, C, force) {
    var E = EVENTS[name]; if (!E || (force && EXCL[E.zone] && busy(E.zone))) return false;
    if (E.go(t, C, force) === false) return false;
    lastRun[name] = t; lastEvent = name; return true;
  }
  function director(t, C) {
    while (pending.length) run(pending.shift(), t, C, true);
    if (t < nextEvent) return;
    nextEvent = t + rnd(22, 60) * (C.weekend || C.fiesta ? 0.7 : 1);
    var names = [], ws = [], sum = 0, k, i;
    for (k in EVENTS) { var E = EVENTS[k], w = (lastRun[k] != null && t - lastRun[k] < E.cd) || busy(E.zone) ? 0 : E.w(C); if (w > 0) { names.push(k); ws.push(w); sum += w; } }
    if (!sum) return;
    var r = Math.random() * sum; for (i = 0; i < names.length; i++) { r -= ws[i]; if (r <= 0) { run(names[i], t, C, false); return; } }
  }
  function drawLayer(layer, t, L) {
    var n = 0; for (var i = 0; i < agents.length; i++) { var a = agents[i]; if (a.layer !== layer) continue; n++; if (layer === "sea") a.drawSea(a, t, L); else a.drawSky(a, t, L); }     // "glow" = bright things painted after the night tint (fireworks)
    return n;
  }
  function drawSea(t, L) {
    var n = drawLayer("sea", t, L) + splashes.length; drawSplashes(t);
    if (n && L.d < 0.97) { var g = P.ctx(); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(18,28,72," + (0.7 * (1 - L.d)).toFixed(3) + ")"; g.fillRect(0, 262, 960, 136); g.globalCompositeOperation = "source-over"; }   // same dusk tint the sand gets
  }

  global.Ambient = {
    init: function (painter) { P = painter; R = P.R; },
    /* called every frame from sprites.js at the right z positions */
    sky: function (t, L) { if (pelican.t >= 0) drawPelican(t, L); },
    glow: function (t, L) { drawLayer("glow", t, L); },         // after the lighting pass: fireworks keep their colour at night
    horizon: function (t, L) { schedule(t, L); drawSea(t, L); if (ferry.t >= 0) drawFerry(t, L); if (boat.t >= 0) drawBoat(t, L); },
    sand: function (t, dt, S, L, fireLit) { fireOn = fireLit; if (crab.t >= 0) drawCrab(t); updFlies(t, dt, L); var grillOn = drawGrill(S); updSmoke(t, dt, L, S, fireLit, grillOn); updDebris(t, dt, S); },
    front: function (t, dt, S, L) { updateAgents(t, dt, S, L); director(t, CTX); drawAgents(t, L); },
    /* the hammock guest, painted by sprites.js right behind / in front of the cloth; boost = extra swing while occupied */
    hammockBack: function (t, swing, G) { hammockGuest(t, swing, G, false); },
    hammockFront: function (t, swing, G) { hammockGuest(t, swing, G, true); },
    hammockBoost: function () { return hamGuest && hamGuest.state === "lie" ? (hamGuest.pose ? 1.4 : 2.4) : 0; },
    /* beach-life events: names, fire one now (dev overlay / ?event=), last one that ran */
    events: function () { var n = []; for (var k in EVENTS) n.push(k); return n; },
    trigger: function (name) { if (EVENTS[name]) pending.push(name); },
    last: function () { return lastEvent; },
    /* pre-simulate `sec` seconds (t from -sec to 0) so patrons are already seated in a fresh render (?warm=120) */
    warm: function (sec, S, L) { nextArrival = -sec + 3; nextSpecial = -sec + 20; fireOn = L.lightsOn > 0.05 && !(S.weather && S.weather.rain >= 0.3); for (var t = -sec; t < 0; t += 0.1) { updateAgents(t, 0.1, S, L); while (pending.length) run(pending.shift(), t, CTX, true); } },
    count: function () { return agents.length; }
  };
})(window);
