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
  if (humGain) humGain.gain.value = 0;
  if (burnGain) burnGain.gain.value = 0;
  if (altarGain) altarGain.gain.value = 0;
}
