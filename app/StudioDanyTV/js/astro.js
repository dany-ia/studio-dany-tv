/* astro.js — real astronomy for the scene, on top of SunCalc (vendored, MIT).
   For the bar's coordinates it gives, for any Date:
   - sun: altitude/azimuth, the day's times (dawn, sunrise, golden hour, sunset, dusk, night);
   - moon: altitude/azimuth, illuminated fraction, phase, the orientation of the bright limb as
     seen from the beach (bright-limb angle minus parallactic angle), rise/set times;
   - a screen mapping. The painting faces south: east (sunrise) is on the left, west (sunset) on
     the right. Azimuth is compressed horizontally so the whole arc fits the composition, altitude
     is linear in degrees. Timing, altitude, phase and orientation are real; the horizontal scale is art.
   Everything is cached per second (the TV calls this every frame). */
(function (global) {
  "use strict";
  var LAT = 20.63, LON = -87.07, DEG = 180 / Math.PI;
  var X_LEFT = 0.08, X_RIGHT = 0.70, HOR = 0.46, Y_SPAN = 0.54;      // uv (y up): horizon at 0.46, zenith maps to HOR + Y_SPAN
  var cacheKey = "", cache = null;

  function screen(az, alt) {   // az: SunCalc azimuth (0 = south, -pi/2 = east, +pi/2 = west); alt in radians
    var k = (az + Math.PI * 0.75) / (Math.PI * 1.5);                   // 0 at ENE/NE (-135 deg) .. 1 at WNW/NW (+135 deg): a 270-degree window compressed into the frame
    return { x: X_LEFT + k * (X_RIGHT - X_LEFT), y: HOR + (alt / (Math.PI / 2)) * Y_SPAN, onScreen: k > -0.15 && k < 1.15 };
  }
  var PHASES = ["luna nueva", "luna creciente", "cuarto creciente", "gibosa creciente", "luna llena", "gibosa menguante", "cuarto menguante", "luna menguante"];
  function phaseName(phase) {   // SunCalc phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter
    var p = phase % 1; if (p < 0.03 || p > 0.97) return PHASES[0]; if (p < 0.22) return PHASES[1]; if (p < 0.28) return PHASES[2]; if (p < 0.47) return PHASES[3];
    if (p < 0.53) return PHASES[4]; if (p < 0.72) return PHASES[5]; if (p < 0.78) return PHASES[6]; return PHASES[7];
  }
  function hm(d) { return d ? (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() : "—"; }
  function hours(d) { return d ? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 : -1; }

  function compute(date) {
    var S = global.SunCalc, sp = S.getPosition(date, LAT, LON), mp = S.getMoonPosition(date, LAT, LON), mi = S.getMoonIllumination(date);
    var times = S.getTimes(date, LAT, LON);
    var midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0), mt = S.getMoonTimes(midnight, LAT, LON);
    var sun = screen(sp.azimuth, sp.altitude), moon = screen(mp.azimuth, mp.altitude);
    var elev = Math.sin(sp.altitude);                                   // -1..1, crosses 0 at sunrise/sunset
    var ss = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    var d = ss(-0.10, 0.28, elev), tw = Math.exp(-Math.pow(elev / 0.16, 2));
    var sunUp = ss(-0.06, 0.02, elev);                                   // disc/glow visible from a little below the horizon
    var moonUp = ss(-0.02, 0.06, Math.sin(mp.altitude)) * (moon.onScreen ? 1 : 0);
    // bright-limb direction on screen: angle from "up", positive toward east = screen left (we face south)
    var chi = mi.angle - mp.parallacticAngle;
    var dir = { x: -Math.sin(chi), y: Math.cos(chi) };
    var night = ss(0.03, -0.10, elev);
    return {
      date: date, sunAlt: sp.altitude * DEG, sunAz: sp.azimuth * DEG, moonAlt: mp.altitude * DEG, moonAz: mp.azimuth * DEG,
      sun: sun, moon: moon, elev: elev, d: d, tw: tw, sunUp: sunUp, moonUp: moonUp, night: night,
      moonFrac: mi.fraction, moonPhase: mi.phase, moonDir: dir, moonBright: mi.fraction * moonUp,
      phaseName: phaseName(mi.phase), illumPct: Math.round(mi.fraction * 100), moonAge: mi.phase * 29.530588853,
      lightsOn: ss(0.08, -0.02, elev), isDay: sp.altitude > 0,
      times: { dawn: times.dawn, sunrise: times.sunrise, goldenHourEnd: times.goldenHourEnd, goldenHour: times.goldenHour, sunset: times.sunset, dusk: times.dusk, night: times.night, nightEnd: times.nightEnd },
      sunriseH: hours(times.sunrise), sunsetH: hours(times.sunset),
      moonrise: mt.rise ? hm(mt.rise) : (mt.alwaysUp ? "siempre" : "—"), moonset: mt.set ? hm(mt.set) : (mt.alwaysDown ? "nunca" : "—"),
      hm: hm
    };
  }

  global.Astro = {
    at: function (date) {
      var key = Math.floor(date.getTime() / 1000);
      if (key !== cacheKey) { cache = compute(date); cacheKey = key; }
      return cache;
    },
    phaseName: phaseName
  };
})(window);
