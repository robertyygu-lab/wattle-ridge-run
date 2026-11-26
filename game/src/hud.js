// hud.js — the instruments and screens of Wattle Ridge Run, all drawn on
// the same canvas as the world: airspeed, altitude and heading tapes, the
// artificial horizon, fuel and throttle, the score and ring count, the
// messages the pilot needs, and the title, crash and mission-complete
// screens. Every value on the HUD is live from the plane's state.
import { STALL_SPEED, MAX_SPEED, MAX_ALT } from './plane.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 22, 38, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || 'rgba(255,255,255,0.75)';
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || '#ffffff';
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function formatHeading(heading) {
  const h = Math.round(((heading % 360) + 360) % 360);
  return String(h).padStart(3, '0');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// A scrolling compass tape: the heading in the middle, ticks every 10
// degrees, cardinal letters at N/E/S/W, and the numeric heading under the
// marker so it never collides with the ticks.
function drawCompass(ctx, width, heading) {
  const cx = width / 2;
  const y = 8;
  panel(ctx, cx - 190, y, 380, 58);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 184, y + 2, 368, 30);
  ctx.clip();
  const pxPerDeg = 3.2;
  const start = Math.floor((heading - 60) / 10) * 10;
  for (let d = start; d <= heading + 60; d += 10) {
    const deg = ((d % 360) + 360) % 360;
    const x = cx + (d - heading) * pxPerDeg;
    const major = deg % 30 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 28);
    ctx.lineTo(x, y + 28 - (major ? 12 : 7));
    ctx.stroke();
    if (major) {
      const name = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg / 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, x, y + 4);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(cx - 7, y + 28);
  ctx.lineTo(cx + 7, y + 28);
  ctx.lineTo(cx, y + 36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(formatHeading(heading) + '°', cx, y + 42);
}

// The artificial horizon: a little round gauge showing bank (rotation) and
// pitch (the horizon line sliding up and down).
function drawHorizon(ctx, x, y, radius, bank, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(bank * 0.45);
  ctx.translate(0, pitch * radius * 0.9);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-radius, -radius * 2, radius * 2, radius * 2);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-radius, 0, radius * 2, radius * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker on the gauge.
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(x - radius - 4, y);
  ctx.lineTo(x - radius + 8, y);
  ctx.lineTo(x - radius + 2, y + 5);
  ctx.closePath();
  ctx.moveTo(x + radius + 4, y);
  ctx.lineTo(x + radius - 8, y);
  ctx.lineTo(x + radius - 2, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBar(ctx, x, y, w, h, fraction, color, labelText) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  if (labelText) label(ctx, labelText, x, y - 13, 10);
}

export function drawHud(ctx, game) {
  const { width, height, plane, course } = game;
  const ground = game.groundHeightAt(plane.z);

  // Airspeed, altitude, vertical speed — top left.
  panel(ctx, 12, 8, 168, 132);
  label(ctx, 'AIRSPEED', 24, 16, 11);
  value(ctx, `${Math.round(plane.speed)}`, 24, 30, 30);
  label(ctx, 'KT', 96, 44, 12);
  label(ctx, 'ALTITUDE', 24, 68, 11);
  value(ctx, `${Math.round(plane.alt)}`, 24, 82, 22);
  label(ctx, 'FT', 96, 90, 12);
  const vs = Math.round(plane.verticalSpeed);
  value(ctx, `V/S ${vs >= 0 ? '+' : ''}${vs} FPM`, 24, 112, 11, vs < -600 ? '#ff8a7a' : 'rgba(255,255,255,0.8)');

  drawCompass(ctx, width, plane.heading);

  // Score, rings, timer — top right.
  panel(ctx, width - 180, 8, 168, 108);
  label(ctx, 'SCORE', width - 168, 16, 11);
  value(ctx, String(plane.score), width - 168, 30, 26);
  label(ctx, `RINGS  ${plane.ringsHit} / ${course.rings.length}`, width - 168, 62, 12);
  label(ctx, `TIME  ${formatTime(plane.elapsed)}`, width - 168, 82, 12);
  const next = course.rings.find((r) => !r.passed && r.z > plane.z);
  if (next) {
    const distKm = Math.max(0, (next.z - plane.z) / 3281).toFixed(1);
    label(ctx, `NEXT RING ${distKm} KM`, width - 168, 100, 11, '#ffd23f');
  }

  // Fuel, throttle and the horizon gauge — bottom left.
  panel(ctx, 12, height - 108, 240, 96);
  const fuelColor = plane.fuel < 20 ? '#ff6b5e' : plane.fuel < 45 ? '#ffd23f' : '#7bc96f';
  drawBar(ctx, 24, height - 78, 150, 12, plane.fuel / 100, fuelColor, 'FUEL');
  value(ctx, `${Math.round(plane.fuel)}%`, 182, height - 82, 13, fuelColor);
  drawBar(ctx, 24, height - 46, 150, 12, plane.throttle, '#6fb7ff', 'THROTTLE');
  value(ctx, `${Math.round(plane.throttle * 100)}%`, 182, height - 50, 13);
  drawHorizon(ctx, 216, height - 62, 34, plane.bank, plane.pitch);

  // Bottom-right: what the pilot is flying, and the controls reminder.
  panel(ctx, width - 252, height - 108, 240, 96);
  label(ctx, 'KOOKABURRA K-1  •  WATTLE RIDGE', width - 240, height - 98, 11, '#ffd23f');
  label(ctx, '↑↓ pitch    ←→ bank & turn', width - 240, height - 78, 12);
  label(ctx, 'W/S throttle    M sound    P pause', width - 240, height - 58, 12);
  label(ctx, 'Drag mouse to steer  •  R restart', width - 240, height - 38, 12);

  // Warnings, centre screen, where the pilot cannot miss them.
  const warnings = [];
  if (plane.alt - ground < 260 && plane.airborne) warnings.push(['PULL UP — TERRAIN', '#ff6b5e']);
  if (plane.fuel < 20 && plane.fuel > 0) warnings.push(['LOW FUEL', '#ffd23f']);
  if (plane.fuel <= 0) warnings.push(['OUT OF FUEL — GLIDING', '#ff6b5e']);
  if (plane.speed < STALL_SPEED && plane.airborne) warnings.push(['STALL — NOSE DOWN, ADD POWER', '#ff6b5e']);
  warnings.forEach(([text, color], i) => {
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 22, 38, 0.6)';
    const w = ctx.measureText(text).width + 28;
    ctx.fillRect(width / 2 - w / 2, height * 0.22 + i * 40, w, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, width / 2, height * 0.22 + i * 40 + 24);
  });

  if (game.message) {
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = 'rgba(10,22,38,0.8)';
    ctx.lineWidth = 5;
    ctx.strokeText(game.message, width / 2, height * 0.34);
    ctx.fillText(game.message, width / 2, height * 0.34);
  }
}

