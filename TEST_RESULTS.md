# TEST RESULTS — cube-timer-bd (2026-10-27, 13:00 slot)

## Unit tests — 18/18 PASS (node --test tests/logic.test.js)

- Scramble: 20 moves, valid faces/suffixes; 200 random scrambles with zero
  consecutive same-face moves and zero A-B-A patterns.
- formatTime: 0 -> "0.00", 1234 -> "12.34", 6123 -> "1:01.23", 359999 -> "59:59.99".
- parseTime: "12.34" -> 1234, "1:01.23" -> 6123, "90" -> 9000; 12 invalid
  inputs rejected (empty, "1:60", "12.345", "1:2", "0", "0.00", ...).
- Ao5 hand-verified: [10.00, 12.00, 11.00, 13.00, 9.00] -> 11.00 (trimmed mean);
  last-5 windowing verified; DNF in window -> null; fewer than 5 -> null.
- computeStats hand-verified: [10.00, 12.00+2, 9.00, DNF] -> best 9.00,
  worst 14.00, mean 11.00, completed 3 of 4.
- validateImport: 1 valid file accepted; 11 malformed files rejected.
- toBnDigits: "12.34" renders with Bengali digits.

## Headless-Chrome smoke — 27/27 PASS (node tests/smoke.js, raw CDP)

- Title, 20-move scramble rendered, initial count 0.
- Timer start/stop via hooks: display ticks, solve recorded, new scramble
  issued after recording.
- Deterministic Ao5 scenario: 5 manual times -> best 9.00, Ao5 11.00,
  Ao12 dash, 5 history rows.
- +2 penalty on the first solve -> Ao5 recomputed to 11.67.
- Invalid manual input rejected, count unchanged.
- Bangla toggle: html lang bn, button reads English, count in Bengali digits.
- 390 px viewport: no horizontal overflow.
- Zero page console errors / exceptions.

## Repairs

0 app-logic repairs. Tests and app passed on the first full run.

## Source hygiene

Bangla UI strings live in js/i18n.js as \uXXXX escapes (generated from a
JSON source; verified to decode to correct Bangla). A few files also use
UTF-8 punctuation (em dashes in index.html, README.md, TEST_RESULTS.md).
The push uses the `github push-files` adapter, which reads the files
directly from disk rather than through command-line arguments, so no
text is exposed to the argv-transport corruption seen on 2026-10-11
(run #25); remote files are verified byte-identical after the push.
