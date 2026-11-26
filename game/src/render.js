// render.js — the pseudo-3D chase view for Wattle Ridge Run.
// A camera rides behind and above the Kookaburra, looking down the valley:
// sky, sun, clouds and ridge silhouettes first, then the valley floor drawn
// segment by segment from near to far, with the runway strips, the river,
// gum trees and target rings, and the plane itself drawn last on top.
// Nothing here loads a file; every shape is drawn with canvas paths.
import { SEG_LEN, ROAD_HALF, groundHeightAt } from './terrain.js';
import { ridgeNoise } from './rng.js';

const CAMERA_DEPTH = 0.84; // 1 / tan(fov / 2), fov about 100 degrees
const DRAW_DISTANCE = 150; // segments drawn ahead of the plane
const CAMERA_ABOVE = 330; // feet the camera sits above the plane

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function css(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const GRASS_A = [106, 168, 79];
const GRASS_B = [96, 154, 72];
const RIVER = [64, 138, 186];
const RIVER_LIGHT = [110, 180, 214];
const SKY_TOP = [52, 110, 196];
const SKY_HORIZON = [176, 216, 240];
const RIDGE_FAR = [122, 158, 196];
const RIDGE_NEAR = [88, 124, 96];

// Project a world point into screen space from the camera.
function project(p, cameraX, cameraY, cameraZ, width, height) {
  p.cameraX = p.worldX - cameraX;
  p.cameraY = p.worldY - cameraY;
  p.cameraZ = p.worldZ - cameraZ;
  if (p.cameraZ <= 0) {
    p.screenX = 0;
    p.screenY = 0;
    p.screenW = 0;
    return;
  }
  const scale = CAMERA_DEPTH / p.cameraZ;
  p.screenX = Math.round(width / 2 + scale * p.cameraX * (width / 2));
  p.screenY = Math.round(height / 2 - scale * p.cameraY * (height / 2));
  p.screenW = Math.round(scale * ROAD_HALF * (width / 2));
  p.scale = scale;
}

function point(worldX, worldY, worldZ) {
  return { worldX, worldY, worldZ, cameraX: 0, cameraY: 0, cameraZ: 0, screenX: 0, screenY: 0, screenW: 0, scale: 0 };
}

function drawSky(ctx, width, height, curveAccum, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.62);
  grad.addColorStop(0, css(SKY_TOP));
  grad.addColorStop(1, css(SKY_HORIZON));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.62);

  // Sun, high and to the right.
  const sunX = width * 0.82;
  const sunY = height * 0.12;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
  glow.addColorStop(0, 'rgba(255, 244, 190, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 226, 130, 0.55)');
  glow.addColorStop(1, 'rgba(255, 226, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 95, sunY - 95, 190, 190);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();

  // Slow clouds, drifting with the bend of the valley.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const clouds = [
    [0.12, 0.10, 90, 16], [0.30, 0.16, 120, 20], [0.55, 0.07, 80, 14],
    [0.68, 0.18, 130, 18], [0.90, 0.09, 100, 16],
  ];
  for (const [fx, fy, w, h] of clouds) {
    const drift = ((curveAccum * 0.02 + time * 0.004) % 1.2) - 0.1;
    const cx = (((fx + drift) % 1.15) + 1.15) % 1.15 * width;
    ctx.beginPath();
    ctx.ellipse(cx, fy * height, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.5, fy * height + 4, w * 0.6, h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A distant ridge silhouette, its peaks from deterministic noise, sliding
// sideways a little as the valley bends.
function drawRidge(ctx, width, horizonY, seed, parallax, color, base, amp) {
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  for (let x = 0; x <= width; x += 16) {
    const n = ridgeNoise(seed, x * 0.02 + parallax);
    ctx.lineTo(x, horizonY - base - n * amp);
  }
  ctx.lineTo(width, horizonY + 2);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, x, y, size, kind) {
  // Gum tree: a leaning trunk and a sparse, flat-topped canopy.
  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size * 0.08, y - size * 0.55);
  ctx.stroke();
  ctx.fillStyle = kind === 0 ? '#3f7a3a' : kind === 1 ? '#4c8a3f' : '#356b33';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.10, y - size * 0.72, size * 0.42, size * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse(x - size * 0.22, y - size * 0.62, size * 0.30, size * 0.20, 0, 0, Math.PI * 2);
  ctx.ellipse(x + size * 0.38, y - size * 0.60, size * 0.28, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRing(ctx, x, y, radius, id, scored) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(3, radius * 0.10);
  ctx.strokeStyle = scored ? '#9be15d' : '#ffd23f';
  ctx.shadowColor = scored ? '#9be15d' : '#ffb703';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, radius * 0.025);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#1d3557';
  ctx.font = `bold ${Math.max(12, radius * 0.42)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), x, y);
  ctx.restore();
}

// The Kookaburra K-1 from behind and above: cream wings with red tips,
// a red fuselage spine and a tall tail fin.
function drawPlane(ctx, x, y, size, bank, pitch) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank * 0.45);
  const s = size / 100;

  // Main wings, swept slightly back.
  ctx.fillStyle = '#f4ead8';
  ctx.beginPath();
  ctx.moveTo(-52 * s, 6 * s);
  ctx.lineTo(-8 * s, -4 * s);
  ctx.lineTo(8 * s, -4 * s);
  ctx.lineTo(52 * s, 6 * s);
  ctx.lineTo(46 * s, 12 * s);
  ctx.lineTo(0, 8 * s);
  ctx.lineTo(-46 * s, 12 * s);
  ctx.closePath();
  ctx.fill();
  // Red wingtips.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-52 * s, 6 * s);
  ctx.lineTo(-40 * s, 3 * s);
  ctx.lineTo(-36 * s, 10 * s);
  ctx.lineTo(-46 * s, 12 * s);
  ctx.closePath();
  ctx.moveTo(52 * s, 6 * s);
  ctx.lineTo(40 * s, 3 * s);
  ctx.lineTo(36 * s, 10 * s);
  ctx.lineTo(46 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  // Fuselage, narrowing toward the tail (up-screen, away from the camera).
  ctx.fillStyle = '#e8b64c';
  ctx.beginPath();
  ctx.moveTo(-7 * s, 14 * s);
  ctx.lineTo(-5 * s, -26 * s);
  ctx.lineTo(0, -34 * s);
  ctx.lineTo(5 * s, -26 * s);
  ctx.lineTo(7 * s, 14 * s);
  ctx.quadraticCurveTo(0, 20 * s, -7 * s, 14 * s);
  ctx.closePath();
  ctx.fill();
  // Red spine stripe.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-2.5 * s, 12 * s);
  ctx.lineTo(-2 * s, -28 * s);
  ctx.lineTo(2 * s, -28 * s);
  ctx.lineTo(2.5 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  // Horizontal stabiliser at the tail.
  ctx.fillStyle = '#f4ead8';
  ctx.beginPath();
  ctx.moveTo(-20 * s, -24 * s);
  ctx.lineTo(20 * s, -24 * s);
  ctx.lineTo(16 * s, -18 * s);
  ctx.lineTo(-16 * s, -18 * s);
  ctx.closePath();
  ctx.fill();

  // Tall tail fin with the roundel.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-4 * s, -24 * s);
  ctx.lineTo(0, -46 * s);
  ctx.lineTo(4 * s, -24 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4ead8';
  ctx.beginPath();
  ctx.arc(0, -32 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d3557';
  ctx.beginPath();
  ctx.arc(0, -32 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // Cockpit hump and engine cowling glint.
  ctx.fillStyle = 'rgba(29, 53, 87, 0.85)';
  ctx.beginPath();
  ctx.ellipse(0, -2 * s, 5.5 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The whole scene for one frame. `game` carries course, plane, state and time.
export function drawScene(ctx, game) {
  const { width, height } = game;
  const { course, plane } = game;
  const segments = course.segments;
  const segmentCount = segments.length;

  const position = plane.z;
  const baseSegment = Math.floor(position / SEG_LEN) % segmentCount;
  const basePercent = (position % SEG_LEN) / SEG_LEN;

  // Camera sits behind the plane, above it, looking down the valley.
  const baseSeg = segments[baseSegment];
  const roadCenterX = baseSeg.x1 + (baseSeg.x2 - baseSeg.x1) * basePercent;
  const cameraX = roadCenterX + plane.x;
  const cameraY = plane.alt + CAMERA_ABOVE;
  const cameraZ = position;

  // How far the valley has bent so far, for the sky parallax.
  let curveAccum = 0;
  for (let n = 0; n < DRAW_DISTANCE; n++) {
    curveAccum += segments[(baseSegment + n) % segmentCount].curve;
  }

  // Sky and ground base fill, so no gap ever shows at the screen edges.
  drawSky(ctx, width, height, curveAccum, game.time);
  const horizonY = Math.round(height * 0.52);
  drawRidge(ctx, width, horizonY, 7, curveAccum * 0.06, RIDGE_FAR, 46, 60);
  drawRidge(ctx, width, horizonY, 21, curveAccum * 0.12, RIDGE_NEAR, 18, 42);

  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
  groundGrad.addColorStop(0, css(mixColor(GRASS_A, SKY_HORIZON, 0.55)));
  groundGrad.addColorStop(1, css(GRASS_A));
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  // Valley floor, near to far, each segment a band of grass (or river, or
  // runway) clipped by the hill crest in front of it.
  let maxY = height;
  const drawn = [];
  for (let n = 0; n < DRAW_DISTANCE; n++) {
    const index = (baseSegment + n) % segmentCount;
    const segment = segments[index];
    const p1 = point(segment.x1, segment.y1, index * SEG_LEN);
    const p2 = point(segment.x2, segment.y2, (index + 1) * SEG_LEN);
    project(p1, cameraX, cameraY, cameraZ, width, height);
    project(p2, cameraX, cameraY, cameraZ, width, height);
    if (p1.cameraZ <= CAMERA_DEPTH || p2.screenY >= p1.screenY || p2.screenY >= maxY) {
      segment.clip = maxY;
      continue;
    }
    const fade = Math.min(1, n / DRAW_DISTANCE);
    const grass = mixColor(index % 2 === 0 ? GRASS_A : GRASS_B, SKY_HORIZON, fade * 0.55);
    // The band is only visible above the crest in front of it (maxY).
    const bandBottom = Math.min(p1.screenY, maxY);
    const bandHeight = bandBottom - p2.screenY;
    if (bandHeight <= 0) {
      segment.clip = maxY;
      continue;
    }

    if (segment.river) {
      ctx.fillStyle = css(mixColor(RIVER, SKY_HORIZON, fade * 0.5));
      ctx.fillRect(0, p2.screenY, width, bandHeight);
      ctx.fillStyle = css(mixColor(RIVER_LIGHT, SKY_HORIZON, fade * 0.5));
      ctx.fillRect(0, p2.screenY + bandHeight * 0.3, width, 2);
    } else {
      ctx.fillStyle = css(grass);
      ctx.fillRect(0, p2.screenY, width, bandHeight);
    }

    if (segment.runway) {
      // Asphalt strip with a dashed centreline, seen in perspective,
      // clipped at the same crest line as the ground band.
      const t = (bandBottom - p2.screenY) / Math.max(1, p1.screenY - p2.screenY);
      const w1 = Math.round(lerp(p2.screenW, p1.screenW, t) * 0.14);
      const w2 = Math.round(p2.screenW * 0.14);
      const cx1 = Math.round(lerp(p2.screenX, p1.screenX, t));
      const cx2 = p2.screenX;
      ctx.fillStyle = css(mixColor([52, 52, 58], SKY_HORIZON, fade * 0.5));
      ctx.beginPath();
      ctx.moveTo(cx1 - w1, bandBottom);
      ctx.lineTo(cx2 - w2, p2.screenY);
      ctx.lineTo(cx2 + w2, p2.screenY);
      ctx.lineTo(cx1 + w1, bandBottom);
      ctx.closePath();
      ctx.fill();
      if (index % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const dw1 = Math.max(1, w1 * 0.06);
        const dw2 = Math.max(1, w2 * 0.06);
        ctx.beginPath();
        ctx.moveTo(cx1 - dw1, bandBottom);
        ctx.lineTo(cx2 - dw2, p2.screenY);
        ctx.lineTo(cx2 + dw2, p2.screenY);
        ctx.lineTo(cx1 + dw1, bandBottom);
        ctx.closePath();
        ctx.fill();
      }
    }

    segment.clip = maxY;
    maxY = p2.screenY;
    drawn.push({ segment, p1, p2 });
  }

  // Sprites, far to near so nearer ones paint over farther ones: rings
  // first, then the gum trees on each segment.
  for (let i = drawn.length - 1; i >= 0; i--) {
    const { segment, p1 } = drawn[i];
    if (segment.ring && !segment.ring.passed) {
      const ring = segment.ring;
      // The ring's x is an offset from the valley centreline; the segment's
      // x1 is the centreline's world position at this point of the valley.
      const rp = point(segment.x1 + ring.x, ring.alt, ring.z);
      project(rp, cameraX, cameraY, cameraZ, width, height);
      if (rp.cameraZ > CAMERA_DEPTH && rp.screenY < segment.clip) {
        const radius = Math.max(4, rp.scale * ring.radius * (width / 2));
        drawRing(ctx, rp.screenX, rp.screenY, radius, ring.id, ring.scored);
      }
    }
    for (const tree of segment.trees) {
      const tp = point(segment.x1 + tree.offset, segment.y1, segment.index * SEG_LEN);
      project(tp, cameraX, cameraY, cameraZ, width, height);
      // A tree's base sits on its segment's near edge, which is exactly the
      // clip line — so it passes on equality, while a tree hidden behind a
      // nearer crest (base below the line) stays culled.
      if (tp.cameraZ > CAMERA_DEPTH && tp.screenY <= segment.clip + 3 && tp.screenX > -80 && tp.screenX < width + 80) {
        const size = Math.max(6, tp.scale * 620 * tree.scale * (height / 2));
        drawTree(ctx, tp.screenX, tp.screenY, size, tree.kind);
      }
    }
  }

  // The plane's shadow on the ground below it, then the plane itself.
  const shadow = point(roadCenterX + plane.x, groundHeightAt(position), position + 420);
  project(shadow, cameraX, cameraY, cameraZ, width, height);
  if (shadow.cameraZ > CAMERA_DEPTH) {
    ctx.fillStyle = 'rgba(20, 30, 20, 0.30)';
    ctx.beginPath();
    ctx.ellipse(shadow.screenX, shadow.screenY, Math.max(8, shadow.scale * 900), Math.max(3, shadow.scale * 220), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const planeX = width / 2 + plane.bank * 46;
  const planeY = height * 0.66 - plane.pitch * 34;
  const planeSize = 118 + plane.speed * 0.06;
  drawPlane(ctx, planeX, planeY, planeSize, plane.bank, plane.pitch);
}
