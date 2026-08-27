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
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(ctx.destination);
    setupHum();
    setupBurnNoise();
    setupAltarTone();
  } catch (e) { return null; }
  return ctx;
}

function toggleMute(e) {
  if (e) e.preventDefault();
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
  if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
}

// --- Beam hum: continuous drone, pitch/volume scales with throughput ---
function setupHum() {
  hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 55;
  humGain = ctx.createGain();
  humGain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  hum.connect(filter).connect(humGain).connect(masterGain);
  hum.start();
}

export function updateHum(throughput) {
  if (!humGain) return;
  // throughput: 0 to ~50 (total DPS across all beams hitting targets)
  const vol = Math.min(0.15, throughput * 0.003);
  const pitch = 55 + throughput * 0.5;
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
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  burnNoise.connect(filter).connect(burnGain).connect(masterGain);
  burnNoise.start();
}

export function updateBurnHiss(intensity) {
  if (!burnGain) return;
  // intensity: 0 to 1 (fraction of enemies being burned)
  burnGain.gain.value = Math.min(0.08, intensity * 0.1);
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

// --- Wall damage: dull impact ---
export function playWallHit() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(g).connect(masterGain);
  osc.start(); osc.stop(ctx.currentTime + 0.4);
  osc.onended = () => activeVoices--;
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
}

// Immediately silence all continuous battle loops (beam hum, burn hiss, altar
// tone, wood crackle). Used on game over so only the defeat sound is left.
// One-shot voices already in flight (destruction, gong) are unaffected.
export function silenceBattleAudio() {
  if (humGain) humGain.gain.value = 0;
  if (burnGain) burnGain.gain.value = 0;
  if (altarGain) altarGain.gain.value = 0;
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
      voice.gain.gain.value = 0.03 + heat * 0.07; // hiss volume
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
  g.gain.setValueAtTime(0.08 + Math.random() * 0.12, ctx.currentTime);
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
