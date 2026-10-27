# Cube Timer BD

An offline, bilingual (English/Bangla) 3x3 speedcubing timer. Generate a fresh
20-move scramble, time your solve with a hold-to-start spacebar timer (or the
on-screen buttons), and track best, mean, Ao5 and Ao12 averages — all on your
device, with no account and no network requests.

## Features

- **3x3 scramble generator** — 20 moves over faces U/D/R/L/F/B with `'`
  and `2` suffixes. No consecutive same-face moves and no A-B-A face patterns
  (both are redundant in a real scramble). A new scramble is issued
  automatically after every recorded solve.
- **Precision timer** — centisecond display. Hold SPACE to arm (300 ms),
  release to start, press SPACE again to stop. Start/Stop buttons work the
  same way for mouse and touch users.
- **Statistics** — solve count, best, worst, mean, Ao5 and Ao12. Averages
  use the trimmed mean (drop best and worst) over the last 5 / 12 solves.
  An average is blank when there are too few solves or a DNF sits inside
  the window.
- **Penalties** — mark any solve None, +2 seconds, or DNF from its history
  row; all statistics recompute immediately.
- **Manual entry** — add a time by hand (`12.34`, `1:01.23`, `90`) with
  strict validation and an inline error for bad input.
- **History** — newest-first list with scramble, per-solve delete, and
  clear-all (with confirmation). Everything persists in localStorage.
- **JSON export / import** — download your solves, restore them later.
  Imports are strictly validated; a malformed file is rejected and your
  existing data is left untouched.
- **Bilingual UI** — English/Bangla toggle, persisted, with Bengali digits
  in Bangla mode. Fully responsive down to 390 px wide.

## Stack

Vanilla HTML, CSS and JavaScript. No frameworks, no build step, no
dependencies at runtime. Tests use Node's built-in test runner and a
dependency-free Chrome DevTools Protocol harness.

## Prerequisites

- Any modern browser (for the app itself).
- Node.js 18+ (only to run the tests).

## Run locally

Open `index.html` in a browser — no server needed. Or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

## Tests

```sh
node --test tests/logic.test.js   # unit tests for scramble, time and stats logic
node tests/smoke.js               # headless-Chrome UI smoke test (raw CDP)
```

## Deployment

Static site: publish the repository root with GitHub Pages (or any static
host). No environment variables, no secrets, no backend.

## Limitations

- Times are measured with the browser clock (`performance.now()`), so this
  is a practice timer, not a competition-grade Stackmat timer.
- Ao5 / Ao12 follow the trimmed-mean rule but report blank (rather than
  DNF) when a DNF falls inside the window; this is a simplification of the
  official WCA average rules and is documented in `js/logic.js`.
- Scrambles are pseudo-random practice scrambles, not WCA-official
  state-scrambles; they are not guaranteed to be uniformly distributed
  over cube states.

## Status

Complete MVP. Unit tests 18/18 and headless-Chrome smoke checks 27/27 pass
with zero console errors (see `TEST_RESULTS.md`).
