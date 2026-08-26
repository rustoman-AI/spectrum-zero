// ============================================================
// src/enemy.js — Ships spawn at top, descend toward wall at bottom
// ============================================================

import {
  ENEMY_POOL_SIZE, ENEMY_TYPES, SHIP_SPAWN_Y, WALL_Y,
  ENEMY_LANE_COUNT, WORLD_HEIGHT, BREACH_DAMAGE
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';
import { addKillReward } from './foundry.js';

const pool = [];
let enemyGroup = null;
const shipTextures = {};

// --- Procedural ship sprite generation (drawn to canvas at load) ---
function generateShipTextures() {
  const types = ['skiff', 'trireme', 'quadrireme', 'shieldbearer', 'flagship'];
  for (const type of types) {
    const sz = 128;
    const c = document.createElement('canvas');
    c.width = sz; c.height = sz;
    const ctx = c.getContext('2d');
    drawShip(ctx, sz, type);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    shipTextures[type] = tex;
  }
}

function drawShip(ctx, sz, type) {
  const cx = sz / 2;
  const cy = sz / 2;
  ctx.clearRect(0, 0, sz, sz);

  // Ship type variations
  const configs = {
    skiff:        { hullW: 0.55, hullH: 0.18, prowLen: 0.12, mastH: 0.40, sailW: 0.35, sailH: 0.30, oars: 0, stripe: '#8B4513', hullCol: '#6B4226', deckCol: '#9E6B3E' },
    trireme:      { hullW: 0.65, hullH: 0.20, prowLen: 0.15, mastH: 0.30, sailW: 0.18, sailH: 0.15, oars: 5, stripe: '#C41E3A', hullCol: '#5C3317', deckCol: '#8B6B4A' },
    quadrireme:   { hullW: 0.72, hullH: 0.22, prowLen: 0.16, mastH: 0.30, sailW: 0.20, sailH: 0.15, oars: 7, stripe: '#1E5631', hullCol: '#4A2B10', deckCol: '#7A5B3A' },
    shieldbearer: { hullW: 0.68, hullH: 0.22, prowLen: 0.14, mastH: 0.28, sailW: 0.16, sailH: 0.12, oars: 5, stripe: '#CC8844', hullCol: '#5C3317', deckCol: '#8B6B4A' },
    flagship:     { hullW: 0.80, hullH: 0.25, prowLen: 0.18, mastH: 0.55, sailW: 0.50, sailH: 0.40, oars: 0, stripe: '#DAA520', hullCol: '#3D1F00', deckCol: '#6B4226' },
  };
  const cfg = configs[type] || configs.skiff;

  const hullW = cfg.hullW * sz;
  const hullH = cfg.hullH * sz;
  const prowLen = cfg.prowLen * sz;
  const mastH = cfg.mastH * sz;
  const sailW = cfg.sailW * sz;
  const sailH = cfg.sailH * sz;

  // Hull (pointed prow at top, flat stern at bottom)
  const hullTop = cy - hullH * 0.3;
  const hullBot = cy + hullH * 0.7;
  const prowTip = hullTop - prowLen;

  ctx.save();

  // Hull body with carved prow
  ctx.beginPath();
  ctx.moveTo(cx, prowTip);                          // prow tip (top centre)
  ctx.quadraticCurveTo(cx + hullW * 0.3, hullTop, cx + hullW / 2, hullTop + hullH * 0.3); // right bow curve
  ctx.lineTo(cx + hullW / 2, hullBot - 4);         // right side
  ctx.quadraticCurveTo(cx + hullW * 0.4, hullBot, cx, hullBot); // stern curve right
  ctx.quadraticCurveTo(cx - hullW * 0.4, hullBot, cx - hullW / 2, hullBot - 4); // stern curve left
  ctx.lineTo(cx - hullW / 2, hullTop + hullH * 0.3); // left side
  ctx.quadraticCurveTo(cx - hullW * 0.3, hullTop, cx, prowTip); // left bow curve
  ctx.closePath();
  ctx.fillStyle = cfg.hullCol;
  ctx.fill();

  // Deck (lighter inner area)
  ctx.beginPath();
  const deckInset = 4;
  ctx.ellipse(cx, cy + 2, hullW / 2 - deckInset, hullH * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = cfg.deckCol;
  ctx.fill();

  // Painted stripe along the hull sides
  ctx.strokeStyle = cfg.stripe;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - hullW / 2 + 3, cy);
  ctx.lineTo(cx - hullW * 0.2, hullTop + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + hullW / 2 - 3, cy);
  ctx.lineTo(cx + hullW * 0.2, hullTop + 6);
  ctx.stroke();

  // Oar strokes along sides
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.7)';
  ctx.lineWidth = 1;
  const oarStartY = cy - hullH * 0.1;
  const oarEndY = cy + hullH * 0.5;
  const oarSpacing = (oarEndY - oarStartY) / (cfg.oars + 1);
  for (let i = 1; i <= cfg.oars; i++) {
    const oy = oarStartY + i * oarSpacing;
    // Left oar
    ctx.beginPath();
    ctx.moveTo(cx - hullW / 2, oy);
    ctx.lineTo(cx - hullW / 2 - 8, oy + 3);
    ctx.stroke();
    // Right oar
    ctx.beginPath();
    ctx.moveTo(cx + hullW / 2, oy);
    ctx.lineTo(cx + hullW / 2 + 8, oy + 3);
    ctx.stroke();
  }

  // Mast
  ctx.fillStyle = '#3D2010';
  ctx.fillRect(cx - 1.5, cy - mastH, 3, mastH * 0.9);

  // Sail (trapezoid/triangle)
  ctx.fillStyle = 'rgba(230, 215, 190, 0.85)';
  ctx.beginPath();
  ctx.moveTo(cx - sailW / 2, cy - mastH * 0.2);
  ctx.lineTo(cx + sailW / 2, cy - mastH * 0.2);
  ctx.lineTo(cx + sailW * 0.3, cy - mastH * 0.85);
  ctx.lineTo(cx - sailW * 0.3, cy - mastH * 0.85);
  ctx.closePath();
  ctx.fill();
  // Sail cross-bar
  ctx.strokeStyle = '#3D2010';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - sailW / 2, cy - mastH * 0.2);
  ctx.lineTo(cx + sailW / 2, cy - mastH * 0.2);
  ctx.stroke();

  // Prow ornament (small ram/beak)
  ctx.fillStyle = '#2A1500';
  ctx.beginPath();
  ctx.moveTo(cx, prowTip - 3);
  ctx.lineTo(cx - 3, prowTip + 4);
  ctx.lineTo(cx + 3, prowTip + 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function initEnemies() {
  const scene = getScene();
  enemyGroup = new THREE.Group();
  scene.add(enemyGroup);

  // Generate ship sprite textures (procedural canvas, no image files)
  generateShipTextures();

  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    const mesh = new THREE.Group();
    mesh.position.z = 0.3;

    // Ship sprite (canvas-drawn, swapped per type)
    const spriteGeo = new THREE.PlaneGeometry(6, 6);
    const spriteMat = new THREE.MeshBasicMaterial({
      map: shipTextures.skiff, transparent: true, depthWrite: false
    });
    const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
    spriteMesh.position.z = 0.01;
    mesh.add(spriteMesh);

    mesh.visible = false;

    // Burn meter bar
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    barBg.position.y = -2.5;
    barBg.position.z = 0.1;
    mesh.add(barBg);
    const barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff4400 })
    );
    barFill.position.y = -2.5;
    barFill.position.z = 0.15;
    barFill.scale.x = 0;
    mesh.add(barFill);

    // Shield plate (visible only on shield-bearer type)
    const shieldPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xCC8844, transparent: true, opacity: 0.9 })
    );
    shieldPlate.position.y = 2.8;
    shieldPlate.position.z = 0.06;
    shieldPlate.visible = false;
    mesh.add(shieldPlate);

    // Oars (3 per side, animated at runtime for oared ships)
    const oarMeshes = [];
    const OAR_COUNT = 3;
    const oarMat = new THREE.MeshBasicMaterial({ color: 0x5C3D2E });
    for (let side = -1; side <= 1; side += 2) {
      for (let oi = 0; oi < OAR_COUNT; oi++) {
        const oarGeo = new THREE.PlaneGeometry(0.2, 1.6);
        const oar = new THREE.Mesh(oarGeo, oarMat);
        // Position: along hull sides, spread vertically
        oar.position.x = side * 2.2;
        oar.position.y = oi * 0.8 - (OAR_COUNT * 0.8) / 2;
        oar.position.z = -0.02; // BEHIND the hull sprite
        oar.rotation.z = side * 0.3; // angled outward
        oar.visible = false;
        mesh.add(oar);
        oarMeshes.push({ mesh: oar, side, index: oi });
      }
    }

    enemyGroup.add(mesh);
    pool.push({
      active: false, type: 'skiff',
      hp: 0, maxHp: 0, armour: 0, heat: 0,
      lane: 0, y: SHIP_SPAWN_Y,
      speed: 0, baseSpeed: 0,
      burn: 0, slowed: false,
      bandsHitting: 0, lastHitColour: 0,
      mesh, barFill, shieldPlate, oarMeshes, spriteMat, hullMat: spriteMat
    });
  }
}

