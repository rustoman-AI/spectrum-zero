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
    setupSeaAmbience();
  } catch (e) { return null; }
  return ctx;
}

// ============================================================
// SEA AMBIENCE — gentle Mediterranean bed: soft breeze (filtered noise) with a
// slow rhythmic wave-wash swell against stone. Replaces sci-fi drone character.
// ============================================================
let breezeGain = null;
let waveWashGain = null;
let waveTimer = 0;
function setupSeaAmbience() {
  // Breeze: looping pink-ish noise through a gentle lowpass, very quiet.
  const bufLen = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufLen; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.98 * last + 0.02 * white; // low-passed → soft airy noise
    d[i] = last * 3;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700;
  breezeGain = ctx.createGain();
  breezeGain.gain.value = 0.05; // subtle bed
  src.connect(lp).connect(breezeGain).connect(masterGain);
  src.start();

  // Wave-wash bus: swells are fired rhythmically in updateSeaAmbience().
  waveWashGain = ctx.createGain();
  waveWashGain.gain.value = 1;
  waveWashGain.connect(masterGain);
}

// Called each frame; fires a soft wave-wash swell every few seconds.
export function updateSeaAmbience(dt) {
  if (!ctx || !waveWashGain) return;
  waveTimer -= dt;
  if (waveTimer <= 0) {
    waveTimer = 3.2 + Math.random() * 2.0; // a wash every ~3-5s
    fireWaveWash();
  }
}

function fireWaveWash() {
  const now = ctx.currentTime;
  const dur = 1.6;
  const bufLen = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // Band-limited "shhh" that rises then falls — water washing over stone.
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(500, now);
  bp.frequency.linearRampToValueAtTime(1100, now + dur * 0.4);
  bp.frequency.linearRampToValueAtTime(300, now + dur);
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.06, now + dur * 0.4); // swell in
  g.gain.linearRampToValueAtTime(0.0, now + dur);        // wash out
  src.connect(bp).connect(g).connect(waveWashGain);
  src.start(now);
  src.stop(now + dur + 0.05);
}

