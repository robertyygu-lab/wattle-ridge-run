# Wattle Ridge Run — build notes

## Bounty

- "Make the best flight game", competition slug `best-flight-game-20261126-0057`.
- $500 USDC total, 50 places paid (1st $100, 2nd $55, 3rd $30, down to $3 for
  40th–50th). Opened 2026-11-26T00:57:00Z, ends Sat 28 Nov 2026 00:57 UTC
  (Sat 28 Nov 11:57 AEDT). Entries open 48 hours.
- Built in a fresh session started after the bounty opened. Every line of the
  game and of `main.ts` was written in this session, in several write/edit
  turns; `plane.js`, `render.js`, `hud.js`, `terrain.js` and `main.js` were
  each revised after first being written. Kit files (`vendor/makefun-game.ts`,
  `serve.ts`) are copies of the kit's own files, unchanged, as the task asked.

## The game

**Wattle Ridge Run** — fly the Kookaburra K-1 bush plane down a river valley
in the Australian bush. Take off from the strip at the head of the valley,
thread all eight glowing target rings, watch fuel and speed, and bring her
home to the far strip.

- Pseudo-3D chase view (vanilla canvas, no libraries): sky, sun and drifting
  clouds, two parallax ridge silhouettes, a valley floor drawn segment by
  segment with hill-crest clipping, two river crossings, gum trees, a start
  strip and a finish strip with dashed centrelines, and the plane drawn from
  behind and above with its shadow on the ground below.
- Deterministic valley: one fixed seed, so every flight sees the same course,
  river crossings, trees and ring positions.
- Real game: takeoff, 8 rings (100 points each, 150 for a centred pass),
  score, timer, fuel that drains faster at full throttle, stall below ~62 kt,
  terrain/fuel/stall crash states with distinct messages, a smooth-landing
  bonus (+250) on the far strip, a time bonus, and a mission-complete screen.
  Running out of valley without all 8 rings ends with an honest
  "End of the valley" screen instead of a fake win.
- HUD (all live): airspeed (KT), altitude (FT), vertical speed, scrolling
  compass tape with numeric heading, fuel and throttle bars, artificial
  horizon gauge, score, rings hit, timer, next-ring distance, and warnings
  (PULL UP, LOW FUEL, STALL).
- Sound: WebAudio only — engine drone following throttle/speed, ring chime,
  crash thud, menu click. M mutes. Nothing plays before first interaction.
- No network: no `http://`/`https://` references and no `fetch`/
  `XMLHttpRequest`/`WebSocket` anywhere under `game/`. Every file the page
  loads is a file under `game/`.

## Controls

| Key | Action |
| --- | --- |
| ↑ / ↓ | Pitch up / down |
| ← / → | Bank and turn |
| W / S | Throttle up / down (Shift / Ctrl also work) |
| Mouse | Hold and drag to steer |
| Enter / click | Take off / start |
| P | Pause |
| M | Sound on/off |
| R | Fly again after a crash or a finished run |

`?autofly=1` runs a test autopilot that steers at the next ring. It exists
only so the flight can be verified headlessly; normal play never uses it.

## Files

- `game/index.html`, `game/style.css`
- `game/src/main.js` — boot, loop, state machine, ring pickups, autopilot
- `game/src/terrain.js` — course segments, river, trees, rings
- `game/src/plane.js` — flight model, fuel, stall, crash reasons, scoring
- `game/src/render.js` — pseudo-3D chase view
- `game/src/hud.js` — instruments and title/crash/win/pause screens
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — WebAudio sounds
- `game/src/rng.js` — seeded random numbers
- `main.ts` — copies `game/` + `screenshots/` to the output dir, writes
  `dossier.json` via the kit's `buildDossier`
- `serve.ts` — kit's tiny static server (unchanged copy)
- `vendor/makefun-game.ts` — kit library, unchanged
- `LICENSE` — MIT, Copyright (c) 2026 Robert Gu
- `screenshots/` — 4 real renders (see below)

## Verification (all run 2026-11-27, headless system Chrome via Playwright)