export function getEnemyPool() { return pool; }

export function spawnEnemy(type, lane, hpMultiplier, yOffset) {
  const template = ENEMY_TYPES[type];
  if (!template) return null;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) {
      e.active = true;
      e.type = type;
      e.maxHp = template.hp * hpMultiplier;
      e.hp = e.maxHp;
      e.armour = template.armour;
      e.shieldAngle = template.shieldAngle || 0;
      e.shieldBlocking = false;
      e.stunTimer = 0;
      e.propulsion = template.propulsion || 'oared';
      e.oarPhase = Math.random() * Math.PI * 2; // random start phase
      e.driftX = 0;
      e.lane = lane;
      e.y = SHIP_SPAWN_Y + (yOffset || 0);
      e.speed = template.speed;
      e.baseSpeed = template.speed;
      e.burn = 0;
      e.heat = 0;
      e.slowed = false;
      e.bandsHitting = 0;
      e.lastHitColour = 0;
      e.mesh.visible = true;
      e.barFill.scale.x = 0;
      positionEnemy(e);
      updateEnemyVisual(e);
      return e;
    }
  }
  return null;
}

// Ships move DOWNWARD (negative Y)
export function updateEnemies(dt) {
  let wallDamage = 0;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    e.slowed = false;
    // Zeus stun: skip movement while stunned
    if (e.stunTimer && e.stunTimer > 0) {
      e.stunTimer -= dt;
    } else {
      e.y -= e.speed * dt; // descend
    }

    // Propulsion animation
    if (e.propulsion === 'oared') {
      // Oar cycle: slow synchronized stroke (period ~2s)
      e.oarPhase += dt * 3.2; // ~2s full cycle
      // Hull rock: once per two strokes, ±1.5 degrees (slower, less twitchy)
      e.mesh.rotation.z = Math.sin(e.oarPhase * 0.5) * 0.026;
      e.driftX = 0;
    } else {
      // Sailed: gentle lateral drift (slow sinusoid)
      e.oarPhase += dt * 1.2;
      e.driftX = Math.sin(e.oarPhase) * 0.8; // gentle sway
      e.mesh.rotation.z = Math.sin(e.oarPhase * 0.7) * 0.015; // very slight roll
    }

    if (e.y <= WALL_Y) {
      // Breach: ship reached the wall
      const dmg = BREACH_DAMAGE[e.type] || 10;
      const heatFrac = Math.min(1, (e.heat || 0) / e.maxHp);
      wallDamage += dmg * Math.max(0.2, 1 - heatFrac);
      deactivateEnemy(e);
      continue;
    }
    positionEnemy(e);
    updateEnemyVisual(e);
  }
  return wallDamage;
}

