"use strict";
// Cube Timer BD - DOM app. Depends on window.CubeLogic and window.CUBE_I18N.
(function () {
  var L = window.CubeLogic;
  var I18N = window.CUBE_I18N;
  var STORE_KEY = "cube-timer-bd-v1";
  var ARM_MS = 300;

  var state = {
    lang: "en",
    solves: [],
    scramble: "",
    timer: "idle", // idle | arming | ready | running
    t0: 0,
    tick: null,
    armTimer: null
  };

  function $(id) { return document.getElementById(id); }

  function dict() { return I18N[state.lang]; }
  function fmtNum(n) {
    var s = String(n);
    return state.lang === "bn" ? L.toBnDigits(s) : s;
  }
  function fmtTime(cs) {
    if (cs === null || cs === undefined) return "—";
    var s = L.formatTime(Math.round(cs));
    return state.lang === "bn" ? L.toBnDigits(s) : s;
  }

  function applyLang() {
    var d = dict();
    document.documentElement.lang = state.lang;
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute("data-i18n");
      if (d[key] !== undefined) els[i].textContent = d[key];
    }
    var inputs = document.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < inputs.length; j++) {
      var k = inputs[j].getAttribute("data-i18n-placeholder");
      if (d[k] !== undefined) inputs[j].placeholder = d[k];
    }
    $("langBtn").textContent = d.langName;
    renderTimerStatus();
    renderStats();
    renderHistory();
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ lang: state.lang, solves: state.solves }));
    } catch (e) { /* storage unavailable: app still works for the session */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && (data.lang === "en" || data.lang === "bn")) state.lang = data.lang;
      var v = L.validateImport({ solves: data ? data.solves : null });
      if (v.ok) state.solves = v.solves;
    } catch (e) { /* corrupt storage: start fresh */ }
  }

  function newScramble() {
    state.scramble = L.scrambleToString(L.genScramble());
    $("scrambleText").textContent = state.scramble;
  }

  function renderTimerStatus() {
    var d = dict();
    var card = $("timerCard");
    card.classList.remove("arming", "ready", "running");
    var status = $("timerStatus");
    if (state.timer === "arming") { card.classList.add("arming"); status.textContent = d.ready; }
    else if (state.timer === "ready") { card.classList.add("ready"); status.textContent = d.ready; }
    else if (state.timer === "running") { card.classList.add("running"); status.textContent = d.running; }
    else { status.textContent = d.timerHint; }
  }

  function showTime(cs) {
    $("timeDisplay").textContent = fmtTime(cs);
  }

  function startTimer() {
    if (state.timer === "running") return;
    clearTimers();
    state.timer = "running";
    state.t0 = performance.now();
    state.tick = setInterval(function () {
      showTime((performance.now() - state.t0) / 10);
    }, 33);
    renderTimerStatus();
  }

  function stopTimer() {
    if (state.timer !== "running") return null;
    var cs = Math.round((performance.now() - state.t0) / 10);
    clearTimers();
    state.timer = "idle";
    showTime(cs);
    renderTimerStatus();
    return cs;
  }

  function clearTimers() {
    if (state.tick) { clearInterval(state.tick); state.tick = null; }
    if (state.armTimer) { clearTimeout(state.armTimer); state.armTimer = null; }
  }

  function recordSolve(cs) {
    if (cs === null || cs <= 0) return;
    state.solves.push({ cs: cs, penalty: "", scramble: state.scramble, ts: Date.now() });
    save();
    renderStats();
    renderHistory();
    newScramble();
  }

  function renderStats() {
    var s = L.computeStats(state.solves);
    $("statCount").textContent = fmtNum(s.count);
    $("statBest").textContent = fmtTime(s.best);
    $("statWorst").textContent = fmtTime(s.worst);
    $("statMean").textContent = fmtTime(s.mean);
    $("statAo5").textContent = fmtTime(s.ao5);
    $("statAo12").textContent = fmtTime(s.ao12);
  }

  function renderHistory() {
    var d = dict();
    var list = $("historyList");
    list.innerHTML = "";
    $("emptyHistory").hidden = state.solves.length !== 0;
    // Newest first; index shown is the chronological solve number.
    for (var idx = state.solves.length - 1; idx >= 0; idx--) {
      (function (i) {
        var s = state.solves[i];
        var li = document.createElement("li");
        var num = document.createElement("span");
        num.className = "idx";
        num.textContent = "#" + fmtNum(i + 1);
        var time = document.createElement("span");
        time.className = "htime";
        var eff = L.effectiveCs(s);
        time.textContent = s.penalty === "DNF" ? "DNF" : fmtTime(eff);
        var sel = document.createElement("select");
        sel.setAttribute("aria-label", d.penalty);
        sel.dataset.solveIndex = String(i);
        var opts = [["", d.penNone], ["+2", d.penPlus2], ["DNF", d.penDnf]];
        for (var o = 0; o < opts.length; o++) {
          var opt = document.createElement("option");
          opt.value = opts[o][0];
          opt.textContent = opts[o][1];
          if (opts[o][0] === s.penalty) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener("change", function () {
          state.solves[i].penalty = sel.value;
          save(); renderStats(); renderHistory();
        });
        var del = document.createElement("button");
        del.type = "button";
        del.className = "del";
        del.textContent = d.delete;
        del.addEventListener("click", function () {
          state.solves.splice(i, 1);
          save(); renderStats(); renderHistory();
        });
        var scr = document.createElement("span");
        scr.className = "hscr";
        scr.textContent = s.scramble;
        li.appendChild(num);
        li.appendChild(time);
        li.appendChild(sel);
        li.appendChild(del);
        li.appendChild(scr);
        list.appendChild(li);
      })(idx);
    }
  }

  function showMsg(text, bad) {
    var el = $("importMsg");
    el.textContent = text;
    el.classList.toggle("bad", !!bad);
    el.hidden = false;
  }

  function init() {
    load();
    if (!state.scramble) newScramble();
    else $("scrambleText").textContent = state.scramble;

    $("langBtn").addEventListener("click", function (e) {
      state.lang = state.lang === "en" ? "bn" : "en";
      save();
      applyLang();
      e.currentTarget.blur();
    });
    $("newScrambleBtn").addEventListener("click", function (e) {
      newScramble();
      e.currentTarget.blur();
    });
    $("startBtn").addEventListener("click", function (e) {
      startTimer();
      e.currentTarget.blur();
    });
    $("stopBtn").addEventListener("click", function (e) {
      var cs = stopTimer();
      if (cs !== null) recordSolve(cs);
      e.currentTarget.blur();
    });
    $("addManualBtn").addEventListener("click", function (e) {
      var d = dict();
      var cs = L.parseTime($("manualInput").value);
      if (cs === null) {
        $("manualError").textContent = d.invalidTime;
        $("manualError").hidden = false;
      } else {
        $("manualError").hidden = true;
        $("manualInput").value = "";
        recordSolve(cs);
      }
      e.currentTarget.blur();
    });
    $("exportBtn").addEventListener("click", function (e) {
      var blob = new Blob([JSON.stringify({ app: "cube-timer-bd", solves: state.solves }, null, 2)],
        { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cube-timer-bd.json";
      a.click();
      URL.revokeObjectURL(a.href);
      e.currentTarget.blur();
    });
    $("importFile").addEventListener("change", function () {
      var d = dict();
      var file = $("importFile").files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var v = L.validateImport(JSON.parse(reader.result));
          if (!v.ok) { showMsg(d.importBad, true); return; }
          state.solves = v.solves;
          save(); renderStats(); renderHistory();
          showMsg(d.importOk, false);
        } catch (err) {
          showMsg(d.importBad, true);
        }
      };
      reader.readAsText(file);
      $("importFile").value = "";
    });
    $("clearBtn").addEventListener("click", function (e) {
      if (window.confirm(dict().clearConfirm)) {
        state.solves = [];
        save(); renderStats(); renderHistory();
      }
      e.currentTarget.blur();
    });

    // Spacebar timer: hold to arm, release to start, press again to stop.
    document.addEventListener("keydown", function (e) {
      if (e.code !== "Space") return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.tagName === "BUTTON")) return;
      if (e.repeat) return;
      e.preventDefault();
      if (state.timer === "running") {
        var cs = stopTimer();
        if (cs !== null) recordSolve(cs);
        return;
      }
      if (state.timer === "idle") {
        state.timer = "arming";
        renderTimerStatus();
        state.armTimer = setTimeout(function () {
          if (state.timer === "arming") {
            state.timer = "ready";
            renderTimerStatus();
          }
        }, ARM_MS);
      }
    });
    document.addEventListener("keyup", function (e) {
      if (e.code !== "Space") return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.tagName === "BUTTON")) return;
      if (state.timer === "ready") startTimer();
      else if (state.timer === "arming") {
        clearTimers();
        state.timer = "idle";
        renderTimerStatus();
      }
    });

    applyLang();
    showTime(0);
  }

  // Test hooks (used by tests/smoke.js only).
  window.__cube = {
    getState: function () { return state.timer; },
    getSolves: function () { return state.solves.map(function (s) { return { cs: s.cs, penalty: s.penalty }; }); },
    getScramble: function () { return state.scramble; },
    getLang: function () { return state.lang; },
    startTimer: startTimer,
    stopAndRecord: function () { var cs = stopTimer(); if (cs !== null) recordSolve(cs); return cs; },
    addManual: function (text) {
      var cs = L.parseTime(text);
      if (cs === null) return false;
      recordSolve(cs);
      return true;
    },
    setPenalty: function (index, penalty) {
      if (!state.solves[index]) return false;
      state.solves[index].penalty = penalty;
      save(); renderStats(); renderHistory();
      return true;
    },
    clearAllDirect: function () {
      state.solves = [];
      save(); renderStats(); renderHistory();
    },
    newScramble: newScramble
  };

  document.addEventListener("DOMContentLoaded", init);
})();
