// ============================================================
// src/fortress.js — Fortress silhouette with damage stages
//
// Drawn to canvas, positioned along city ground behind mirrors.
// Reacts to wall integrity with 4 visual stages.
// Breach triggers shake + dust particles.
// ============================================================

import { WALL_Y, MIRROR_FIELD_TOP, WORLD_HEIGHT } from './config.js';
import { getScene, getWorldWidth } from './renderer.js';
import { getWallIntegrity } from './session.js';

const FORT_W = 512;
const FORT_H = 256;
const COL_STONE = '#2E2419';
const COL_STONE_LIGHT = '#3D3020';
const COL_STONE_HIGHLIGHT = '#4A3B26';
const COL_RUBBLE = '#1F1A10';
const COL_FIRE = '#CC4400';
const COL_SMOKE = 'rgba(40,35,30,0.6)';

let fortMesh = null;
let fortCanvas = null;
let fortCtx = null;
let fortTexture = null;
let lastStage = -1;

// Shake state
let shakeTimer = 0;
let shakeIntensity = 0;
const SHAKE_DURATION = 0.3;

// Dust particles
const dustParticles = [];
const MAX_DUST = 20;

// Smoke plumes (persistent for stages 3-4)
const smokePlumes = [];

// Localized battlement impact flashes (one per ship crash, at its X lane)
const impactFlashes = [];
const MAX_IMPACT_FLASHES = 12;

export function initFortress() {
  const scene = getScene();
  const ww = getWorldWidth();

  fortCanvas = document.createElement('canvas');
  fortCanvas.width = FORT_W;
  fortCanvas.height = FORT_H;
  fortCtx = fortCanvas.getContext('2d');

  fortTexture = new THREE.CanvasTexture(fortCanvas);
  fortTexture.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  fortTexture.minFilter = THREE.LinearFilter;
  fortTexture.magFilter = THREE.LinearFilter;

  // Fortress spans the full width, positioned at the wall line
  // Height: from WALL_Y downward ~12 world units, towers rise ~4 above WALL_Y
  const fortWorldH = 16;
  const fortWorldW = ww + 4;
  const geo = new THREE.PlaneGeometry(fortWorldW, fortWorldH);
  const mat = new THREE.MeshBasicMaterial({ map: fortTexture, transparent: true, depthWrite: false });
  fortMesh = new THREE.Mesh(geo, mat);
  // Centre at WALL_Y - 4 (mostly below wall, towers above)
  fortMesh.position.set(0, WALL_Y - 4, -8);
  scene.add(fortMesh);

  // Initial draw
  drawFortress(1.0);
  lastStage = 4;
}

export function updateFortress(dt) {
  const integrity = getWallIntegrity() / 100; // 0 to 1
  const stage = integrity > 0.75 ? 4 : integrity > 0.50 ? 3 : integrity > 0.25 ? 2 : 1;

  // Redraw only when stage changes
  if (stage !== lastStage) {
    lastStage = stage;
    drawFortress(integrity);
    fortTexture.needsUpdate = true;
  }

  // Shake decay
  if (shakeTimer > 0) {
    shakeTimer -= dt;
    const t = shakeTimer / SHAKE_DURATION;
    const ox = (Math.random() - 0.5) * shakeIntensity * t;
    const oy = (Math.random() - 0.5) * shakeIntensity * 0.5 * t;
    fortMesh.position.x = ox;
    fortMesh.position.y = WALL_Y - 4 + oy;
  } else {
    fortMesh.position.x = 0;
    fortMesh.position.y = WALL_Y - 4;
  }

  // Update dust particles
  for (let i = dustParticles.length - 1; i >= 0; i--) {
    const p = dustParticles[i];
    p.life -= dt;
    if (p.life <= 0) {
      if (p.mesh) { p.mesh.visible = false; }
      dustParticles.splice(i, 1);
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 15 * dt; // gravity
      if (p.mesh) {
        p.mesh.position.set(p.x, p.y, -7);
        p.mesh.material.opacity = p.life / p.maxLife * 0.6;
      }
    }
  }

  // Update localized impact flashes (fade + slight grow)
  for (let i = impactFlashes.length - 1; i >= 0; i--) {
    const f = impactFlashes[i];
    f.life -= dt;
    if (f.life <= 0) {
      f.mesh.visible = false;
      impactFlashes.splice(i, 1);
    } else {
      const t = f.life / f.maxLife; // 1 -> 0
      // Throb while alive (sustained contact) + fade as life runs out.
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.02);
      f.mesh.material.opacity = t * 0.9 * pulse;
      const s = 1 + (1 - t) * 0.5;
      f.mesh.scale.set(s, s, 1);
    }
  }
}

