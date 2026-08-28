// ============================================================
// src/audio.js — WebAudio synthesis, no audio files
//
// Beam hum, prism chime, burn hiss, destruction, wall damage,
// altar tone. Pooled oscillators, master gain, mute toggle.
// ============================================================

let ctx = null;
let masterGain = null;
let muted = false;
let muteBtn = null;
// Overall SFX master level. Dropped from 0.5 to 0.4 (-20%) in the polish pass to
// give the compressor/lowpass headroom and take the edge off loud stacks.
const MASTER_GAIN = 0.4;

// Pools
let hum = null;
let humGain = null;
let burnNoise = null;
let burnGain = null;
let altarOsc = null;
let altarGain = null;

const MAX_VOICES = 6;
let activeVoices = 0;

export function initAudio() {
  // Create mute button (DOM, top-right corner)
  muteBtn = document.createElement('div');
  muteBtn.textContent = '🔊';
  muteBtn.style.cssText = 'position:fixed;top:8px;right:8px;font-size:20px;cursor:pointer;z-index:99999;user-select:none;';
  muteBtn.addEventListener('pointerdown', toggleMute);
  document.body.appendChild(muteBtn);
}

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    // Overall SFX gain reduced 20% (0.5 -> 0.4) per polish pass. See MASTER_GAIN.
    masterGain.gain.value = muted ? 0 : MASTER_GAIN;
    // Master softening chain: every voice routes through masterGain, so a single
    // compressor + gentle lowpass at the tail tames ear-piercing clicks/beeps
    // and stops loud stacks (many SFX at once) from clipping.
    //   masterGain -> compressor -> lowpass(4500Hz) -> destination
    const masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -18;  // start gently compressing above -18 dB
    masterComp.knee.value = 24;        // soft knee for a smooth, un-pumpy limit
    masterComp.ratio.value = 4;        // 4:1 — limiter-ish but musical
    masterComp.attack.value = 0.003;
    masterComp.release.value = 0.25;
    const masterLp = ctx.createBiquadFilter();
    masterLp.type = 'lowpass';
    masterLp.frequency.value = 4500;   // roll off the harsh top end
    masterLp.Q.value = 0.707;          // Butterworth (no resonant peak)
    masterGain.connect(masterComp);
    masterComp.connect(masterLp);
    masterLp.connect(ctx.destination);
    setupHum();
    setupBurnNoise();
    setupAltarTone();
    setupSeaAmbience();
  } catch (e) { return null; }
  return ctx;
}

// ============================================================
// SEA AMBIENCE — continuous filtered PINK NOISE (the ocean bed), with its gain
// modulated by a slow 0.1Hz LFO so it rhythmically swells and recedes like
// waves washing against the stone battlement. No discrete bursts, no drone.
// ============================================================
let breezeGain = null;      // base sea-bed level (also the mute/reset handle)
let waveLfoGain = null;     // LFO depth → adds to breezeGain via the LFO
let waveLfo = null;         // 0.1Hz sine LFO
function setupSeaAmbience() {
  // --- True pink noise via Paul Kellet's economical filter ---
  const bufLen = ctx.sampleRate * 4; // 4s loop, long enough to avoid obvious tiling
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufLen; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    d[i] = pink * 0.11; // normalise the pink sum toward [-1,1]
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  // Lowpass to soften into a watery/airy bed (roll off the hiss).
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;

  // Base gain = quiet steady bed; the LFO adds a swelling amount on top.
  breezeGain = ctx.createGain();
  breezeGain.gain.value = 0.05;

  // 0.1Hz LFO (one full wave every 10s) → modulates a depth gain that sums into
  // the base bed, so the noise breathes in and out like surf.
  waveLfo = ctx.createOscillator();
  waveLfo.type = 'sine';
  waveLfo.frequency.value = 0.1; // ocean-wave period ~10s
  waveLfoGain = ctx.createGain();
  waveLfoGain.gain.value = 0.035; // swell depth (± around the base)
  waveLfo.connect(waveLfoGain);
  // Route: noise -> lp -> breezeGain -> master. LFO adds to breezeGain.gain.
  waveLfoGain.connect(breezeGain.gain);
  src.connect(lp).connect(breezeGain).connect(masterGain);
  src.start();
  waveLfo.start();
}

// Kept for the main-loop call site; the sea is now fully LFO-driven so this is
// a no-op (no per-frame work needed).
export function updateSeaAmbience(dt) { /* LFO-driven, nothing to tick */ }

function toggleMute(e) {
  if (e) e.preventDefault();
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : MASTER_GAIN;
  if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
}

