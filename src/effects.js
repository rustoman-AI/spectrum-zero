// ============================================================
// src/effects.js — Contact glow, sparks, destruction sequence, audio
// Pooled sprites, no per-frame allocation.
// ============================================================

import { getScene } from './renderer.js';

// --- Contact glow pool (beam hitting enemy) ---
const GLOW_POOL_SIZE = 8;
const glowPool = [];

// --- Spark pool (short-lived particles on damage) ---
const SPARK_POOL_SIZE = 24;
const sparkPool = [];

// --- Debris pool (destruction particles) ---
const DEBRIS_POOL_SIZE = 16;
const debrisPool = [];

// --- WebAudio context (created on first user interaction) ---
let audioCtx = null;

export function initEffects() {
  const scene = getScene();
  // Contact glows
  for (let i = 0; i < GLOW_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(3, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.4;
    scene.add(mesh);
    glowPool.push({ mesh, life: 0, colour: 0xffffff, scale: 1 });
  }
  // Sparks
  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.5;
    scene.add(mesh);
    sparkPool.push({ mesh, life: 0, vx: 0, vy: 0 });
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
  // Glows: fade out
  for (const g of glowPool) {
    if (g.life > 0) {
      g.life -= dt;
      g.mesh.material.opacity = Math.max(0, g.life * 2);
      g.mesh.scale.set(g.scale * (1 + (1 - g.life) * 0.5), g.scale * (1 + (1 - g.life) * 0.5), 1);
      if (g.life <= 0) g.mesh.visible = false;
    }
  }
  // Sparks: move + fade
  for (const s of sparkPool) {
    if (s.life > 0) {
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.vy -= 30 * dt; // gravity
      s.mesh.material.opacity = Math.max(0, s.life * 3);
      if (s.life <= 0) s.mesh.visible = false;
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

// Spawn a contact glow at position, scaled by DPS
export function spawnContactGlow(x, y, colour, dps) {
  for (const g of glowPool) {
    if (g.life <= 0) {
      g.mesh.position.x = x;
      g.mesh.position.y = y;
      g.mesh.material.color.setHex(colour);
      g.mesh.material.opacity = 0.6;
      g.mesh.visible = true;
      g.life = 0.15;
      g.scale = 0.5 + Math.min(dps / 50, 2);
      g.colour = colour;
      return;
    }
  }
}

// Spawn sparks at position
export function spawnSparks(x, y, colour, count) {
  for (let n = 0; n < count; n++) {
    for (const s of sparkPool) {
      if (s.life <= 0) {
        s.mesh.position.x = x;
        s.mesh.position.y = y;
        s.mesh.material.color.setHex(colour);
        s.mesh.material.opacity = 1;
        s.mesh.visible = true;
        s.life = 0.2 + Math.random() * 0.2;
        s.vx = (Math.random() - 0.5) * 30;
        s.vy = Math.random() * 20;
        break;
      }
    }
  }
}

// Destruction sequence: flash + debris + audio
export function spawnDestruction(x, y) {
  // Flash (large bright glow)
  spawnContactGlow(x, y, 0xffffff, 100);
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
  // Audio: wood crack + thump
  playDestructionSound();
}

// --- WebAudio synthesis ---
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  return audioCtx;
}

function playDestructionSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Wood crack: short noise burst
  const noiseLen = 0.08;
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
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
}

export function resetEffects() {
  for (const g of glowPool) { g.life = 0; g.mesh.visible = false; }
  for (const s of sparkPool) { s.life = 0; s.mesh.visible = false; }
  for (const d of debrisPool) { d.life = 0; d.mesh.visible = false; }
}