// Localized reddish-orange stone flash on the battlement section directly below
// a contacting/crashing lane. Called continuously while a ship drips damage, so
// if a flash already exists near this X we just refresh its life (sustained
// pulse) instead of spawning a new mesh every frame.
export function triggerImpactFlash(x) {
  // Refresh a nearby existing flash (same lane) to keep it alive + pulsing.
  for (const f of impactFlashes) {
    if (Math.abs(f.mesh.position.x - x) < 6) {
      f.life = f.maxLife;
      f.mesh.position.x = x;
      return;
    }
  }
  if (impactFlashes.length >= MAX_IMPACT_FLASHES) return;
  const scene = getScene();
  const geo = new THREE.PlaneGeometry(8, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff5522, transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, WALL_Y + 2, -6);
  scene.add(mesh);
  impactFlashes.push({ mesh, life: 0.35, maxLife: 0.35 });
}

// Called from session.js when a breach happens
export function triggerBreachShake(damage) {
  shakeTimer = SHAKE_DURATION;
  // Subtle thud: ~70% quieter than before (was min(damage/10, 2.5)).
  shakeIntensity = Math.min(damage / 10, 2.5) * 0.3;
  // Spawn dust
  spawnDust(6);
}

function spawnDust(count) {
  const scene = getScene();
  const ww = getWorldWidth();
  for (let i = 0; i < count && dustParticles.length < MAX_DUST; i++) {
    const x = (Math.random() - 0.5) * ww * 0.6;
    const y = WALL_Y + Math.random() * 2;
    const geo = new THREE.PlaneGeometry(1.2, 1.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4A3B26, transparent: true, opacity: 0.5, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, -7);
    scene.add(mesh);
    dustParticles.push({
      mesh, x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 12 + 5,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
    });
  }
}

// --- Fortress drawing ---

