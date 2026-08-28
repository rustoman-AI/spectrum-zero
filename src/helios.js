// ============================================================
// src/helios.js — Helios ultimate: Solar Overcharge
//
// Active ability (replaces the old passive Priest). On cast:
//   - Full-screen warm solar bloom overlay for `duration` seconds.
//   - Generates `faithGain` Faith spread evenly across the flare
//     (the fuel for repeat Zeus/Poseidon casts).
//   - Stuns every ship on screen (speed 0) for `stunDuration` seconds.
//   - Disables Shield-Bearer deflection while the flare is active, so
//     beams deal full direct damage straight through the shields.
//   - Rising solar hum + bright chime SFX.
// ============================================================

import { GOD_ABILITIES, WORLD_HEIGHT } from './config.js';
import { getOverlayScene, getWorldWidth } from './renderer.js';
import { getEnemyPool } from './enemy.js';
import { gainFaith } from './foundry.js';
import { playHeliosHorn } from './audio.js';

const CFG = GOD_ABILITIES.helios;

let heliosActive = false;
let heliosTimer = 0;              // seconds remaining in the flare
let heliosFaithRemaining = 0;     // faith still to be granted this flare
let bloomMesh = null;
let heliosACtx = null;
let heliosHumOsc = null;
let heliosHumGain = null;

export function isHeliosActive() { return heliosActive; }
// While the flare burns, shield plates are overpowered by the sun.
export function isShieldDisabled() { return heliosActive; }

export function initHelios() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  // Full-screen warm bloom: a plane covering the whole viewport in the overlay
  // scene, additive so it reads as blinding light rather than a flat tint.
  const geo = new THREE.PlaneGeometry(worldWidth * 1.2, WORLD_HEIGHT * 1.2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffdd88, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  bloomMesh = new THREE.Mesh(geo, mat);
  bloomMesh.position.set(0, 0, 20); // in front of everything in the overlay scene
  bloomMesh.visible = false;
  oScene.add(bloomMesh);
}

// Called from crafting.js when Helios is purchased.
export function triggerHelios() {
  heliosActive = true;
  heliosTimer = CFG.duration;
  heliosFaithRemaining = CFG.faithGain;
  if (bloomMesh) bloomMesh.visible = true;

  // Stun every ship currently on screen.
  const pool = getEnemyPool();
  for (const e of pool) {
    if (e.active) e.stunTimer = Math.max(e.stunTimer || 0, CFG.stunDuration);
  }

  playSolarHum();
}

export function updateHelios(dt) {
  if (!heliosActive) return;

  heliosTimer -= dt;

  // Drip the faith evenly across the flare duration.
  if (heliosFaithRemaining > 0) {
    const rate = CFG.faithGain / CFG.duration; // faith per second
    const grant = Math.min(heliosFaithRemaining, rate * dt);
    gainFaith(grant);
    heliosFaithRemaining -= grant;
  }

  // Two-stage flare so ship silhouettes stay readable:
  //  - 0..0.4s: bright near-white whiteout bloom (the "flash").
  //  - 0.4s..end: a low-opacity golden sun-glare so the fleet is still visible
  //    through the light, with a short fade at the very end.
  const elapsed = CFG.duration - heliosTimer;
  if (bloomMesh) {
    const WHITEOUT = 0.4;
    const mat = bloomMesh.material;
    if (elapsed < WHITEOUT) {
      // Rise to a bright whiteout over the first 0.4s.
      const t = elapsed / WHITEOUT;           // 0..1
      mat.color.setHex(0xfff4d8);             // near-white warm
      mat.opacity = 0.9 * t;
    } else {
      // Golden glare for the rest — transparent enough to see silhouettes.
      const tailFade = Math.min(1, heliosTimer * 2.5); // fade over last ~0.4s
      const shimmer = 0.9 + 0.1 * Math.sin(elapsed * 10);
      mat.color.setHex(0xffcc55);             // golden
      mat.opacity = 0.22 * tailFade * shimmer;
    }
  }

  if (heliosTimer <= 0) {
    endFlare();
  }
}

function endFlare() {
  heliosActive = false;
  heliosTimer = 0;
  heliosFaithRemaining = 0;
  if (bloomMesh) {
    bloomMesh.material.opacity = 0;
    bloomMesh.visible = false;
  }
  stopSolarHum();
}

export function resetHelios() {
  endFlare();
}

// --- Audio: resonant temple chime + horn (organic, via shared audio bus so it
// respects mute). The old sci-fi sawtooth sweep was removed. ---
function playSolarHum() { playHeliosHorn(); }
function stopSolarHum() { /* horn is a one-shot swell; nothing to stop */ }
