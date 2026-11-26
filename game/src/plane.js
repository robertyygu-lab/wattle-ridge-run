// plane.js — the Kookaburra K-1 bush plane: its flight model, fuel, stall
// behaviour and scoring. Speeds are in knots for the HUD; distances and
// heights are in feet (one world unit is one foot).
import { SEG_LEN, groundHeightAt, curveAt } from './terrain.js';

export const MAX_SPEED = 285; // knots, flat out
export const CRUISE_SPEED = 175; // knots, comfortable cruise
export const STALL_SPEED = 62; // knots, below this the wing gives up
export const MAX_ALT = 2600; // feet, the valley's ceiling for this flight
export const FUEL_START = 100; // percent

export function createPlane() {
  return {
    z: 0, // distance along the course, feet
    x: 0, // lateral position, feet from the valley centreline
    alt: groundHeightAt(0), // feet above sea level, starting on the strip
    speed: 0, // knots
    throttle: 0, // 0..1
    pitch: 0, // -1 (nose down) .. 1 (nose up), smoothed
    bank: 0, // -1 (left) .. 1 (right), smoothed
    heading: 90, // degrees, 090 is due east down the valley
    verticalSpeed: 0, // feet per minute, for the HUD
    fuel: FUEL_START,
    airborne: false,
    score: 0,
    ringsHit: 0,
    landed: false,
    landedSmooth: false,
    elapsed: 0, // seconds since takeoff
  };
}

// One physics step. `input` carries -1..1 pitch/turn values plus throttle
// up/down flags; `course` is the built valley; `dt` is seconds.
export function updatePlane(plane, input, course, dt) {
  const ground = groundHeightAt(plane.z);
  const onGround = plane.alt <= ground + 2;

  // Throttle: W/S (or Shift/Ctrl) spool the engine up and down.
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.55);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.7);
  if (plane.fuel <= 0) plane.throttle = 0;

  // Smooth the stick inputs so the plane banks and pitches instead of snapping.
  plane.pitch += (input.pitch - plane.pitch) * Math.min(1, dt * 4);
  plane.bank += (input.turn - plane.bank) * Math.min(1, dt * 4);

  // Speed chases the throttle setting; drag grows with the square of speed.
  const targetSpeed = plane.throttle * MAX_SPEED;
  const drag = 0.35 + (plane.speed / MAX_SPEED) * 0.9;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * drag * 0.8);
  if (plane.speed < 0) plane.speed = 0;

  // Turning: banking swings the heading and drifts the plane sideways; the
  // valley's own curve pushes the plane outward unless the pilot corrects.
  // The push stays well under the plane's own lateral authority, so a curve
  // demands steering without ever becoming unrecoverable.
  // Heading is the valley's direction plus the bank: the course always runs
  // east down the valley, so a banked plane reads a few degrees off 090
  // instead of spinning away from it.
  plane.heading = 90 + plane.bank * 18 + curveAt(plane.z) * 6;
  const curvePush = curveAt(plane.z) * (plane.speed / MAX_SPEED) * 170;
  plane.x += (plane.bank * plane.speed * 2.6 - curvePush) * dt;
  const lateralLimit = 4600;
  if (plane.x > lateralLimit) plane.x = lateralLimit;
  if (plane.x < -lateralLimit) plane.x = -lateralLimit;

  // Lift and climb: pitch trades speed for height, and a slow wing sinks.
  const feetPerSecond = plane.speed * 1.68781; // knots to ft/s
  let climbRate = plane.pitch * feetPerSecond * 0.42;
  if (plane.speed < STALL_SPEED && plane.alt > ground + 40) {
    climbRate -= (STALL_SPEED - plane.speed) * 9; // stalled wing drops
  }
  if (onGround && plane.speed < 70) climbRate = 0; // still rolling on the strip
  if (onGround && plane.speed >= 70 && plane.pitch > 0.15) {
    plane.airborne = true; // rotation speed reached, wheels leave the strip
  }
  plane.alt += climbRate * dt;
  if (plane.alt < ground) plane.alt = ground;
  if (plane.alt > MAX_ALT) plane.alt = MAX_ALT;
  plane.verticalSpeed = climbRate * 60;

  // Forward motion and the clock.
  plane.z += feetPerSecond * dt;
  if (plane.airborne) plane.elapsed += dt;

  // Fuel: the engine drinks faster at full throttle, but a full tank lasts
  // the whole valley at cruise with a little to spare — running dry should
  // be the pilot's fault, not the maths'.
  if (plane.throttle > 0 && plane.speed > 5) {
    plane.fuel -= (0.12 + plane.throttle * 0.35) * dt;
    if (plane.fuel < 0) plane.fuel = 0;
  }

  // Touchdown on the finish strip after the last ring: a gentle arrival
  // earns the smooth-landing bonus.
  const onFinishStrip = plane.z >= course.finishZ && plane.z < course.finishZ + 5200;
  if (onFinishStrip && plane.airborne && plane.alt <= ground + 4 && plane.speed < 130) {
    plane.landed = true;
    plane.landedSmooth = plane.verticalSpeed > -420 && plane.speed < 120;
    if (plane.landedSmooth) plane.score += 250;
  }

  return plane;
}

// True while the plane is in a state that ends the flight in a crash.
// A gentle touchdown on the finish strip is a landing, never a crash, so
// it is checked first and excluded here. A plane that has just rotated is
// still within a couple of feet of the strip but climbing hard — that is a
// takeoff, not a crash — so the ground only claims a plane that is level
// or sinking when it meets it (vertical speed under 2 ft/s, in feet/min).
export function crashReason(plane, course) {
  if (plane.landed) return null;
  const ground = groundHeightAt(plane.z);
  const onFinishStrip = plane.z >= course.finishZ && plane.z < course.finishZ + 5200;
  if (onFinishStrip && plane.speed < 130 && plane.verticalSpeed > -500) return null;
  if (plane.alt <= ground + 2 && plane.airborne && plane.verticalSpeed < 120) {
    if (plane.fuel <= 0) return 'fuel';
    if (plane.speed <= STALL_SPEED + 8) return 'stall';
    return 'terrain';
  }
  return null;
}

// Score for threading a ring: 100 points, plus 50 for a centred pass.
export function scoreRing(plane, ring) {
  const centred = Math.abs(plane.alt - ring.alt) < 70 && Math.abs(plane.x - ring.x) < 260;
  const points = centred ? 150 : 100;
  plane.score += points;
  plane.ringsHit += 1;
  ring.passed = true;
  ring.scored = true;
  return points;
}