function drawFortress(integrity) {
  const ctx = fortCtx;
  const w = FORT_W;
  const h = FORT_H;
  ctx.clearRect(0, 0, w, h);

  const stage = integrity > 0.75 ? 4 : integrity > 0.50 ? 3 : integrity > 0.25 ? 2 : 1;

  // Ground level is at h * 0.35 (from top of canvas)
  // Rampart sits on top of ground, towers rise higher
  const groundY = h * 0.35;
  const rampartH = h * 0.25;
  const rampartTop = groundY - rampartH;
  const crenH = h * 0.06;
  const crenW = w * 0.03;
  const crenGap = w * 0.02;

  // --- Rooftops (behind rampart, suggestion of buildings) ---
  ctx.fillStyle = COL_RUBBLE;
  // Several peaked roofs behind the wall
  for (let i = 0; i < 8; i++) {
    const rx = w * 0.08 + i * w * 0.12;
    const rw = w * 0.08 + Math.random() * w * 0.03;
    const rh = h * 0.08 + Math.random() * h * 0.06;
    ctx.beginPath();
    ctx.moveTo(rx, groundY + rampartH * 0.1);
    ctx.lineTo(rx + rw / 2, groundY + rampartH * 0.1 - rh);
    ctx.lineTo(rx + rw, groundY + rampartH * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  // --- Main rampart wall ---
  ctx.fillStyle = COL_STONE;
  ctx.fillRect(0, rampartTop, w, rampartH);

  // Stone block lines (horizontal courses)
  ctx.strokeStyle = COL_STONE_LIGHT;
  ctx.lineWidth = 1;
  for (let row = 0; row < 5; row++) {
    const y = rampartTop + row * (rampartH / 5);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Vertical joints (offset per row)
  ctx.strokeStyle = 'rgba(25,20,12,0.4)';
  for (let row = 0; row < 5; row++) {
    const y = rampartTop + row * (rampartH / 5);
    const offset = (row % 2) * (w * 0.04);
    for (let j = 0; j < 14; j++) {
      const jx = offset + j * (w / 13);
      ctx.beginPath();
      ctx.moveTo(jx, y);
      ctx.lineTo(jx, y + rampartH / 5);
      ctx.stroke();
    }
  }

  // --- Crenellations (merlons along top) ---
  const merlonCount = 16;
  const merlonW = w / merlonCount * 0.55;
  const merlonSpacing = w / merlonCount;
  ctx.fillStyle = COL_STONE;
  for (let i = 0; i < merlonCount; i++) {
    // Skip some in damaged stages
    if (stage <= 3 && (i === 5 || i === 11)) continue; // one missing at stage 3
    if (stage <= 2 && (i === 3 || i === 8 || i === 13)) continue; // more missing
    if (stage <= 1 && (i === 1 || i === 6 || i === 9 || i === 14)) continue;

    const mx = i * merlonSpacing + merlonSpacing * 0.22;
    ctx.fillRect(mx, rampartTop - crenH, merlonW, crenH);
  }

  // --- Towers (two main, one smaller) ---
  drawTower(ctx, w * 0.18, rampartTop, w * 0.08, h * 0.18, stage);
  drawTower(ctx, w * 0.78, rampartTop, w * 0.09, h * 0.20, stage);
  // Smaller centre tower
  drawTower(ctx, w * 0.48, rampartTop, w * 0.06, h * 0.12, stage);

  // --- Damage effects ---
  if (stage <= 3) {
    // Cracks
    ctx.strokeStyle = '#1A1408';
    ctx.lineWidth = 2;
    drawCrack(ctx, w * 0.35, rampartTop + rampartH * 0.3, 20, 4);
    if (stage <= 2) {
      drawCrack(ctx, w * 0.65, rampartTop + rampartH * 0.5, 25, 5);
    }
  }

  if (stage <= 2) {
    // Breach: a gap in the wall with rubble
    const bx = w * 0.55;
    const bw = w * 0.08;
    ctx.fillStyle = '#0c0a06'; // dark hole
    ctx.fillRect(bx, rampartTop + rampartH * 0.3, bw, rampartH * 0.7);
    // Rubble at base
    ctx.fillStyle = COL_RUBBLE;
    for (let r = 0; r < 5; r++) {
      const rx = bx - 5 + Math.random() * (bw + 10);
      const ry = rampartTop + rampartH - 5 + Math.random() * 10;
      ctx.beginPath();
      ctx.arc(rx, ry, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Thin smoke
    ctx.fillStyle = COL_SMOKE;
    for (let s = 0; s < 3; s++) {
      const sx = bx + bw * 0.5 + (Math.random() - 0.5) * 10;
      const sy = rampartTop + rampartH * 0.2 - s * 12;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (stage <= 1) {
    // Multiple breaches + fire
    const bx2 = w * 0.25;
    const bw2 = w * 0.07;
    ctx.fillStyle = '#0c0a06';
    ctx.fillRect(bx2, rampartTop + rampartH * 0.2, bw2, rampartH * 0.8);
    // More rubble
    ctx.fillStyle = COL_RUBBLE;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.arc(bx2 + Math.random() * bw2, rampartTop + rampartH + Math.random() * 8, 3 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fires
    drawFire(ctx, w * 0.56, rampartTop + rampartH * 0.1);
    drawFire(ctx, w * 0.26, rampartTop + rampartH * 0.05);
    // Heavy smoke
    ctx.fillStyle = 'rgba(30,25,20,0.5)';
    for (let s = 0; s < 6; s++) {
      const sx = w * 0.2 + Math.random() * w * 0.6;
      const sy = rampartTop - 10 - s * 8 - Math.random() * 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 8 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Ground below rampart ---
  ctx.fillStyle = COL_STONE;
  ctx.fillRect(0, rampartTop + rampartH, w, h - (rampartTop + rampartH));
}

function drawTower(ctx, x, wallTop, tw, th, stage) {
  const towerTop = wallTop - th;
  ctx.fillStyle = COL_STONE_LIGHT;
  ctx.fillRect(x - tw / 2, towerTop, tw, th);

  // Tower cap (pointed)
  ctx.fillStyle = '#1F1A10';
  ctx.beginPath();
  ctx.moveTo(x - tw / 2 - 2, towerTop);
  ctx.lineTo(x, towerTop - th * 0.2);
  ctx.lineTo(x + tw / 2 + 2, towerTop);
  ctx.closePath();
  ctx.fill();

  // Window slit
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(x - 2, towerTop + th * 0.3, 4, th * 0.15);

  // Damage to tower
  if (stage <= 2) {
    ctx.fillStyle = '#0c0a06';
    ctx.fillRect(x - tw * 0.3, towerTop + th * 0.5, tw * 0.3, th * 0.3);
  }
}

function drawCrack(ctx, x, y, length, segments) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < segments; i++) {
    x += (Math.random() - 0.3) * (length / segments);
    y += Math.random() * (length / segments) * 0.8;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawFire(ctx, x, y) {
  // Simple flame shapes
  const flames = [
    { dx: 0, dy: 0, r: 6, col: COL_FIRE },
    { dx: -3, dy: -4, r: 4, col: '#FF6600' },
    { dx: 2, dy: -7, r: 3, col: '#FFAA00' },
    { dx: -1, dy: -10, r: 2, col: '#FFCC44' },
  ];
  for (const f of flames) {
    ctx.fillStyle = f.col;
    ctx.beginPath();
    ctx.arc(x + f.dx, y + f.dy, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
