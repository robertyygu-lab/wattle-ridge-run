# Wattle Ridge Run

An original bush-plane flight game for the make.fun "Make the best flight
game" bounty. Fly the Kookaburra K-1 down a river valley in the Australian
bush, thread all eight target rings, watch your fuel, and bring her home to
the far strip — without kissing the hills.

## How to play

Serve `game/` with any static server (or run `node serve.ts`) and open it in
a desktop browser. The game plays entirely offline: no network requests, no
libraries, just a canvas and vanilla JavaScript.

| Key | What it does |
| --- | --- |
| ↑ / ↓ | Pitch up / down (climb and descend) |
| ← / → | Bank and turn |
| W / S | Throttle up / down (Shift / Ctrl work too) |
| Mouse | Hold and drag to steer |
| Enter | Take off from the title screen |
| P | Pause |
| M | Sound on / off |
| R | Fly again after a crash or a finished run |

## The flight

- **Take off** from the strip at the head of the valley: spool the throttle
  with W, pull up gently once you pass 70 knots.
- **Eight rings** hang over the valley at set heights and offsets. Thread
  one for 100 points, 150 for a centred pass.
- **Fuel** drains faster at full throttle. Run dry and you glide — and a
  glide ends on the ground.
- **Stall**: below about 62 knots the wing gives up and the nose drops.
- **Land** on the far strip after the last ring for a smooth-landing bonus
  of 250 points, plus a time bonus if you were quick.

The HUD shows airspeed, altitude and vertical speed, a scrolling compass
with heading, fuel and throttle bars, an artificial horizon, score, rings
and time. The chase view shows the valley floor, the river crossings, gum
trees, the runway strips and the next ring ahead.

## Files

- `game/index.html` — the page; `game/style.css` — page styles.
- `game/src/main.js` — boot, game loop and state machine.
- `game/src/terrain.js` — the valley: segments, river, trees, rings.
- `game/src/plane.js` — the flight model, fuel, stall and scoring.
- `game/src/render.js` — the pseudo-3D chase view.
- `game/src/hud.js` — instruments and title / crash / win screens.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — WebAudio engine drone, chimes and thuds.
- `game/src/rng.js` — the seeded random numbers behind the valley.
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the kit library.
- `serve.ts` — a tiny static server for local testing.
- `screenshots/` — real renders of the game running in a browser.
