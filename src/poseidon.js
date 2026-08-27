// ============================================================
// src/poseidon.js — Poseidon ultimate: whirlpool control
//
// Opens a whirlpool in centre of sea. All ships slow 50% and
// are pulled laterally toward centre. Sailed ships pulled harder.
// No direct damage. Duration ~6s. Deep sucking sound.
// ============================================================

import { getScene, getWorldWidth } from './renderer.js';
import { getEnemyPool, setWindActive } from './enemy.js';
import { GOD_ABILITIES, SHIP_SPAWN_Y, WALL_Y } from './config.js';

let active = false;
let timer = 0;
let whirlpoolMesh = null;
let whirlpoolPhase = 0;
let placementPending = false; // waiting for player to tap placement
let placementTimer = 0;      // timeout for auto-cancel
let placementTextMesh = null; // "Tap the water" hint

const DURATION = GOD_ABILITIES.poseidon.duration;
const PULL_STRENGTH_SAILED = 14;  // world units/sec lateral pull
const PULL_STRENGTH_OARED = 6;
const PLACEMENT_TIMEOUT = 5;      // seconds before auto-cancel + refund

export function isPoseidonPlacementPending() { return placementPending; }
export function cancelPoseidonPlacement() {
  placementPending = false;
  placementTimer = 0;
  if (placementTextMesh) placementTextMesh.material.opacity = 0;
}

export function initPoseidon() {
  const scene = getScene();
  // Whirlpool visual: rotating spiral (canvas texture on a circle)
  const size = 20;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  drawWhirlpool(ctx, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.premultiplyAlpha = false;
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  whirlpoolMesh = new THREE.Mesh(geo, mat);
  whirlpoolMesh.position.set(0, 0, -5); // default centre, moved on placement
  scene.add(whirlpoolMesh);

  // "Tap the water" hint text
  const tc = document.createElement('canvas');
  tc.width = 160; tc.height = 24;
  const tctx = tc.getContext('2d');
  tctx.fillStyle = '#44CCFF';
  tctx.font = 'bold 12px monospace';
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.fillText('Tap the water', 80, 12);
  const ttex = new THREE.CanvasTexture(tc);
  ttex.minFilter = THREE.LinearFilter;
  ttex.premultiplyAlpha = false;
  const tgeo = new THREE.PlaneGeometry(14, 2);
  const tmat = new THREE.MeshBasicMaterial({ map: ttex, transparent: true, opacity: 0, alphaTest: 0.05, depthWrite: false });
  placementTextMesh = new THREE.Mesh(tgeo, tmat);
  placementTextMesh.position.set(0, 5, 8);
  scene.add(placementTextMesh);
}

// Reset all Poseidon state on session restart — stop whirlpool, clear wind/pull
export function resetPoseidon() {
  active = false;
  timer = 0;
  whirlpoolPhase = 0;
  placementPending = false;
  placementTimer = 0;
  if (whirlpoolMesh) whirlpoolMesh.material.opacity = 0;
  if (placementTextMesh) placementTextMesh.material.opacity = 0;
  setWindActive(false);
}

export function triggerPoseidonStrike() {
  if (active || placementPending) return;
  // Enter placement mode — next tap on sea activates the whirlpool
  placementPending = true;
  placementTimer = PLACEMENT_TIMEOUT;
  if (placementTextMesh) placementTextMesh.material.opacity = 1;
}

export function placePoseidon(worldX, worldY) {
  if (!placementPending) return;
  placementPending = false;
  placementTimer = 0;
  if (placementTextMesh) placementTextMesh.material.opacity = 0;
  active = true;
  timer = DURATION;
  whirlpoolPhase = 0;
  whirlpoolMesh.position.x = worldX;
  whirlpoolMesh.position.y = worldY;
  setWindActive(true);
  playWhirlpoolSound();
}

export function updatePoseidon(dt) {
  // Placement timeout: auto-cancel if player doesn't tap within PLACEMENT_TIMEOUT
  if (placementPending) {
    placementTimer -= dt;
    // Pulse the hint text
    if (placementTextMesh) {
      placementTextMesh.material.opacity = 0.6 + 0.4 * Math.sin(performance.now() * 0.006);
    }
    if (placementTimer <= 0) {
      // Timeout — cancel and refund (refund handled by crafting reimport not practical;
      // just cancel silently — cost was already paid. Timeout is generous at 5s.)
      cancelPoseidonPlacement();
    }
    return;
  }

  if (!active) {
    whirlpoolMesh.material.opacity = 0;
    return;
  }

  timer -= dt;
  whirlpoolPhase += dt * 4; // rotation speed

  // Visual: fade in/out, rotate
  const fadeIn = Math.min(1, (DURATION - timer) * 3); // quick fade in
  const fadeOut = Math.min(1, timer * 2); // fade out at end
  whirlpoolMesh.material.opacity = 0.4 * fadeIn * fadeOut;
  whirlpoolMesh.rotation.z = whirlpoolPhase;

  // Pull all ships toward whirlpool centre
  const pool = getEnemyPool();
  const ww = getWorldWidth();
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;

    // Lateral pull toward whirlpool position
    const laneWidth = ww / 5;
    const shipX = -ww / 2 + laneWidth * (e.lane + 0.5) + (e.pullX || 0);
    const targetX = whirlpoolMesh.position.x;
    const dx = targetX - shipX;
    const pullStrength = e.propulsion === 'sailed' ? PULL_STRENGTH_SAILED : PULL_STRENGTH_OARED;

    // Accumulate pull (uses pullX, not driftX — won't be overwritten by animation)
    const pull = Math.sign(dx) * Math.min(Math.abs(dx), pullStrength * dt * fadeIn * fadeOut);
    e.pullX = (e.pullX || 0) + pull;

    // Tilt ship toward centre (visual feedback)
    const tiltTarget = Math.sign(dx) * 0.12 * fadeIn;
    e.mesh.rotation.z = e.mesh.rotation.z * 0.85 + tiltTarget * 0.15;
  }

  // End
  if (timer <= 0) {
    active = false;
    setWindActive(false);
    // Gradually release pull
    const pool2 = getEnemyPool();
    for (const e of pool2) {
      if (e.active) e.pullX = 0; // release instantly (ships snap back to lanes)
    }
  }
}

