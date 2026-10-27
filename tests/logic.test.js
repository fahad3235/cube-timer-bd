"use strict";
// Unit tests for js/logic.js - run with: node --test tests/logic.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/logic.js");

describe("genScramble", function () {
  it("produces 20 moves of valid face+suffix", function () {
    const s = L.genScramble();
    assert.equal(s.length, 20);
    for (const m of s) {
      assert.ok(L.FACES.includes(m.face), m.face);
      assert.ok(L.SUFFIXES.includes(m.suffix), m.suffix);
    }
  });
  it("never repeats a face consecutively and never A-B-A, over 200 scrambles", function () {
    for (let i = 0; i < 200; i++) {
      const s = L.genScramble();
      for (let j = 1; j < s.length; j++) {
        assert.notEqual(s[j].face, s[j - 1].face, "consecutive repeat at " + j);
      }
      for (let j = 2; j < s.length; j++) {
        assert.notEqual(s[j].face, s[j - 2].face, "A-B-A pattern at " + j);
      }
    }
  });
  it("scrambleToString joins with single spaces", function () {
    assert.equal(L.scrambleToString([{ face: "R", suffix: "" }, { face: "U", suffix: "'" }]), "R U'");
  });
});

describe("formatTime", function () {
  it("formats sub-minute times", function () {
    assert.equal(L.formatTime(0), "0.00");
    assert.equal(L.formatTime(1234), "12.34");
    assert.equal(L.formatTime(5999), "59.99");
  });
  it("formats minute times with zero-padded seconds", function () {
    assert.equal(L.formatTime(6000), "1:00.00");
    assert.equal(L.formatTime(6123), "1:01.23");
    assert.equal(L.formatTime(359999), "59:59.99");
  });
  it("returns placeholder for invalid input", function () {
    assert.equal(L.formatTime(-5), "--");
    assert.equal(L.formatTime(NaN), "--");
  });
});

describe("parseTime", function () {
  it("parses plain seconds and hundredths", function () {
    assert.equal(L.parseTime("12.34"), 1234);
    assert.equal(L.parseTime("12"), 1200);
    assert.equal(L.parseTime("12.3"), 1230);
    assert.equal(L.parseTime("90"), 9000);
  });
  it("parses minute:second forms", function () {
    assert.equal(L.parseTime("1:01.23"), 6123);
    assert.equal(L.parseTime("1:01"), 6100);
    assert.equal(L.parseTime("0:05.50"), 550);
  });
  it("rejects invalid input", function () {
    for (const bad of ["", "abc", "1:60", "1:60.00", "-5", "12.345", "1:2", "0", "0.00", "1:02:03", "  ", "12..34"]) {
      assert.equal(L.parseTime(bad), null, JSON.stringify(bad));
    }
  });
});

describe("trimmedMean and averageOf", function () {
  it("trims best and worst", function () {
    assert.equal(L.trimmedMean([100, 200, 300]), 200);
    assert.equal(L.trimmedMean([100, 200, 300, 400, 500]), 300);
    assert.equal(L.trimmedMean([100, 200]), null);
  });
  it("Ao5 hand-verified: [1000,1200,1100,1300,900] -> 1100", function () {
    const solves = [1000, 1200, 1100, 1300, 900].map((cs) => ({ cs, penalty: "", scramble: "X", ts: 1 }));
    assert.equal(L.averageOf(solves, 5), 1100);
  });
  it("Ao5 uses only the last 5 solves", function () {
    const solves = [9999, 1000, 1200, 1100, 1300, 900].map((cs) => ({ cs, penalty: "", scramble: "X", ts: 1 }));
    assert.equal(L.averageOf(solves, 5), 1100);
  });
  it("Ao5 is null with fewer than 5 or with a DNF in the window", function () {
    const few = [1000, 1200].map((cs) => ({ cs, penalty: "", scramble: "X", ts: 1 }));
    assert.equal(L.averageOf(few, 5), null);
    const dnf = [1000, 1200, 1100, 1300, 900].map((cs, i) => ({ cs, penalty: i === 2 ? "DNF" : "", scramble: "X", ts: 1 }));
    assert.equal(L.averageOf(dnf, 5), null);
  });
});

describe("computeStats", function () {
  it("applies +2 and excludes DNF, hand-verified", function () {
    const solves = [
      { cs: 1000, penalty: "", scramble: "A", ts: 1 },
      { cs: 1200, penalty: "+2", scramble: "B", ts: 2 },
      { cs: 900, penalty: "", scramble: "C", ts: 3 },
      { cs: 5000, penalty: "DNF", scramble: "D", ts: 4 }
    ];
    const s = L.computeStats(solves);
    assert.equal(s.count, 4);
    assert.equal(s.completed, 3);
    assert.equal(s.best, 900);
    assert.equal(s.worst, 1400);
    assert.equal(s.mean, 1100);
  });
  it("empty list yields nulls", function () {
    const s = L.computeStats([]);
    assert.equal(s.count, 0);
    assert.equal(s.best, null);
    assert.equal(s.ao5, null);
    assert.equal(s.ao12, null);
  });
});

describe("validateImport", function () {
  const good = { solves: [{ cs: 1234, penalty: "", scramble: "R U'", ts: 1700000000000 }] };
  it("accepts a valid file", function () {
    const v = L.validateImport(good);
    assert.equal(v.ok, true);
    assert.equal(v.solves.length, 1);
  });
  it("rejects malformed files", function () {
    const bads = [
      null, [], "x", {}, { solves: "no" },
      { solves: [{ cs: 0, penalty: "", scramble: "R", ts: 1 }] },
      { solves: [{ cs: -5, penalty: "", scramble: "R", ts: 1 }] },
      { solves: [{ cs: 12.5, penalty: "", scramble: "R", ts: 1 }] },
      { solves: [{ cs: 1234, penalty: "XX", scramble: "R", ts: 1 }] },
      { solves: [{ cs: 1234, penalty: "", scramble: 42, ts: 1 }] },
      { solves: [{ cs: 1234, penalty: "", scramble: "R", ts: -1 }] },
      { solves: [{ cs: 1234, penalty: "", scramble: "R" }] }
    ];
    for (const b of bads) assert.equal(L.validateImport(b).ok, false, JSON.stringify(b));
  });
});

describe("toBnDigits", function () {
  it("maps ASCII digits to Bengali digits", function () {
    assert.equal(L.toBnDigits("12.34"), "\u09e7\u09e8.\u09e9\u09ea");
    assert.equal(L.toBnDigits("1:01.23"), "\u09e7:\u09e6\u09e7.\u09e8\u09e9");
  });
});