export function applyGoldSlow(enemy) { enemy.slowed = true; }

// Wind state: affects sailed ships more than oared
let windActive = false;
const WIND_SAIL_SLOW = 0.35;  // sailed ships slowed to 35% speed
const WIND_OAR_SLOW = 0.85;  // oared ships barely affected (85%)

export function setWindActive(active) { windActive = active; }
export function isWindActive() { return windActive; }

export function applySlowStates() {
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    let speedMult = 1.0;
    if (e.slowed) speedMult *= 0.5; // gold beam slow
    if (windActive) {
      speedMult *= (e.propulsion === 'sailed') ? WIND_SAIL_SLOW : WIND_OAR_SLOW;
    }
    e.speed = e.baseSpeed * speedMult;
  }
}

export function deactivateEnemy(enemy) {
  enemy.active = false;
  enemy.mesh.visible = false;
}

export function triggerKillEffect(enemy, reward) {
  addKillReward(reward);
  if (enemy.hullMat) enemy.hullMat.color.setHex(0xffffff);
}

export function getActiveEnemies() { return pool.filter(e => e.active); }

export function resetEnemies() {
  for (let i = 0; i < pool.length; i++) {
    pool[i].active = false;
    pool[i].mesh.visible = false;
  }
}

function positionEnemy(e) {
  const worldWidth = getWorldWidth();
  const laneWidth = worldWidth / ENEMY_LANE_COUNT;
  const x = -worldWidth / 2 + laneWidth * (e.lane + 0.5);
  e.mesh.position.x = x + (e.driftX || 0);
  e.mesh.position.y = e.y;
}

