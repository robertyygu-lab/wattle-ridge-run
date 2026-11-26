// input.js — keyboard and mouse input for Wattle Ridge Run.
// Arrow keys (or WASD) fly the plane; W/S spool the throttle; Enter starts,
// R restarts, M mutes, P pauses. Clicking the on-screen buttons does the
// same, and holding the mouse button and dragging steers as well.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0, // -1 down .. 1 up, from keys or mouse drag
    turn: 0, // -1 left .. 1 right, from keys or mouse drag
    throttleUp: false,
    throttleDown: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    pressed: new Set(), // keys pressed since last poll, for one-shot actions
  };

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'throttleUp',
    ArrowDown: 'down', KeyS: 'throttleDown',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown', ControlRight: 'throttleDown',
    Enter: 'start', KeyR: 'restart', KeyM: 'mute', KeyP: 'pause',
    Space: 'brake',
  };

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) input.pressed.add(action);
    keys.add(action);
  }

  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) keys.delete(action);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) / rect.width;
    input.mouseY = (event.clientY - rect.top) / rect.height;
  }

  function onMouseDown(event) {
    input.mouseSteer = true;
    onMouseMove(event);
  }

  function onMouseUp() {
    input.mouseSteer = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  // Recompute the analogue stick values from whatever is held right now.
  input.poll = function poll() {
    let pitch = 0;
    let turn = 0;
    if (keys.has('up')) pitch += 1;
    if (keys.has('down')) pitch -= 1;
    if (keys.has('left')) turn -= 1;
    if (keys.has('right')) turn += 1;
    if (input.mouseSteer) {
      turn = Math.max(-1, Math.min(1, (input.mouseX - 0.5) * 2.4));
      pitch = Math.max(-1, Math.min(1, (0.5 - input.mouseY) * 2.4));
    }
    input.pitch = pitch;
    input.turn = turn;
    input.throttleUp = keys.has('throttleUp');
    input.throttleDown = keys.has('throttleDown') || keys.has('brake');
  };

  // True once for a key pressed since the last poll, then cleared.
  input.wasPressed = function wasPressed(action) {
    const hit = input.pressed.has(action);
    input.pressed.delete(action);
    return hit;
  };

  input.clearPressed = function clearPressed() {
    input.pressed.clear();
  };

  return input;
}
