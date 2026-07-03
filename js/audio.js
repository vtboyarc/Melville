/* ============================================================
   Procedural soundscape for Melville's Manhattan.
   Everything is synthesized with the Web Audio API — wind, surf,
   a bell buoy off the Battery, gulls, footsteps, a steam whistle,
   harbor horns. No audio files are shipped.
   ============================================================ */

const BUOY = { x: -18, z: 100 }; // moored between the Battery and Liberty

let ctx = null;
let master = null;   // final gain — mute lives here
let ambience = null; // continuous layers, ducked while a card is open
let sfx = null;      // one-shots
let noiseBuf = null; // one shared white-noise buffer for every noise voice

let surfDistGain = null; // surf loudness by distance to the shoreline
let muted = false;
let ducked = false;
let bellTimer = 6;
let gullTimer = 9;

function makeNoise(seconds) {
  const buf = ctx.createBuffer(1, (ctx.sampleRate * seconds) | 0, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// a source over the shared noise buffer — looped for ambience, one-shot for FX
function noiseSource(loop = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = loop;
  return src;
}

// slow oscillator wired into an AudioParam — the breath in the ambience
function lfo(freq, depth, param) {
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(param);
  o.start();
}

function startAmbience() {
  // wind: filtered noise that swells and dies like weather, always on
  const wind = noiseSource(true);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 360;
  const wg = ctx.createGain();
  wg.gain.value = 0.045;
  wind.connect(lp).connect(wg).connect(ambience);
  wind.start(0, Math.random());
  lfo(0.07, 130, lp.frequency);
  lfo(0.19, 0.018, wg.gain);

  // surf: band of wash that rises as the walker nears the water
  const surf = noiseSource(true);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 620;
  bp.Q.value = 0.6;
  const swell = ctx.createGain(); // the rhythm of the harbor
  swell.gain.value = 0.62;
  lfo(0.08, 0.34, swell.gain);
  surfDistGain = ctx.createGain(); // the distance
  surfDistGain.gain.value = 0;
  surf.connect(bp).connect(swell).connect(surfDistGain).connect(ambience);
  surf.start(0, 0.7 + Math.random());
}

// a struck bell: inharmonic partials with exponential decays
function bell(f, gain, dest, when = 0) {
  const t0 = ctx.currentTime + when;
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(dest);
  for (const [mult, amp] of [[1, 1], [2.42, 0.45], [3.01, 0.3], [4.27, 0.16]]) {
    const o = ctx.createOscillator();
    o.frequency.value = f * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4 / mult);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 2.6);
  }
}

// a gull: a cluster of fast downward cries
function gullCry(gain) {
  const t0 = ctx.currentTime;
  const n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const s = t0 + i * (0.2 + Math.random() * 0.14);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1100 + Math.random() * 300, s);
    o.frequency.exponentialRampToValueAtTime(620 + Math.random() * 120, s + 0.17);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 1.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(gain, s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
    o.connect(f).connect(g).connect(ambience);
    o.start(s);
    o.stop(s + 0.24);
  }
}

// one footfall: a short noise tick, boomier on the pier planks
function step(wood) {
  const t0 = ctx.currentTime;
  const src = noiseSource();
  src.playbackRate.value = 0.85 + Math.random() * 0.3;
  const f = ctx.createBiquadFilter();
  if (wood) {
    f.type = 'bandpass';
    f.frequency.value = 230 + Math.random() * 70;
    f.Q.value = 1.2;
  } else {
    f.type = 'highpass';
    f.frequency.value = 1400;
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime((wood ? 0.17 : 0.05) * (0.8 + Math.random() * 0.4), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (wood ? 0.09 : 0.055));
  src.connect(f).connect(g).connect(sfx);
  src.start(t0, Math.random() * 1.5, 0.12);
}

// the El's two-note steam whistle, with a breath of steam under it
function whistle(gain) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(gain, t0 + 0.1);
  out.gain.setValueAtTime(gain, t0 + 0.85);
  out.gain.linearRampToValueAtTime(0, t0 + 1.3);
  out.connect(sfx);
  for (const f of [466, 554]) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.012);
    const g = ctx.createGain();
    g.gain.value = 0.4;
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 1.35);
  }
  const n = noiseSource(true);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 1.1;
  const ng = ctx.createGain();
  ng.gain.value = 0.22;
  n.connect(bp).connect(ng).connect(out);
  n.start(t0);
  n.stop(t0 + 1.35);
}

// a steamship's horn, far across the water
function horn(freq, gain, when, dur) {
  const t0 = ctx.currentTime + when;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(gain, t0 + 0.5);
  out.gain.setValueAtTime(gain, t0 + dur - 0.7);
  out.gain.linearRampToValueAtTime(0, t0 + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 340;
  lp.connect(out).connect(sfx);
  for (const [type, mult, amp] of [['sawtooth', 1, 0.45], ['sine', 1, 0.6], ['sine', 2.01, 0.12]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.value = amp;
    o.connect(g).connect(lp);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }
}

// the soft riffle of paper as a card opens
function pageTurn() {
  const t0 = ctx.currentTime;
  const src = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700, t0);
  bp.frequency.exponentialRampToValueAtTime(2300, t0 + 0.2);
  bp.Q.value = 1.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.045, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
  src.connect(bp).connect(g).connect(sfx);
  src.start(t0, Math.random(), 0.3);
}

export const audio = {
  init() {
    if (ctx) {
      ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    ambience = ctx.createGain();
    ambience.connect(master);
    sfx = ctx.createGain();
    sfx.connect(master);
    noiseBuf = makeNoise(2);
    startAmbience();
    ctx.resume();
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
    // iOS sometimes re-suspends; any later touch wakes it again
    window.addEventListener('pointerdown', () => {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    });
  },

  // dt in seconds; o = { px, pz, shore, ducked }
  update(dt, o) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;

    const shoreK = Math.max(0, Math.min(1, 1 - o.shore / 34));
    surfDistGain.gain.setTargetAtTime(0.015 + shoreK * 0.12, t, 0.4);

    if (o.ducked !== ducked) {
      ducked = o.ducked;
      ambience.gain.setTargetAtTime(ducked ? 0.35 : 1, t, 0.3);
    }

    bellTimer -= dt;
    if (bellTimer <= 0) {
      bellTimer = 9 + Math.random() * 5;
      const d = Math.hypot(o.px - BUOY.x, o.pz - BUOY.z);
      const g = Math.max(0, 1 - d / 190);
      if (g > 0.03) bell(233, 0.02 + 0.2 * g * g, ambience);
    }

    gullTimer -= dt;
    if (gullTimer <= 0) {
      gullTimer = 6 + Math.random() * 9;
      const nearHarbor = o.pz > 40;
      if (nearHarbor || Math.random() < 0.35) gullCry(nearHarbor ? 0.055 : 0.03);
    }
  },

  play(name, opts = {}) {
    if (!ctx || ctx.state !== 'running') return;
    switch (name) {
      case 'step': step(false); break;
      case 'stepWood': step(true); break;
      case 'chime': // the site is charted
        bell(494, 0.16, sfx);
        bell(741, 0.07, sfx, 0.13);
        break;
      case 'bell': bell(330, 0.1, sfx); break;
      case 'pageTurn': pageTurn(); break;
      case 'whistle': whistle(opts.gain ?? 0.25); break;
      case 'horn': horn(opts.freq ?? 98, opts.gain ?? 0.35, opts.when ?? 0, opts.dur ?? 2.4); break;
      case 'gull': gullCry(0.05); break;
    }
  },

  setMuted(b) {
    muted = b;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  },
  get muted() { return muted; },
};