function updateEnemyVisual(e) {
  e.burn = Math.max(0, (e.heat || 0) / e.maxHp);
  e.barFill.scale.x = e.burn;
  e.barFill.position.x = -2.5 * (1 - e.burn);

  // Swap sprite texture to match type
  const tex = shipTextures[e.type] || shipTextures.skiff;
  if (e.spriteMat.map !== tex) {
    e.spriteMat.map = tex;
    e.spriteMat.needsUpdate = true;
  }

  // Burn tint on sprite
  if (e.bandsHitting > 0 && e.lastHitColour !== 0) {
    const r = ((e.lastHitColour >> 16) & 0xff) / 255;
    const g = ((e.lastHitColour >> 8) & 0xff) / 255;
    const b = (e.lastHitColour & 0xff) / 255;
    const t = Math.min(0.3 + e.burn * 0.7, 1.0);
    e.spriteMat.color.setRGB(1*(1-t)+r*t, 1*(1-t)+g*t, 1*(1-t)+b*t);
  } else if (e.slowed) {
    e.spriteMat.color.setRGB(0.7, 0.9, 0.5);
  } else {
    e.spriteMat.color.setRGB(1, 1, 1); // neutral (texture has its own colours)
  }

  const sizes = { skiff: 2.5, trireme: 3.5, quadrireme: 4.5, shieldbearer: 4.0, flagship: 8 };
  const s = sizes[e.type] || 3;
  e.mesh.scale.set(s/3, s/3, 1);
  // Shield plate visibility
  if (e.shieldPlate) e.shieldPlate.visible = (e.type === 'shieldbearer');

  // Oar animation (oared ships only)
  if (e.oarMeshes) {
    const isOared = e.propulsion === 'oared';
    for (const oarObj of e.oarMeshes) {
      oarObj.mesh.visible = isOared;
      if (isOared) {
        // Synchronized rowing stroke: rotate oars in unison
        const stroke = Math.sin(e.oarPhase + oarObj.index * 0.3);
        oarObj.mesh.rotation.z = oarObj.side * (0.3 + stroke * 0.4);
      }
    }
  }
}