// --- Beam tone: warm sunlight shimmer, not a sci-fi drone. A soft triangle
// through a lowpass, quiet, pitch/volume gently tracking throughput. ---
function setupHum() {
  hum = ctx.createOscillator();
  hum.type = 'triangle';       // warm, not buzzy
  hum.frequency.value = 160;
  humGain = ctx.createGain();
  humGain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  hum.connect(filter).connect(humGain).connect(masterGain);
  hum.start();
}

export function updateHum(throughput) {
  if (!humGain) return;
  // throughput: 0 to ~50. Keep it quiet and warm — a shimmer of focused light.
  const vol = Math.min(0.06, throughput * 0.0014);
  const pitch = 150 + throughput * 0.8;
  humGain.gain.value = vol;
  if (hum) hum.frequency.value = pitch;
}

// --- Burn hiss: filtered noise while beam contacts hull ---
function setupBurnNoise() {
  const bufSize = ctx.sampleRate * 0.5;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  burnNoise = ctx.createBufferSource();
  burnNoise.buffer = buf;
  burnNoise.loop = true;
  burnGain = ctx.createGain();
  burnGain.gain.value = 0;
  // Woody sizzle bed: a bandpass around 1.2kHz (roasting timber), not a thin
  // 3kHz white hiss. The sharp POPS of burning wood are added by the crackle
  // pulse system (updateCrackle) — this is just the underlying sizzle.
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.6;
  burnNoise.connect(filter).connect(burnGain).connect(masterGain);
  burnNoise.start();
}

export function updateBurnHiss(intensity) {
  if (!burnGain) return;
  // intensity: 0 to 1 (fraction of enemies being burned). Quieter now — the
  // burn sizzle was distracting; keep it a faint bed under the crackle.
  burnGain.gain.value = Math.min(0.03, intensity * 0.04);
}

// --- Prism chime: short bell ---
export function playPrismChime() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 880;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.connect(g).connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
  osc.onended = () => activeVoices--;
}

// --- Destruction: thump + noise burst ---
export function playDestruction() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  // Duck hum briefly
  if (humGain) { humGain.gain.value *= 0.3; setTimeout(() => { if(humGain) humGain.gain.value /= 0.3; }, 200); }
  // Thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(g).connect(masterGain);
  osc.start(); osc.stop(ctx.currentTime + 0.25);
  // Noise burst
  const bufLen = ctx.sampleRate * 0.08;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random()*2-1) * (1 - i/bufLen);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.2, ctx.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  src.connect(ng).connect(masterGain);
  src.start(); src.onended = () => activeVoices--;
  osc.onended = () => {};
}

// --- Shield deflection: metallic ping ---
let lastDeflectTime = 0;
export function playDeflect() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  // Rate-limit: max once per 0.2s to avoid spam
  const now = ctx.currentTime;
  if (now - lastDeflectTime < 0.2) return;
  lastDeflectTime = now;
  activeVoices++;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 600;
  osc.connect(hp).connect(g).connect(masterGain);
  osc.start(now); osc.stop(now + 0.12);
  osc.onended = () => activeVoices--;
}

// --- Shield deflection: ringing BRONZE PLATE clang. Metallic inharmonic sine
// cluster at 420 / 680 / 1150 Hz (a non-harmonic ratio set = struck bronze),
// with a fast attack and a short ringing decay. ---
let lastRicochetTime = 0;
export function playRicochet() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  const now = ctx.currentTime;
  if (now - lastRicochetTime < 0.08) return;
  lastRicochetTime = now;
  activeVoices++;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(masterGain);
  // The three inharmonic partials of the bronze plate.
  const partials = [
    { f: 420,  g: 0.12, decay: 0.35 },
    { f: 680,  g: 0.08, decay: 0.28 },
    { f: 1150, g: 0.05, decay: 0.20 },
  ];
  for (const p of partials) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    // Slight detune per strike so repeats don't sound identical/mechanical.
    osc.frequency.value = p.f * (1 + (Math.random() - 0.5) * 0.01);
    const g = ctx.createGain();
    g.gain.setValueAtTime(p.g, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + p.decay);
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + p.decay + 0.05);
  }
  // Brief metallic strike transient for the "clang" bite.
  const tLen = Math.ceil(ctx.sampleRate * 0.012);
  const tBuf = ctx.createBuffer(1, tLen, ctx.sampleRate);
  const td = tBuf.getChannelData(0);
  for (let i = 0; i < tLen; i++) td[i] = (Math.random() * 2 - 1) * (1 - i / tLen);
  const tSrc = ctx.createBufferSource(); tSrc.buffer = tBuf;
  const tHp = ctx.createBiquadFilter(); tHp.type = 'highpass'; tHp.frequency.value = 2000;
  const tG = ctx.createGain(); tG.gain.value = 0.05;
  tSrc.connect(tHp).connect(tG).connect(out);
  tSrc.start(now); tSrc.stop(now + 0.02);
  setTimeout(() => { activeVoices--; }, 420);
}