Environment note: the system Chrome at `/opt/meta-chromium/chrome` needs two
switches to start at all (`--hatch-webgl-allowed-domains-file` pointing at a
file containing `hatch-webgl-all-origins-v1` plus its
`--hatch-webgl-allowed-domains-sha256`), and it blocks top-level navigation
to localhost (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`) even with the
LocalNetworkAccessChecks feature disabled and a managed
`LocalNetworkAccessAllowedForUrls` policy. The game was therefore play-tested
from `file://` with `--allow-file-access-from-files` (ES modules load, and
there is no network at all in that mode). The static server was separately
verified to serve the game with HTTP 200 (`node serve.ts --port 8123`).

Play-test results (final run, 14/14 checks passed):

- Page loads, title state shown.
- Manual takeoff with real keys (W + ArrowUp): state `flying`, speed 269 kt,
  altitude 514 ft, fuel 98%.
- HUD values change over time (speed 269 → 281 kt, altitude 514 → 559 ft).
- Banking left moves the plane left (x −460 → −1352 ft).
- Diving into terrain ends in the `crashed` state; R restarts to `flying`.
- Autopilot full flight: **8/8 rings, score 1150, fuel 39% left, `won` state**
  (time bonus +340 → total 1490 on the win screen). Earlier runs caught and
  fixed three real bugs: a rotation-frame crash (plane counted as crashed the
  instant it left the strip), a curve push stronger than the steering
  authority, and ring x stored in absolute world coordinates while the plane's
  x is relative to the centreline.
- Zero external HTTP(S) requests, zero console errors, zero page errors in
  every run.

Node syntax checks: all 8 files under `game/src/` pass `node --check`
(`serve.ts` is TypeScript and is run, not `--check`ed, by Node 22+).

Determinism: `main.ts` run twice with `MAKEFUN_OUTPUT_DIR` to two different
directories writes byte-identical output (`diff -r` clean).

- `dossier.json`: 483,348 bytes (cap 1,500,000), valid JSON, keys
  `cover,images,schema,text`; dossier text 51,896 bytes (cap 163,840 — every
  source file included in full).
- dossier sha256:
  `be521888972b48b14c5214ceec5542070a731b427d298ad1a543f4810b49064b`
- Note on dossier size: the parent agent independently measured the dossier
  at 467,148 bytes, which does not match the 483,348 bytes measured here.
  The cause is unresolved — possibly the two runs were measured against
  different states of the directory. Re-run `main.ts` twice and compare
  before submitting so the submitted dossier size and hash are known good.

Screenshots (all JPEG, 1280×720, long side 1280 ≤ 1280, short side 720 ≥ 480,
each ≤ 256 KiB):

| File | Bytes | Shows |
| --- | --- | --- |
| `1-title.jpg` | 82,921 | Title screen over the runway |
| `2-flight.jpg` | 82,572 | In-flight chase view, HUD, gum trees, rings 2 and 3 ahead |
| `3-river.jpg` | 86,655 | Over the river, score 300, rings 2/8 |
| `4-win.jpg` | 69,834 | Mission complete, total score 1490 |

All four were taken with real keyboard input driving the game in headless
Chrome (shots 2–4 during an autopilot flight, shot 1 from the title screen)
and were retaken after the last code change so they are renders of the exact
submitted build. Never edited, composited or borrowed.

Kit CLI check (`node cli/makefun.mjs check --repo <dir> --worktree`,
2026-11-26T22:22Z): 4 passed, 1 failed, 15 skipped, 5 checked at submission.

- pass: `competition_open` (now is between opening and deadline),
  `snapshot` (19 files, 435,530 bytes, within intake caps),
  `license_osi` (MIT), `entrypoint` (main.ts selects node22).
- FAIL: `transcripts_present` — no transcripts were uploaded. **Expected at
  this stage**: the parent agent bundles the sessions and submits; the check
  notes the transcript gate cannot be evaluated without them, and every other
  transcript check skips for the same reason.
- at submission: `repo_public`, `repo_owner`, `repo_created_after_open`,
  `commit_in_repo`, `duplicate_snapshot` — all depend on the GitHub repo,
  which the parent creates; none can pass before then.

## Not done by this build (for the parent)

- No GitHub repo created, nothing pushed, nothing submitted, nothing signed,
  no money spent, no wallet/keypair touched (per instructions).
- The parent still needs to: create the public repo under `robertyygu-lab`
  (created after the bounty opened), push this directory, bundle the
  transcripts for this session, and submit under `@keen-kestrel-85-8462`
  before Sat 28 Nov 11:57 AEDT. A `.makefun/owner.json` claim file may be
  needed depending on how the account signs in (see the kit check's
  `repo_owner` note).
