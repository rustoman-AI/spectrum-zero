// ============================================================
// src/zeus.js â€” Zeus ultimate: lightning strike
//
// Ready state: "ZEUS IS LISTENING" text + chime when faith threshold met.
// Strike: white flash, staggered lightning bolts to all ships,
// massive damage, 3s stun, screen shake, thunder crack + rumble.
// ============================================================

import { getScene, getWorldWidth } from './renderer.js';
import { getEnemyPool } from './enemy.js';
import { SHIP_SPAWN_Y, ENEMY_LANE_COUNT, GOD_ABILITIES } from './config.js';

// --- State ---
let zeusReady = false;
let readyNotified = false;

let strikeActive = false;
let strikeTimer = 0;
let strikeBolts = [];
let flashAlpha = 0;
let zeusShakeTimer = 0;
let zeusShakeIntensity = 0;

// Audio context (lazy, shared with game audio via global AudioContext)
let aCtx = null;

export function isZeusReady() { return zeusReady; }
export function getZeusFlash() { return flashAlpha; }
export function getZeusShake() {
  if (zeusShakeTimer <= 0) return { x: 0, y: 0 };
  const t = zeusShakeTimer / 0.5;
  return {
    x: (Math.random() - 0.5) * zeusShakeIntensity * t,
    y: (Math.random() - 0.5) * zeusShakeIntensity * 0.5 * t
  };
}

export function initZeus() {
  // No text label — the visual effects (bolts, flash, shake) carry the moment
}

// Called each frame from main loop
export function updateZeus(dt, affordable) {
  const wasReady = zeusReady;
  zeusReady = affordable;

  // Notify on crossing threshold (chime only, no text)
  if (zeusReady && !readyNotified) {
    readyNotified = true;
    playReadyChime();
  }
  if (!zeusReady) {
    readyNotified = false;
  }

  // Strike animation
  if (strikeActive) {
    updateStrike(dt);
  }
}

// Called from crafting.js when Zeus button is pressed
export function triggerZeusStrike() {
  if (strikeActive) return;
  strikeActive = true;
  strikeTimer = 1.8;
  flashAlpha = 1.0;
  zeusShakeTimer = 0.5;
  zeusShakeIntensity = 4;
  readyNotified = false;

  const pool = getEnemyPool();
  const ww = getWorldWidth();
  const laneWidth = ww / ENEMY_LANE_COUNT;
  const scene = getScene();

  // Hit all active enemies
  const targets = pool.filter(e => e.active);
  strikeBolts = [];

  for (let i = 0; i < targets.length; i++) {
    const enemy = targets[i];
    const ex = -ww / 2 + laneWidth * (enemy.lane + 0.5);
    const ey = enemy.y;

    // Mark for Zeus kill â€” defer heat application by 0.2s for charring visual
    // Store the pending heat to be applied after charring stage
    const isLight = (enemy.type === 'skiff' || enemy.type === 'trireme');
    enemy.zeusPendingHeat = isLight ? enemy.maxHp * 1.5 : enemy.maxHp * 0.5;
    enemy.zeusCharring = 0.25; // 0.25s charring before heat hits
    // Stun: stop for 3 seconds
    enemy.stunTimer = 3.0;

    // Create bolt mesh (staggered reveal)
    const bolt = createBoltMesh(ex + (Math.random() - 0.5) * 3, SHIP_SPAWN_Y + 8, ex, ey);
    bolt.revealAt = 1.8 - i * 0.06; // stagger 60ms apart
    bolt.revealed = false;
    bolt.life = 0.4;
    bolt.mesh.visible = false;
    scene.add(bolt.mesh);
    strikeBolts.push(bolt);
  }

  // Thunder audio
  playThunderCrack();
}

function updateStrike(dt) {
  strikeTimer -= dt;
  flashAlpha = Math.max(0, flashAlpha - dt * 2.5);

  // Reveal bolts staggered
  for (const bolt of strikeBolts) {
    if (!bolt.revealed && strikeTimer < bolt.revealAt) {
      bolt.revealed = true;
      bolt.mesh.visible = true;
    }
    if (bolt.revealed) {
      bolt.life -= dt;
      if (bolt.life <= 0) {
        bolt.mesh.visible = false;
      } else {
        bolt.mesh.material.opacity = Math.min(1, bolt.life * 5);
      }
    }
  }

  // Shake decay
  if (zeusShakeTimer > 0) zeusShakeTimer -= dt;

  // End
  if (strikeTimer <= 0) {
    strikeActive = false;
    const scene = getScene();
    for (const bolt of strikeBolts) {
      scene.remove(bolt.mesh);
      bolt.mesh.geometry.dispose();
      bolt.mesh.material.dispose();
    }
    strikeBolts = [];
  }
}

// --- Lightning bolt: jagged quad strip ---
function createBoltMesh(x1, y1, x2, y2) {
  const segments = 10 + Math.floor(Math.random() * 5);
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jitterX = (i > 0 && i < segments) ? (Math.random() - 0.5) * 8 : 0;
    const jitterY = (i > 0 && i < segments) ? (Math.random() - 0.5) * 2 : 0;
    points.push(x1 + (x2 - x1) * t + jitterX, y1 + (y2 - y1) * t + jitterY);
  }

  const verts = [];
  const thickness = 0.7;
  for (let i = 0; i < points.length - 2; i += 2) {
    const ax = points[i], ay = points[i + 1];
    const bx = points[i + 2], by = points[i + 3];
    const dx = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * thickness, ny = dx / len * thickness;
    verts.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx + nx, by + ny, 0);
    verts.push(ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.MeshBasicMaterial({
    color: 0xFFFFDD, transparent: true, opacity: 1.0,
    side: THREE.DoubleSide, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 9;
  return { mesh, revealAt: 0, revealed: false, life: 0.4 };
}

// --- Audio ---
function getACtx() {
  if (aCtx) return aCtx;
  try { aCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  return aCtx;
}

function playReadyChime() {
  const ctx = getACtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Rising two-note chime: C5 â†’ E5
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  g.connect(ctx.destination);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 523;
  o1.connect(g); o1.start(now); o1.stop(now + 0.15);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 659;
  o2.connect(g); o2.start(now + 0.13); o2.stop(now + 0.6);
}

function playThunderCrack() {
  const ctx = getACtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Sharp crack: noise burst
  const crackLen = Math.ceil(ctx.sampleRate * 0.1);
  const buf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.5, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  src.connect(cg).connect(ctx.destination);
  src.start(now);

  // Low rumble tail
  const rumLen = Math.ceil(ctx.sampleRate * 1.5);
  const rBuf = ctx.createBuffer(1, rumLen, ctx.sampleRate);
  const rd = rBuf.getChannelData(0);
  for (let i = 0; i < rumLen; i++) rd[i] = Math.random() * 2 - 1;
  const rSrc = ctx.createBufferSource(); rSrc.buffer = rBuf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(180, now);
  lp.frequency.exponentialRampToValueAtTime(30, now + 1.3);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.3, now + 0.05);
  rg.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  rSrc.connect(lp).connect(rg).connect(ctx.destination);
  rSrc.start(now + 0.04);
}