// --- Wall breach: ancient war drum (TYMPANON). A struck taut skin = a sine
// with an exponential pitch drop 120Hz -> 45Hz over 0.2s, through a lowpass for
// a warm hollow body. A brief wooden crunch layers on top for the hull hit. ---
export function playWallHit() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const now = ctx.currentTime;

  // Tympanon membrane: 120 -> 45 Hz over 0.2s, warm body via lowpass.
  const drum = ctx.createOscillator();
  drum.type = 'sine';
  drum.frequency.setValueAtTime(120, now);
  drum.frequency.exponentialRampToValueAtTime(45, now + 0.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(320, now);
  lp.frequency.exponentialRampToValueAtTime(120, now + 0.3);
  const drumG = ctx.createGain();
  drumG.gain.setValueAtTime(0.3, now);
  drumG.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  drum.connect(lp).connect(drumG).connect(masterGain);
  drum.start(now); drum.stop(now + 0.5);

  // Wooden hull crunch on top: short mid-band noise burst, fast decay.
  const crLen = Math.ceil(ctx.sampleRate * 0.08);
  const crBuf = ctx.createBuffer(1, crLen, ctx.sampleRate);
  const cd = crBuf.getChannelData(0);
  for (let i = 0; i < crLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / crLen);
  const crSrc = ctx.createBufferSource();
  crSrc.buffer = crBuf;
  const crBp = ctx.createBiquadFilter();
  crBp.type = 'bandpass';
  crBp.frequency.setValueAtTime(400, now);
  crBp.frequency.exponentialRampToValueAtTime(170, now + 0.08);
  crBp.Q.value = 1.2;
  const crG = ctx.createGain();
  crG.gain.setValueAtTime(0.16, now);
  crG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  crSrc.connect(crBp).connect(crG).connect(masterGain);
  crSrc.start(now); crSrc.stop(now + 0.11);

  drum.onended = () => activeVoices--;
}

// --- Helios / Priest: resonant TEMPLE BELL. A struck fundamental with a stack
// of decaying HARMONIC overtones (integer multiples), each higher partial
// quieter and faster-decaying, so the bell rings out warm and sacred. ---
export function playHeliosHorn() {
  if (!ensureCtx()) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(masterGain);

  const fund = 392; // ~G4 — a deep, resonant temple bell
  // Harmonic overtone series (1x..6x): quieter and shorter as they go up.
  const harmonics = [
    { mult: 1, g: 0.16, decay: 3.2 },
    { mult: 2, g: 0.10, decay: 2.6 },
    { mult: 3, g: 0.06, decay: 2.0 },
    { mult: 4, g: 0.04, decay: 1.5 },
    { mult: 5, g: 0.025, decay: 1.1 },
    { mult: 6, g: 0.015, decay: 0.8 },
  ];
  for (const h of harmonics) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = fund * h.mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(h.g, now + 0.01);      // sharp strike attack
    g.gain.exponentialRampToValueAtTime(0.0005, now + h.decay); // long ring
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + h.decay + 0.1);
  }
  // Soft mallet strike transient to seat the attack.
  const tLen = Math.ceil(ctx.sampleRate * 0.01);
  const tBuf = ctx.createBuffer(1, tLen, ctx.sampleRate);
  const td = tBuf.getChannelData(0);
  for (let i = 0; i < tLen; i++) td[i] = (Math.random() * 2 - 1) * (1 - i / tLen);
  const tSrc = ctx.createBufferSource(); tSrc.buffer = tBuf;
  const tBp = ctx.createBiquadFilter(); tBp.type = 'bandpass'; tBp.frequency.value = 1800;
  const tG = ctx.createGain(); tG.gain.value = 0.05;
  tSrc.connect(tBp).connect(tG).connect(out);
  tSrc.start(now); tSrc.stop(now + 0.015);
}

