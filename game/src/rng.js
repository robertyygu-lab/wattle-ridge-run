// rng.js — a small deterministic random-number generator for Wattle Ridge Run.
// The course is generated from one fixed seed, so every flight sees the same
// valley, the same river crossings and the same ring positions.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a generator.
export function range(rand, min, max) {
  return min + rand() * (max - min);
}

// Pick an integer in [min, max] from a generator.
export function intRange(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

// Deterministic 1-D value noise: smooth bumps from a seed, used for the
// distant ridge silhouettes so they never change between flights.
export function ridgeNoise(seed, x) {
  const s = Math.sin(x * 0.021 + seed * 1.7) * 0.55
    + Math.sin(x * 0.008 + seed * 3.1) * 0.85
    + Math.sin(x * 0.047 + seed * 0.4) * 0.3;
  return s / 1.7;
}
