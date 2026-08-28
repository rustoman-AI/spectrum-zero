// ============================================================
// src/effects.js — Contact glow, sparks, destruction sequence, audio
// Pooled sprites, no per-frame allocation.
// ============================================================

import { getScene } from './renderer.js';

// --- Soft radial sprite textures (shared) ---
// A round soft glow (bright centre → transparent edge) used for glows/embers,
// and a softer, fuzzier puff used for smoke. Replaces flat square particles.
let _glowTex = null, _smokeTex = null;
function radialTexture(stops) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [pos, col] of stops) g.addColorStop(pos, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
export function getGlowTex() {
  if (!_glowTex) _glowTex = radialTexture([
    [0.0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,0.7)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]);
  return _glowTex;
}
function getSmokeTex() {
  if (!_smokeTex) _smokeTex = radialTexture([
    [0.0, 'rgba(255,255,255,0.55)'],
    [0.5, 'rgba(255,255,255,0.28)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]);
  return _smokeTex;
}

// --- Contact glow pool (beam hitting enemy) ---
const GLOW_POOL_SIZE = 8;
const glowPool = [];
const GLOW_LIFE = 0.15;      // seconds — fixed flash lifetime
const GLOW_BASE = 1.5;       // base plane size (world units)
// Cap so peak rendered glow (GLOW_BASE * scale) stays ~1.2x a mid ship (~3.5u):
// 1.5 * 2.6 = 3.9 units. Never dwarfs the ship or its neighbours.
const GLOW_MAX_SCALE = 2.6;

// --- Spark pool (short-lived particles on damage) ---
const SPARK_POOL_SIZE = 24;
const sparkPool = [];

// --- Debris pool (destruction particles) ---
const DEBRIS_POOL_SIZE = 16;
const debrisPool = [];

// --- Smoke puff pool (drifting smoke on hits/destruction + ship wakes) ---
const SMOKE_POOL_SIZE = 32;
const smokePool = [];

// --- WebAudio context (created on first user interaction) ---
let audioCtx = null;

export function initEffects() {
  const scene = getScene();
  // Contact glows — soft round radial sprite (not a flat square).
  for (let i = 0; i < GLOW_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(1.5, 1.5);
    const mat = new THREE.MeshBasicMaterial({
      map: getGlowTex(), color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.4;
    scene.add(mesh);
    glowPool.push({ mesh, life: 0, colour: 0xffffff, scale: 1 });
  }
  // Embers — soft round glowing motes that rise and arc (was flat sparks).
  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(0.7, 0.7);
    const mat = new THREE.MeshBasicMaterial({
      map: getGlowTex(), color: 0xffcc00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.5;
    scene.add(mesh);
    sparkPool.push({ mesh, life: 0, maxLife: 0.4, vx: 0, vy: 0, baseSize: 0.7 });
  }
  // Smoke puffs — soft grey radial, drift up + grow + fade (normal blending).
  for (let i = 0; i < SMOKE_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: getSmokeTex(), color: 0x4a4038, transparent: true, opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.35;
    scene.add(mesh);
    smokePool.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, size0: 1, grow: 2, spin: 0 });
  }
  // Debris
  for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(1.2, 1.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x886644, transparent: true, opacity: 0, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.3;
    scene.add(mesh);
    debrisPool.push({ mesh, life: 0, vx: 0, vy: 0, gravity: 0 });
  }
}

export function updateEffects(dt) {
  // Glows: smooth opacity fade over the fixed 0.15s life. Scale is set once at
  // spawn and held constant — no growth-on-decay, so repeated beam ticks can't
  // compound the flash into a swelling blob.
  for (const g of glowPool) {
    if (g.life > 0) {
      g.life -= dt;
      g.mesh.material.opacity = Math.max(0, (g.life / GLOW_LIFE) * 0.7);
      g.mesh.scale.set(g.scale, g.scale, 1);
      if (g.life <= 0) g.mesh.visible = false;
    }
  }
  // Embers: rise + arc + gentle flicker, warm fade. Slight upward buoyancy
  // (negative gravity pull) so they float up like sparks off a fire.
  for (const s of sparkPool) {
    if (s.life > 0) {
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.vy += 6 * dt;   // buoyancy: drift upward over time
      s.vx *= 0.96;     // air drag
      const t = s.life / s.maxLife; // 1 -> 0
      const flicker = 0.75 + 0.25 * Math.sin(performance.now() * 0.03 + s.mesh.id);
      s.mesh.material.opacity = Math.max(0, t) * flicker;
      const size = s.baseSize * (0.6 + 0.4 * t);
      s.mesh.scale.set(size, size, 1);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
  // Smoke puffs: drift up, expand, fade out.
  for (const p of smokePool) {
    if (p.life > 0) {
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.vy += 3 * dt;   // rise faster as it lifts
      p.vx *= 0.97;
      const t = p.life / p.maxLife; // 1 -> 0
      const size = p.size0 + (1 - t) * p.grow; // grows as it ages
      p.mesh.scale.set(size, size, 1);
      p.mesh.rotation.z += p.spin * dt;
      p.mesh.material.opacity = Math.max(0, t) * 0.5; // never fully opaque
      if (p.life <= 0) p.mesh.visible = false;
    }
  }
  // Debris: move + gravity + fade
  for (const d of debrisPool) {
    if (d.life > 0) {
      d.life -= dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.vy -= d.gravity * dt;
      d.mesh.material.opacity = Math.max(0, d.life / 1.5);
      d.mesh.rotation.z += 3 * dt;
      if (d.life <= 0) d.mesh.visible = false;
    }
  }
}

// Spawn drifting smoke puffs at a position (dark combustion smoke).
export function spawnSmoke(x, y, count, colour) {
  let spawned = 0;
  for (const p of smokePool) {
    if (spawned >= count) break;
    if (p.life <= 0) {
      p.mesh.position.set(x + (Math.random() - 0.5) * 1.5, y, 0.35);
      p.mesh.material.color.setHex(colour != null ? colour : 0x4a4038);
      p.mesh.material.opacity = 0.5;
      p.mesh.visible = true;
      p.life = p.maxLife = 0.9 + Math.random() * 0.8;
      p.vx = (Math.random() - 0.5) * 4;
      p.vy = 4 + Math.random() * 4;
      p.size0 = 1.2 + Math.random() * 0.8;
      p.grow = 2.5 + Math.random() * 2;
      p.spin = (Math.random() - 0.5) * 1.5;
      p.mesh.scale.set(p.size0, p.size0, 1);
      spawned++;
    }
  }
}

// Spawn a light, short-lived foam WAKE puff behind a moving ship. Small and
// quick so the shared pool recycles fast even with many ships on screen.
export function spawnWake(x, y, colour) {
  for (const p of smokePool) {
    if (p.life <= 0) {
      p.mesh.position.set(x, y, 0.32);
      p.mesh.material.color.setHex(colour != null ? colour : 0x9fb8c4);
      p.mesh.material.opacity = 0.3;
      p.mesh.visible = true;
      p.life = p.maxLife = 0.5 + Math.random() * 0.3;
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = 1.5 + Math.random() * 1.5; // gentle rise
      p.size0 = 0.7 + Math.random() * 0.4;
      p.grow = 1.0;
      p.spin = (Math.random() - 0.5) * 0.8;
      p.mesh.scale.set(p.size0, p.size0, 1);
      return;
    }
  }
}

// Spawn a contact glow at position, scaled by DPS
export function spawnContactGlow(x, y, colour, dps) {
  for (const g of glowPool) {
    if (g.life <= 0) {
      g.mesh.position.x = x;
      g.mesh.position.y = y;
      g.mesh.material.color.setHex(colour);
      g.mesh.material.opacity = 0.7;
      g.mesh.visible = true;
      g.life = GLOW_LIFE;
      // Scale grows gently with DPS but is hard-clamped so it never balloons.
      g.scale = Math.min(GLOW_MAX_SCALE, 1.0 + dps / 120);
      g.colour = colour;
      return;
    }
  }
}

// Spawn rising embers at position (soft round glowing motes).
export function spawnSparks(x, y, colour, count) {
  for (let n = 0; n < count; n++) {
    for (const s of sparkPool) {
      if (s.life <= 0) {
        s.mesh.position.set(x, y, 0.5);
        s.mesh.material.color.setHex(colour);
        s.mesh.material.opacity = 1;
        s.mesh.visible = true;
        s.life = s.maxLife = 0.4 + Math.random() * 0.4;
        s.baseSize = 0.5 + Math.random() * 0.5;
        // Fan outward but biased upward so they read as rising embers.
        s.vx = (Math.random() - 0.5) * 16;
        s.vy = 6 + Math.random() * 14;
        s.mesh.scale.set(s.baseSize, s.baseSize, 1);
        break;
      }
    }
  }
}

// Destruction sequence: flash + debris + audio
// heavy=true for flagship/large ships → deeper bass + bigger flash
export function spawnDestruction(x, y, heavy) {
  // Flash (large bright glow)
  spawnContactGlow(x, y, 0xffffff, heavy ? 160 : 100);
  // Rising embers + drifting smoke puffs for an organic burn/explosion.
  spawnSparks(x, y, 0xffaa33, heavy ? 10 : 6);
  spawnSmoke(x, y, heavy ? 5 : 3);
  // Debris particles
  for (let i = 0; i < 8; i++) {
    for (const d of debrisPool) {
      if (d.life <= 0) {
        d.mesh.position.x = x;
        d.mesh.position.y = y;
        d.mesh.material.opacity = 1;
        d.mesh.visible = true;
        d.life = 0.8 + Math.random() * 0.7; // 0.8-1.5s
        d.vx = (Math.random() - 0.5) * 25;
        d.vy = Math.random() * 15 + 5;
        d.gravity = 20 + Math.random() * 10;
        d.mesh.rotation.z = Math.random() * 6.28;
        break;
      }
    }
  }
  // Audio: wood crack + thump (+ sub-bass for heavy ships)
  playDestructionSound(heavy);
}

// --- WebAudio synthesis ---
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  return audioCtx;
}

function playDestructionSound(heavy) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Wood crack: short noise burst
  const noiseLen = heavy ? 0.14 : 0.08;
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(heavy ? 0.4 : 0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseLen);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  // Low thump: sine at 60Hz
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
  // Heavy ships: deep sub-bass explosion (rumbling drop from 40Hz -> 22Hz)
  if (heavy) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(40, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 0.45);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.55);
  }
}

export function resetEffects() {
  for (const g of glowPool) { g.life = 0; g.mesh.visible = false; }
  for (const s of sparkPool) { s.life = 0; s.mesh.visible = false; }
  for (const d of debrisPool) { d.life = 0; d.mesh.visible = false; }
  for (const p of smokePool) { p.life = 0; p.mesh.visible = false; }
}