function toggleMute(e) {
  if (e) e.preventDefault();
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
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

// --- Shield deflection: bright BRONZE CLANG. Struck-bronze bell = a set of
// inharmonic partials with a fast attack and a ringing (but short) decay. ---
let lastRicochetTime = 0;
export function playRicochet() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  const now = ctx.currentTime;
  if (now - lastRicochetTime < 0.08) return;
  lastRicochetTime = now;
  activeVoices++;
  // Inharmonic partials around a ~1400Hz fundamental (bronze, not pure sine).
  const fund = 1350 + Math.random() * 120;
  const ratios = [1.0, 2.76, 5.4, 8.9]; // bell-like inharmonic series
  const gains  = [0.10, 0.06, 0.035, 0.02];
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(masterGain);
  for (let i = 0; i < ratios.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = fund * ratios[i];
    const g = ctx.createGain();
    const decay = 0.18 - i * 0.03; // higher partials die faster
    g.gain.setValueAtTime(gains[i], now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + Math.max(0.05, decay));
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  // Tiny strike transient for the "clang" bite.
  const tLen = Math.ceil(ctx.sampleRate * 0.015);
  const tBuf = ctx.createBuffer(1, tLen, ctx.sampleRate);
  const td = tBuf.getChannelData(0);
  for (let i = 0; i < tLen; i++) td[i] = (Math.random() * 2 - 1) * (1 - i / tLen);
  const tSrc = ctx.createBufferSource(); tSrc.buffer = tBuf;
  const tHp = ctx.createBiquadFilter(); tHp.type = 'highpass'; tHp.frequency.value = 2500;
  const tG = ctx.createGain(); tG.gain.value = 0.06;
  tSrc.connect(tHp).connect(tG).connect(out);
  tSrc.start(now); tSrc.stop(now + 0.02);
  setTimeout(() => { activeVoices--; }, 260);
}

// --- Wall impact: wooden hull crunch + hollow acoustic war-drum (tympanon) ---
export function playWallHit() {
  if (!ensureCtx() || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const now = ctx.currentTime;

  // 1) Wooden hull crunch: short mid-band noise burst with a fast decay.
  const crLen = Math.ceil(ctx.sampleRate * 0.09);
  const crBuf = ctx.createBuffer(1, crLen, ctx.sampleRate);
  const cd = crBuf.getChannelData(0);
  for (let i = 0; i < crLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / crLen);
  const crSrc = ctx.createBufferSource();
  crSrc.buffer = crBuf;
  const crBp = ctx.createBiquadFilter();
  crBp.type = 'bandpass';
  crBp.frequency.setValueAtTime(420, now);
  crBp.frequency.exponentialRampToValueAtTime(180, now + 0.09);
  crBp.Q.value = 1.2;
  const crG = ctx.createGain();
  crG.gain.setValueAtTime(0.22, now);
  crG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  crSrc.connect(crBp).connect(crG).connect(masterGain);
  crSrc.start(now); crSrc.stop(now + 0.11);

  // 2) Hollow war-drum thud: a low membrane tone (sine) with a quick pitch drop
  //    and a resonant body, giving the taut-skin "doom" of a tympanon.
  const drum = ctx.createOscillator();
  drum.type = 'sine';
  drum.frequency.setValueAtTime(140, now);
  drum.frequency.exponentialRampToValueAtTime(66, now + 0.18);
  const drumG = ctx.createGain();
  drumG.gain.setValueAtTime(0.28, now);
  drumG.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  // Bandpass "body" resonance for a hollow, skin-over-shell character.
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = 110;
  body.Q.value = 3.5;
  drum.connect(body).connect(drumG).connect(masterGain);
  drum.start(now); drum.stop(now + 0.5);
  drum.onended = () => activeVoices--;
}

// --- Helios: resonant acoustic temple chime + a warm horn swell ---
export function playHeliosHorn() {
  if (!ensureCtx()) return;
  const now = ctx.currentTime;
  // Temple chime: a bright struck bell (harmonic-ish, warmer than the shield).
  const chimeFund = 523; // ~C5
  const chimeRatios = [1, 2, 3, 4.2];
  const chimeGains = [0.14, 0.08, 0.05, 0.03];
  for (let i = 0; i < chimeRatios.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = chimeFund * chimeRatios[i];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(chimeGains[i], now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.4 - i * 0.2);
    osc.connect(g).connect(masterGain);
    osc.start(now); osc.stop(now + 1.5);
  }
  // Warm horn swell underneath (sacred, brass-like): stacked saw+triangle
  // through a lowpass, rising then holding, evoking a temple horn/salpinx.
  const horn = ctx.createOscillator(); horn.type = 'sawtooth'; horn.frequency.value = 174; // ~F3
  const horn2 = ctx.createOscillator(); horn2.type = 'triangle'; horn2.frequency.value = 261;
  const hlp = ctx.createBiquadFilter();
  hlp.type = 'lowpass';
  hlp.frequency.setValueAtTime(400, now);
  hlp.frequency.linearRampToValueAtTime(1400, now + 0.6);
  hlp.frequency.linearRampToValueAtTime(700, now + 2.0);
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0, now);
  hg.gain.linearRampToValueAtTime(0.12, now + 0.4);   // swell in
  hg.gain.setValueAtTime(0.12, now + 1.6);
  hg.gain.exponentialRampToValueAtTime(0.001, now + 2.4); // fade
  horn.connect(hlp); horn2.connect(hlp);
  hlp.connect(hg).connect(masterGain);
  horn.start(now); horn.stop(now + 2.5);
  horn2.start(now); horn2.stop(now + 2.5);
}

// --- Zeus: natural THUNDERCLAP — sharp crack (filtered noise) + rolling rumble ---
export function playZeusThunder() {
  if (!ensureCtx()) return;
  const now = ctx.currentTime;

  // Sharp crack: bright wideband noise burst, very fast decay.
  const crackLen = Math.ceil(ctx.sampleRate * 0.12);
  const cBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
  const cd = cBuf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 1.5);
  const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
  const cHp = ctx.createBiquadFilter(); cHp.type = 'highpass'; cHp.frequency.value = 900;
  const cG = ctx.createGain();
  cG.gain.setValueAtTime(0.4, now);
  cG.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
  cSrc.connect(cHp).connect(cG).connect(masterGain);
  cSrc.start(now); cSrc.stop(now + 0.2);

  // Rolling rumble: long low-passed noise with a slow-closing filter — the
  // thunder rolling away across the bay. Natural, no synth boom oscillator.
  const rumLen = Math.ceil(ctx.sampleRate * 2.0);
  const rBuf = ctx.createBuffer(1, rumLen, ctx.sampleRate);
  const rd = rBuf.getChannelData(0);
  for (let i = 0; i < rumLen; i++) rd[i] = Math.random() * 2 - 1;
  const rSrc = ctx.createBufferSource(); rSrc.buffer = rBuf;
  const rLp = ctx.createBiquadFilter();
  rLp.type = 'lowpass';
  rLp.frequency.setValueAtTime(300, now);
  rLp.frequency.exponentialRampToValueAtTime(60, now + 1.8);
  const rG = ctx.createGain();
  rG.gain.setValueAtTime(0.0, now);
  rG.gain.linearRampToValueAtTime(0.3, now + 0.08); // quick onset behind the crack
  rG.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  rSrc.connect(rLp).connect(rG).connect(masterGain);
  rSrc.start(now + 0.03); rSrc.stop(now + 2.05);
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
  // Restore the ambient sea bed for the new run.
  if (breezeGain) breezeGain.gain.value = 0.05;
  if (waveWashGain) waveWashGain.gain.value = 1;
  waveTimer = 1.0;
}

// Immediately silence all continuous battle loops (beam hum, burn hiss, altar
// tone, wood crackle). Used on game over so only the defeat sound is left.
// One-shot voices already in flight (destruction, gong) are unaffected.
export function silenceBattleAudio() {
  if (humGain) humGain.gain.value = 0;
  if (burnGain) burnGain.gain.value = 0;
  if (altarGain) altarGain.gain.value = 0;
  if (breezeGain) breezeGain.gain.value = 0;      // sea bed fades out on end
  if (waveWashGain) waveWashGain.gain.value = 0;
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