// --- Zeus: deep acoustic THUNDER — a modulated low-frequency noise sweep that
// rolls and rumbles (not an 8-bit zap). A short crack transient seats the
// strike, then a long low-passed noise bed sweeps down while a slow tremolo
// LFO makes it "roll" like real thunder receding across the bay. ---
export function playZeusThunder() {
  if (!ensureCtx()) return;
  const now = ctx.currentTime;

  // Short crack transient (the initial strike), quick decay.
  const crackLen = Math.ceil(ctx.sampleRate * 0.12);
  const cBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
  const cd = cBuf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 1.5);
  const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
  const cHp = ctx.createBiquadFilter(); cHp.type = 'highpass'; cHp.frequency.value = 800;
  const cG = ctx.createGain();
  cG.gain.setValueAtTime(0.35, now);
  cG.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
  cSrc.connect(cHp).connect(cG).connect(masterGain);
  cSrc.start(now); cSrc.stop(now + 0.18);

  // Rolling rumble bed: long low-passed noise, filter sweeping 320 -> 55 Hz as
  // the thunder rolls away.
  const dur = 2.4;
  const rumLen = Math.ceil(ctx.sampleRate * dur);
  const rBuf = ctx.createBuffer(1, rumLen, ctx.sampleRate);
  const rd = rBuf.getChannelData(0);
  for (let i = 0; i < rumLen; i++) rd[i] = Math.random() * 2 - 1;
  const rSrc = ctx.createBufferSource(); rSrc.buffer = rBuf;
  const rLp = ctx.createBiquadFilter();
  rLp.type = 'lowpass';
  rLp.frequency.setValueAtTime(320, now);
  rLp.frequency.exponentialRampToValueAtTime(55, now + dur * 0.9);
  const rG = ctx.createGain();
  rG.gain.setValueAtTime(0.0, now);
  rG.gain.linearRampToValueAtTime(0.34, now + 0.08); // onset behind the crack
  rG.gain.exponentialRampToValueAtTime(0.001, now + dur);

  // Tremolo LFO (~4Hz, fading) modulates the rumble gain → the "rolling" of
  // thunder. The LFO output is scaled and summed into rG.gain.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5.5, now);
  lfo.frequency.linearRampToValueAtTime(2.5, now + dur); // slows as it recedes
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.setValueAtTime(0.12, now);
  lfoDepth.gain.exponentialRampToValueAtTime(0.005, now + dur);
  lfo.connect(lfoDepth).connect(rG.gain);

  rSrc.connect(rLp).connect(rG).connect(masterGain);
  rSrc.start(now + 0.03); rSrc.stop(now + dur + 0.05);
  lfo.start(now); lfo.stop(now + dur + 0.05);
}

// --- Altar tone: soft rising note while lit ---
function setupAltarTone() {
  altarOsc = ctx.createOscillator();
  altarOsc.type = 'sine';
  altarOsc.frequency.value = 220;
  altarGain = ctx.createGain();
  altarGain.gain.value = 0;
  altarOsc.connect(altarGain).connect(masterGain);
  altarOsc.start();
}

export function updateAltarTone(litCount, anyOverheated) {
  if (!altarGain) return;
  altarGain.gain.value = litCount > 0 ? Math.min(0.06, litCount * 0.02) : 0;
  if (altarOsc) altarOsc.frequency.value = anyOverheated ? 150 : 220 + litCount * 30;
}

export function resetAudio() {
  silenceBattleAudio();
  // Restore the ambient sea bed + wave LFO depth for the new run.
  if (breezeGain) breezeGain.gain.value = 0.05;
  if (waveLfoGain) waveLfoGain.gain.value = 0.035;
}

// Immediately silence all continuous battle loops (beam hum, burn hiss, altar
// tone, wood crackle). Used on game over so only the defeat sound is left.
// One-shot voices already in flight (destruction, gong) are unaffected.
export function silenceBattleAudio() {
  if (humGain) humGain.gain.value = 0;
  if (burnGain) burnGain.gain.value = 0;
  if (altarGain) altarGain.gain.value = 0;
  // Silence the sea bed: zero the LFO depth first so it can't push the gain
  // back up, then zero the base level.
  if (waveLfoGain) waveLfoGain.gain.value = 0;
  if (breezeGain) breezeGain.gain.value = 0;
  for (const cv of crackleVoices) { stopCrackleVoice(cv); }
  crackleVoices.length = 0;
}

// ============================================================
// WOOD CRACKLE — per-ship looping: flame hiss + random pops
// Max 4 simultaneous voices (highest heat ships).
// ============================================================
const MAX_CRACKLE_VOICES = 4;
const crackleVoices = []; // { enemyId, hissGain, hissSrc, popInterval, nextPop, filterNode, gain }

