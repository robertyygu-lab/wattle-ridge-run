// main.js — Wattle Ridge Run: boots the game, runs the loop and owns the
// state machine (title -> flying -> crashed / won / paused), the ring
// pickups, the messages and the restart. The plane, the valley, the view
// and the instruments each live in their own module.
import { buildCourse, groundHeightAt } from './terrain.js';
import { createPlane, updatePlane, crashReason, scoreRing, MAX_SPEED } from './plane.js';
import { drawScene } from './render.js';
import { drawHud, drawTitleScreen, drawCrashScreen, drawWinScreen, drawPausedScreen } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const course = buildCourse();
const input = createInput(canvas);
const audio = createAudio();

const game = {
  width: 1280,
  height: 720,
  course,
  plane: createPlane(),
  state: 'title', // title | flying | paused | crashed | won
  crash: null,
  time: 0,
  message: '',
  messageUntil: 0,
  groundHeightAt,
};

function resize() {
  const scale = Math.min(window.innerWidth / game.width, window.innerHeight / game.height);
  canvas.style.width = `${Math.floor(game.width * scale)}px`;
  canvas.style.height = `${Math.floor(game.height * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

function showMessage(text, seconds) {
  game.message = text;
  game.messageUntil = game.time + seconds;
}

function startFlight() {
  game.plane = createPlane();
  for (const ring of course.rings) {
    ring.passed = false;
    ring.scored = false;
  }
  game.state = 'flying';
  game.crash = null;
  game.message = '';
  input.clearPressed();
  audio.unlock();
  audio.click();
  showMessage('FULL THROTTLE — W TO SPOOL UP', 3);
}

function endFlight(state, crash) {
  game.state = state;
  game.crash = crash || null;
  audio.engine(0, 0);
  if (state === 'crashed') audio.thud();
  if (state === 'won') audio.chime();
}

// Autopilot for automated play-testing (?autofly=1): steers toward the next
// ring, holds its height and keeps the throttle up. Never used in normal play.
function autofly(plane) {
  const next = course.rings.find((r) => !r.passed && r.z > plane.z);
  const out = { pitch: 0, turn: 0, throttleUp: true, throttleDown: false };
  if (!next) {
    out.pitch = plane.alt > groundHeightAt(plane.z) + 700 ? -0.4 : 0;
    return out;
  }
  const altError = next.alt - plane.alt;
  out.pitch = Math.max(-1, Math.min(1, altError / 150));
  const xError = next.x - plane.x;
  out.turn = Math.max(-1, Math.min(1, xError / 500));
  if (plane.speed > 240) out.throttleUp = false;
  return out;
}

function step(dt) {
  game.time += dt;
  if (game.time > game.messageUntil) game.message = '';
  input.poll();

  if (input.wasPressed('mute')) {
    audio.setMuted(!audio.isMuted());
    showMessage(audio.isMuted() ? 'SOUND OFF' : 'SOUND ON', 1.5);
  }

  if (game.state === 'title') {
    if (input.wasPressed('start')) startFlight();
    return;
  }

  if (game.state === 'flying') {
    if (input.wasPressed('pause')) {
      game.state = 'paused';
      audio.engine(0, 0);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const controls = params.get('autofly') === '1' ? autofly(game.plane) : input;
    const prevZ = game.plane.z;
    updatePlane(game.plane, controls, course, dt);
    audio.engine(game.plane.throttle, game.plane.speed);

    // Threading a ring: crossing its line inside its circle scores.
    for (const ring of course.rings) {
      if (!ring.passed && prevZ < ring.z && game.plane.z >= ring.z) {
        const altOk = Math.abs(game.plane.alt - ring.alt) < ring.radius + 60;
        const xOk = Math.abs(game.plane.x - ring.x) < ring.radius + 220;
        if (altOk && xOk) {
          const points = scoreRing(game.plane, ring);
          audio.chime();
          showMessage(`RING ${ring.id} / 8   +${points}`, 2);
          if (game.plane.ringsHit === course.rings.length) {
            endFlight('won');
            return;
          }
        } else {
          ring.passed = true;
          showMessage(`MISSED RING ${ring.id} — KEEP FLYING`, 2);
        }
      }
    }

    // Ran out of valley without threading every ring.
    if (game.plane.z >= course.length - 200) {
      endFlight('won');
      return;
    }

    const crash = crashReason(game.plane, course);
    if (crash) {
      endFlight('crashed', crash);
      return;
    }
    return;
  }

  if (game.state === 'paused') {
    if (input.wasPressed('pause')) game.state = 'flying';
    return;
  }

  if (game.state === 'crashed' || game.state === 'won') {
    if (input.wasPressed('restart')) startFlight();
  }
}

function render() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawScene(ctx, game);
  if (game.state === 'flying' || game.state === 'paused') drawHud(ctx, game);
  if (game.state === 'title') drawTitleScreen(ctx, game);
  if (game.state === 'crashed') drawCrashScreen(ctx, game, game.crash);
  if (game.state === 'won') drawWinScreen(ctx, game);
  if (game.state === 'paused') drawPausedScreen(ctx, game);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  render();
  requestAnimationFrame(frame);
}

// Clicking anywhere on the title, crash or win screen starts (or restarts).
canvas.addEventListener('click', () => {
  audio.unlock();
  if (game.state === 'title') startFlight();
  else if (game.state === 'crashed' || game.state === 'won') startFlight();
});

// Handles the automated checks read: state, score, rings, fuel and speed.
window.__wattle = {
  game,
  state: () => game.state,
  score: () => game.plane.score,
  ringsHit: () => game.plane.ringsHit,
  speed: () => Math.round(game.plane.speed),
  altitude: () => Math.round(game.plane.alt),
  fuel: () => Math.round(game.plane.fuel),
};

requestAnimationFrame(frame);
