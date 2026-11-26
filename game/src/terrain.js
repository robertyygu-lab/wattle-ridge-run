// terrain.js — builds the Wattle Ridge valley: one fixed course of track
// segments, the river crossings, the gum trees, the start and finish strips
// and the eight target rings. Everything is derived from the course seed,
// so the valley is identical on every run and every screenshot.
import { mulberry32, range, intRange } from './rng.js';

export const SEG_LEN = 200; // world units per course segment
export const ROAD_HALF = 2200; // half-width of the valley floor in world units
export const COURSE_SEGMENTS = 420; // 84,000 world units of valley
export const RING_COUNT = 8;

const RING_Z = [6000, 14000, 22000, 30000, 38000, 46000, 54000, 62000];

// The valley bends gently: a sum of slow sines, so the road curves left and
// right without ever doubling back on itself.
export function curveAt(z) {
  return (
    1.9 * Math.sin(z * 0.00008)
    + 1.2 * Math.sin(z * 0.00021 + 1.7)
    + 0.6 * Math.sin(z * 0.00053 + 4.1)
  );
}

// Rolling ground height in feet at distance z along the course.
export function groundHeightAt(z) {
  return (
    430 * Math.sin(z * 0.00011)
    + 260 * Math.sin(z * 0.000043 + 2.0)
    + 130 * Math.sin(z * 0.00031 + 4.0)
  );
}

// True while z lies inside one of the two river crossings.
export function inRiver(z) {
  return (z >= 18000 && z < 26200) || (z >= 52000 && z < 58400);
}

function makeSegment(index) {
  const z1 = index * SEG_LEN;
  const z2 = z1 + SEG_LEN;
  return {
    index,
    curve: curveAt(z1),
    y1: groundHeightAt(z1),
    y2: groundHeightAt(z2),
    river: inRiver(z1),
    runway: index < 26 || (index >= 372 && index < 398),
    trees: [],
    ring: null,
  };
}

export function buildCourse() {
  const rand = mulberry32(20261126);
  const segments = [];
  let x = 0;
  for (let i = 0; i < COURSE_SEGMENTS; i++) {
    const seg = makeSegment(i);
    seg.x1 = x;
    x += seg.curve * SEG_LEN * 0.9;
    seg.x2 = x;
    segments.push(seg);
  }

  // Gum trees along the valley edges, denser away from the strips and river.
  for (let i = 4; i < COURSE_SEGMENTS - 4; i++) {
    const seg = segments[i];
    if (seg.runway || seg.river) continue;
    if (rand() < 0.55) {
      const side = rand() < 0.5 ? -1 : 1;
      seg.trees.push({
        offset: side * range(rand, 2600, 5200),
        scale: range(rand, 0.8, 1.6),
        kind: intRange(rand, 0, 2),
      });
    }
    if (rand() < 0.22) {
      const side = rand() < 0.5 ? -1 : 1;
      seg.trees.push({
        offset: side * range(rand, 5600, 8200),
        scale: range(rand, 1.1, 2.1),
        kind: intRange(rand, 0, 2),
      });
    }
  }

  // The eight target rings: each hangs over the valley at a set height and
  // lateral offset from the centreline, so the pilot must steer and climb
  // to thread them. x is the offset from the valley centre, in feet — the
  // plane's x is measured the same way.
  const rings = RING_Z.map((z, i) => {
    const segIndex = Math.floor(z / SEG_LEN);
    const seg = segments[segIndex];
    const ring = {
      id: i + 1,
      z,
      x: (i % 2 === 0 ? 1 : -1) * range(rand, 300, 1500),
      alt: groundHeightAt(z) + range(rand, 520, 1050),
      radius: 190,
      passed: false,
      scored: false,
    };
    seg.ring = ring;
    return ring;
  });

  return {
    segments,
    rings,
    length: COURSE_SEGMENTS * SEG_LEN,
    finishZ: 372 * SEG_LEN,
  };
}
