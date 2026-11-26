// audio.js — small WebAudio sounds for Wattle Ridge Run, synthesised on the
// spot with no audio files: a propeller drone that follows the throttle, a
// two-note chime for threading a ring, a thud for a crash and a click for
// the menus. Nothing plays until the pilot first interacts, as browsers
// require, and M mutes everything.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  // Call from any user gesture (start button, first keypress) to unlock sound.
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  // The engine drone follows throttle and speed: louder and higher as the
  // Kookaburra spools up, silent on the ground with the engine off.
  function engine(throttle, speed) {
    if (!ctx || muted) return;
    const target = throttle > 0.02 ? 0.02 + throttle * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.12, ctx.currentTime, 0.1);
  }

  function tone(freq, start, duration, volume, type) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.05);
  }

  function chime() {
    tone(880, 0, 0.22, 0.16);
    tone(1318.5, 0.09, 0.3, 0.14);
  }

  function click() {
    tone(660, 0, 0.08, 0.1, 'square');
  }

  function thud() {
    if (!ctx || muted) return;
    const length = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    tone(90, 0, 0.4, 0.3, 'sine');
  }

  function setMuted(value) {
    muted = value;
    if (engineGain && ctx) {
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.03, ctx.currentTime, 0.05);
    }
  }

  return { unlock, engine, chime, click, thud, setMuted, isMuted: () => muted };
}