// Called each frame from damage.js or main — pass array of {id, heat} for all burning ships
export function updateCrackle(burningShips) {
  if (!ensureCtx()) return;

  // Sort by heat descending, take top MAX_CRACKLE_VOICES
  burningShips.sort((a, b) => b.heat - a.heat);
  const topShips = burningShips.slice(0, MAX_CRACKLE_VOICES);
  const topIds = topShips.map(s => s.id);

  // Remove voices for ships no longer in top burning
  for (let i = crackleVoices.length - 1; i >= 0; i--) {
    if (!topIds.includes(crackleVoices[i].enemyId)) {
      stopCrackleVoice(crackleVoices[i]);
      crackleVoices.splice(i, 1);
    }
  }

  // Add/update voices for top burning ships
  for (const ship of topShips) {
    let voice = crackleVoices.find(v => v.enemyId === ship.id);
    if (!voice) {
      voice = startCrackleVoice(ship.id);
      if (voice) crackleVoices.push(voice);
    }
    if (voice) {
      // Scale volume and pop rate by heat (0 to 1)
      const heat = Math.min(1, ship.heat);
      voice.gain.gain.value = 0.015 + heat * 0.035; // hiss volume (quieter)
      voice.popRate = 2 + heat * 4; // 2 to 6 pops/sec
    }
  }

  // Fire pops on schedule
  const now = ctx.currentTime;
  for (const voice of crackleVoices) {
    if (now >= voice.nextPop) {
      fireCracklePop(voice);
      voice.nextPop = now + (1 / voice.popRate) * (0.5 + Math.random());
    }
  }
}

function startCrackleVoice(enemyId) {
  if (!ctx) return null;
  // Hiss: looping noise through a highpass
  const bufLen = ctx.sampleRate * 0.3;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2500;
  const gain = ctx.createGain();
  gain.gain.value = 0.03;
  src.connect(filter).connect(gain).connect(masterGain);
  src.start();
  return {
    enemyId,
    hissSrc: src,
    gain,
    filterNode: filter,
    popRate: 3,
    nextPop: ctx.currentTime + Math.random() * 0.3,
  };
}

function fireCracklePop(voice) {
  if (!ctx || activeVoices >= MAX_VOICES) return;
  // Short noise burst 15-40ms through bandpass 800-2000Hz
  const duration = 0.015 + Math.random() * 0.025;
  const bufLen = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen); // decay envelope baked in
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800 + Math.random() * 1200; // 800-2000 Hz
  bp.Q.value = 2 + Math.random() * 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.04 + Math.random() * 0.06, ctx.currentTime); // softer pops
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(bp).connect(g).connect(masterGain);
  src.start();
  src.stop(ctx.currentTime + duration + 0.01);
}

function stopCrackleVoice(voice) {
  try { voice.hissSrc.stop(); } catch (_) {}
  try { voice.gain.disconnect(); } catch (_) {}
}

// ============================================================
// SINKING GLUG — descending sine + filtered noise swell
// Plays after destruction (call with slight delay).
// ============================================================
export function playSinkGlug() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  activeVoices++;

  const now = ctx.currentTime;
  const duration = 0.45;

  // Descending sine: 400Hz → 80Hz over 400ms
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

  // Lowpass filter closing with the pitch
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2000, now);
  lp.frequency.exponentialRampToValueAtTime(100, now + 0.4);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.2, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(lp).connect(oscGain).connect(masterGain);
  osc.start(now);
  osc.stop(now + duration);

  // Water noise swell underneath
  const noiseDur = 0.3;
  const nBufLen = Math.ceil(ctx.sampleRate * noiseDur);
  const nBuf = ctx.createBuffer(1, nBufLen, ctx.sampleRate);
  const nData = nBuf.getChannelData(0);
  for (let i = 0; i < nBufLen; i++) nData[i] = Math.random() * 2 - 1;
  const nSrc = ctx.createBufferSource();
  nSrc.buffer = nBuf;
  const nLp = ctx.createBiquadFilter();
  nLp.type = 'lowpass';
  nLp.frequency.setValueAtTime(600, now);
  nLp.frequency.linearRampToValueAtTime(200, now + noiseDur);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0, now);
  nGain.gain.linearRampToValueAtTime(0.12, now + 0.05); // quick swell
  nGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
  nSrc.connect(nLp).connect(nGain).connect(masterGain);
  nSrc.start(now);
  nSrc.stop(now + noiseDur + 0.01);

  osc.onended = () => activeVoices--;
}