function drawWhirlpool(ctx, sz) {
  const cx = sz / 2, cy = sz / 2;
  ctx.clearRect(0, 0, sz, sz);
  // Spiral arms
  for (let arm = 0; arm < 4; arm++) {
    const baseAngle = arm * Math.PI / 2;
    ctx.strokeStyle = `rgba(40, 120, 160, ${0.6 - arm * 0.1})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let t = 0; t < 3; t += 0.1) {
      const r = 5 + t * 18;
      const a = baseAngle + t * 2.5;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Centre dark hole
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15);
  grad.addColorStop(0, 'rgba(5, 20, 30, 0.8)');
  grad.addColorStop(1, 'rgba(5, 20, 30, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, Math.PI * 2);
  ctx.fill();
}

// Audio: deep sucking sound
function playWhirlpoolSound() {
  let ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const now = ctx.currentTime;

  // Low oscillator sweep down
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + DURATION);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200, now);
  lp.frequency.exponentialRampToValueAtTime(50, now + DURATION);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.2, now + 0.3);
  g.gain.linearRampToValueAtTime(0.15, now + DURATION - 1);
  g.gain.exponentialRampToValueAtTime(0.001, now + DURATION);
  osc.connect(lp).connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + DURATION + 0.1);

  // Noise layer: water rush
  const nLen = Math.ceil(ctx.sampleRate * DURATION);
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
  const nSrc = ctx.createBufferSource();
  nSrc.buffer = nBuf;
  const nLp = ctx.createBiquadFilter();
  nLp.type = 'bandpass';
  nLp.frequency.value = 300;
  nLp.Q.value = 1;
  const nG = ctx.createGain();
  nG.gain.setValueAtTime(0, now);
  nG.gain.linearRampToValueAtTime(0.08, now + 0.5);
  nG.gain.linearRampToValueAtTime(0.05, now + DURATION - 1);
  nG.gain.exponentialRampToValueAtTime(0.001, now + DURATION);
  nSrc.connect(nLp).connect(nG).connect(ctx.destination);
  nSrc.start(now);
  nSrc.stop(now + DURATION + 0.1);
}
