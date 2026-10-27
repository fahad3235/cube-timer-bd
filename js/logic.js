"use strict";
// Cube Timer BD - pure logic (no DOM). Usable from the browser and from Node tests.
// Scramble rules: 20 moves, faces U D R L F B, suffixes '', "'", '2'.
// No two consecutive moves share a face, and no A-B-A face pattern
// (e.g. R L R) - both are redundant in a real scramble.
var FACES = ["U", "D", "R", "L", "F", "B"];
var SUFFIXES = ["", "'", "2"];
var SCRAMBLE_LEN = 20;

function genScramble(rng) {
  var rand = rng || function (max) { return Math.floor(Math.random() * max); };
  var moves = [];
  while (moves.length < SCRAMBLE_LEN) {
    var face = FACES[rand(FACES.length)];
    var prev = moves.length ? moves[moves.length - 1].face : null;
    var prev2 = moves.length > 1 ? moves[moves.length - 2].face : null;
    if (face === prev) continue;
    if (face === prev2) continue;
    moves.push({ face: face, suffix: SUFFIXES[rand(SUFFIXES.length)] });
  }
  return moves;
}

function scrambleToString(moves) {
  return moves.map(function (m) { return m.face + m.suffix; }).join(" ");
}

// Format integer centiseconds. 1234 -> "12.34", 6123 -> "1:01.23".
function formatTime(cs) {
  if (typeof cs !== "number" || !isFinite(cs) || cs < 0) return "--";
  var total = Math.floor(cs);
  var hundredths = total % 100;
  var secs = Math.floor(total / 100);
  var hh = hundredths < 10 ? "0" + hundredths : String(hundredths);
  if (secs < 60) {
    return secs + "." + hh;
  }
  var mins = Math.floor(secs / 60);
  var rem = secs % 60;
  return mins + ":" + (rem < 10 ? "0" + rem : rem) + "." + hh;
}

// Parse "12.34", "1:01.23", "12", "1:01" -> centiseconds, or null if invalid.
function parseTime(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!s) return null;
  var m = /^(\d+)(?::([0-5]\d))?(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  var mins = m[2] !== undefined ? parseInt(m[1], 10) : 0;
  var secs = m[2] !== undefined ? parseInt(m[2], 10) : parseInt(m[1], 10);
  var hund = m[3] !== undefined ? parseInt((m[3] + "0").slice(0, 2), 10) : 0;
  if (m[2] === undefined && secs >= 60 && mins === 0 && m[1].length > 0) {
    // Bare "90" means 90 seconds = 1:30, allowed: treat as seconds.
    // (No special-casing needed; secs already holds it.)
  }
  if (m[2] !== undefined && mins > 59) return null;
  var cs = (mins * 60 + secs) * 100 + hund;
  if (cs <= 0 || cs > 360000) return null;
  return cs;
}

// Effective time: +2 penalty adds 200cs; DNF handled by callers (null).
function effectiveCs(solve) {
  if (!solve || solve.penalty === "DNF") return null;
  var base = solve.cs;
  if (typeof base !== "number" || base < 0) return null;
  return solve.penalty === "+2" ? base + 200 : base;
}

// Trimmed mean: drop best and worst, average the rest. Null if < 3 values.
function trimmedMean(values) {
  if (!Array.isArray(values) || values.length < 3) return null;
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var core = sorted.slice(1, sorted.length - 1);
  var sum = 0;
  for (var i = 0; i < core.length; i++) sum += core[i];
  return sum / core.length;
}

// Average of the last n solves (chronological order). Null when fewer
// than n solves, or when any solve in the window is DNF.
function averageOf(solves, n) {
  if (!Array.isArray(solves) || solves.length < n) return null;
  var window = solves.slice(solves.length - n);
  var eff = [];
  for (var i = 0; i < window.length; i++) {
    var e = effectiveCs(window[i]);
    if (e === null) return null;
    eff.push(e);
  }
  return trimmedMean(eff);
}

function computeStats(solves) {
  var list = Array.isArray(solves) ? solves : [];
  var eff = [];
  for (var i = 0; i < list.length; i++) {
    var e = effectiveCs(list[i]);
    if (e !== null) eff.push(e);
  }
  var best = eff.length ? Math.min.apply(null, eff) : null;
  var worst = eff.length ? Math.max.apply(null, eff) : null;
  var mean = null;
  if (eff.length) {
    var sum = 0;
    for (var j = 0; j < eff.length; j++) sum += eff[j];
    mean = sum / eff.length;
  }
  return {
    count: list.length,
    completed: eff.length,
    best: best,
    worst: worst,
    mean: mean,
    ao5: averageOf(list, 5),
    ao12: averageOf(list, 12)
  };
}

// Strict import validation. Returns { ok: true, solves } or { ok: false, error }.
function validateImport(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "not-an-object" };
  }
  if (!Array.isArray(data.solves)) return { ok: false, error: "solves-not-array" };
  if (data.solves.length > 5000) return { ok: false, error: "too-many" };
  var out = [];
  for (var i = 0; i < data.solves.length; i++) {
    var s = data.solves[i];
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      return { ok: false, error: "solve-not-object" };
    }
    if (typeof s.cs !== "number" || !isFinite(s.cs) ||
        Math.floor(s.cs) !== s.cs || s.cs <= 0 || s.cs > 360000) {
      return { ok: false, error: "bad-cs" };
    }
    if (s.penalty !== "" && s.penalty !== "+2" && s.penalty !== "DNF") {
      return { ok: false, error: "bad-penalty" };
    }
    if (typeof s.scramble !== "string" || s.scramble.length > 300) {
      return { ok: false, error: "bad-scramble" };
    }
    if (typeof s.ts !== "number" || !isFinite(s.ts) || s.ts <= 0) {
      return { ok: false, error: "bad-ts" };
    }
    out.push({ cs: s.cs, penalty: s.penalty, scramble: s.scramble, ts: s.ts });
  }
  return { ok: true, solves: out };
}

var BN_DIGITS = ["\u09e6", "\u09e7", "\u09e8", "\u09e9", "\u09ea",
                 "\u09eb", "\u09ec", "\u09ed", "\u09ee", "\u09ef"];
function toBnDigits(str) {
  return String(str).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FACES: FACES, SUFFIXES: SUFFIXES, SCRAMBLE_LEN: SCRAMBLE_LEN,
    genScramble: genScramble, scrambleToString: scrambleToString,
    formatTime: formatTime, parseTime: parseTime, effectiveCs: effectiveCs,
    trimmedMean: trimmedMean, averageOf: averageOf,
    computeStats: computeStats, validateImport: validateImport,
    toBnDigits: toBnDigits
  };
} else if (typeof window !== "undefined") {
  window.CubeLogic = {
    FACES: FACES, SUFFIXES: SUFFIXES, SCRAMBLE_LEN: SCRAMBLE_LEN,
    genScramble: genScramble, scrambleToString: scrambleToString,
    formatTime: formatTime, parseTime: parseTime, effectiveCs: effectiveCs,
    trimmedMean: trimmedMean, averageOf: averageOf,
    computeStats: computeStats, validateImport: validateImport,
    toBnDigits: toBnDigits
  };
}