function screenBase(ctx, game, title, titleColor) {
  const { width, height } = game;
  ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, width / 2, height * 0.24);
}

export function drawTitleScreen(ctx, game) {
  const { width, height, plane } = game;
  screenBase(ctx, game, 'WATTLE RIDGE RUN', '#ffd23f');
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText('Fly the Kookaburra K-1 down the valley, thread all eight rings,', width / 2, height * 0.33);
  ctx.fillText('and bring her home to the far strip — without kissing the hills.', width / 2, height * 0.38);
  panel(ctx, width / 2 - 260, height * 0.45, 520, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  const lines = [
    '↑ / ↓  —  pitch up and down',
    '← / →  —  bank and turn',
    'W / S  —  throttle up and down   (Shift / Ctrl work too)',
    'Mouse  —  hold and drag to steer',
    'M  —  sound on/off      P  —  pause      R  —  restart',
  ];
  lines.forEach((line, i) => ctx.fillText(line, width / 2 - 240, height * 0.45 + 28 + i * 24));
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px sans-serif';
  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  ctx.fillStyle = `rgba(255, 210, 63, ${pulse})`;
  ctx.fillText('PRESS ENTER OR CLICK TO TAKE OFF', width / 2, height * 0.72);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Eight rings  •  Fuel matters  •  Watch your speed on the turns', width / 2, height * 0.78);
  ctx.fillText('A complete game: take off, fly, score, land — or crash trying.', width / 2, height * 0.82);
}

export function drawCrashScreen(ctx, game, reason) {
  const { width, height, plane } = game;
  const titles = {
    terrain: 'TERRAIN STRIKE',
    stall: 'STALLED INTO THE RIDGE',
    fuel: 'OUT OF FUEL',
  };
  const notes = {
    terrain: 'The valley floor came up faster than the Kookaburra could climb.',
    stall: 'Too slow, too high — the wing stopped flying and the ridge did not.',
    fuel: 'The tanks ran dry over the river. Glide practice is next time.',
  };
  screenBase(ctx, game, titles[reason] || 'CRASHED', '#ff6b5e');
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText(notes[reason] || '', width / 2, height * 0.33);
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`Score ${plane.score}   •   Rings ${plane.ringsHit} / 8   •   Time ${formatTime(plane.elapsed)}`, width / 2, height * 0.44);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('PRESS R TO FLY AGAIN', width / 2, height * 0.56);
}

export function drawWinScreen(ctx, game) {
  const { width, height, plane } = game;
  const complete = plane.ringsHit === 8;
  const timeBonus = complete ? Math.max(0, Math.round((300 - plane.elapsed) * 2)) : 0;
  const total = plane.score + timeBonus;
  screenBase(ctx, game, complete ? 'MISSION COMPLETE' : 'END OF THE VALLEY', complete ? '#7bc96f' : '#ffd23f');
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText(
    complete
      ? 'All eight rings threaded — the Kookaburra is home over Wattle Ridge.'
      : `The valley ran out with ${plane.ringsHit} of 8 rings threaded — fly again and mind the turns.`,
    width / 2, height * 0.33,
  );
  panel(ctx, width / 2 - 220, height * 0.40, 440, 150);
  ctx.textAlign = 'left';
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Rings and flying:`, width / 2 - 200, height * 0.40 + 30);
  ctx.fillText(`Time bonus:`, width / 2 - 200, height * 0.40 + 60);
  if (plane.landedSmooth) ctx.fillText('Smooth landing: +250', width / 2 - 200, height * 0.40 + 90);
  ctx.textAlign = 'right';
  ctx.fillText(String(plane.score), width / 2 + 200, height * 0.40 + 30);
  ctx.fillText(`+${timeBonus}`, width / 2 + 200, height * 0.40 + 60);
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(`TOTAL SCORE  ${total}`, width / 2, height * 0.64);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Time ${formatTime(plane.elapsed)}   •   Fuel left ${Math.round(plane.fuel)}%`, width / 2, height * 0.70);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('PRESS R TO FLY AGAIN', width / 2, height * 0.78);
}

export function drawPausedScreen(ctx, game) {
  const { width, height } = game;
  screenBase(ctx, game, 'PAUSED', '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Press P to keep flying.', width / 2, height * 0.33);
}
