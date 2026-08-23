// ============================================================
// src/enemy.js — Enemy pool with burn feedback
//
// Visual feedback:
//  - Burn meter (bar above enemy) fills as HP drops
//  - Body heats up in the beam colour as it burns
//  - Kill effect: flash + slag number popup
//  - Multi-band synergy: burn meter fills faster, visually brighter
// ============================================================

import {
  ENEMY_POOL_SIZE, ENEMY_TYPES, ENEMY_SPAWN_Y, BREACH_Y,
  ENEMY_LANE_COUNT, WORLD_HEIGHT, BREACH_DAMAGE_FLOOR, BREACH_BASE_DAMAGE
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';

const pool = [];
let enemyGroup = null;
let breachLineMesh = null;

// Kill effect pool (reusable popup meshes)
const killPopups = [];
const MAX_POPUPS = 8;

export function initEnemies() {
  const scene = getScene();
  enemyGroup = new THREE.Group();
  scene.add(enemyGroup);

  // Enemy pool
  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    // Body mesh
    const geo = new THREE.PlaneGeometry(3, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = -0.2;

    // Burn meter (wide bar above enemy, with dark backing)
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    barBg.position.y = 2.5;
    barBg.position.z = 0.1;
    mesh.add(barBg);

    const barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff4400 })
    );
    barFill.position.y = 2.5;
    barFill.position.z = 0.15;
    barFill.scale.x = 0;
    mesh.add(barFill);

    enemyGroup.add(mesh);

    pool.push({
      active: false, type: 'mote',
      hp: 0, maxHp: 0, armour: 0, heat: 0,
      lane: 0, y: ENEMY_SPAWN_Y,
      speed: 0, baseSpeed: 0,
      burn: 0, slowed: false,
      bandsHitting: 0, lastHitColour: 0,
      mesh, barFill
    });
  }

  // Kill popups
  for (let i = 0; i < MAX_POPUPS; i++) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 48; pCanvas.height = 20;
    const pTex = new THREE.CanvasTexture(pCanvas);
    pTex.minFilter = THREE.LinearFilter;
    const pMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 2),
      new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false })
    );
    pMesh.visible = false;
    pMesh.position.z = 0.5;
    scene.add(pMesh);
    killPopups.push({ mesh: pMesh, canvas: pCanvas, tex: pTex, life: 0 });
  }
}

export function getEnemyPool() { return pool; }

export function spawnEnemy(type, lane, hpMultiplier) {
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
      e.lane = lane;
      e.y = ENEMY_SPAWN_Y;
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

export function updateEnemies(dt) {
  let wallDamage = 0;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    e.slowed = false;
    e.y += e.speed * dt;
    if (e.y >= BREACH_Y) {
      // Scaled breach damage: reduced by heat fraction
      const heatFrac = Math.min(1, (e.heat || 0) / e.maxHp);
      const scale = Math.max(BREACH_DAMAGE_FLOOR, 1 - heatFrac);
      const baseDmg = BREACH_BASE_DAMAGE[e.type] || 10;
      wallDamage += baseDmg * scale;
      deactivateEnemy(e);
      continue;
    }
    positionEnemy(e);
    updateEnemyVisual(e);
  }
  // Update kill popups
  for (const p of killPopups) {
    if (p.life > 0) {
      p.life -= dt;
      p.mesh.position.y += 8 * dt;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) p.mesh.visible = false;
    }
  }
  return wallDamage;
}

export function applyGoldSlow(enemy) { enemy.slowed = true; }

export function applySlowStates() {
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    e.speed = e.slowed ? e.baseSpeed * 0.5 : e.baseSpeed;
  }
}

export function deactivateEnemy(enemy) {
  enemy.active = false;
  enemy.mesh.visible = false;
}

// Called from damage.js when an enemy is killed
export function triggerKillEffect(enemy, slagReward) {
  // Flash: briefly brighten mesh before hiding
  enemy.mesh.material.color.setHex(0xffffff);
  // Spawn kill popup showing slag reward
  for (const p of killPopups) {
    if (p.life <= 0) {
      const ctx = p.canvas.getContext('2d');
      ctx.clearRect(0, 0, 48, 20);
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+' + slagReward + 'S', 24, 15);
      p.tex.needsUpdate = true;
      p.mesh.position.x = enemy.mesh.position.x;
      p.mesh.position.y = enemy.mesh.position.y + 3;
      p.mesh.visible = true;
      p.mesh.material.opacity = 1;
      p.life = 0.8;
      break;
    }
  }
}

export function getActiveEnemies() { return pool.filter(e => e.active); }

export function resetEnemies() {
  for (let i = 0; i < pool.length; i++) {
    pool[i].active = false;
    pool[i].mesh.visible = false;
  }
  for (const p of killPopups) { p.life = 0; p.mesh.visible = false; }
}

function positionEnemy(e) {
  const worldWidth = getWorldWidth();
  const laneWidth = worldWidth / ENEMY_LANE_COUNT;
  const x = -worldWidth / 2 + laneWidth * (e.lane + 0.5);
  e.mesh.position.x = x;
  e.mesh.position.y = e.y;
}

function updateEnemyVisual(e) {
  // Burn is driven by heat accumulator, not HP
  e.burn = Math.max(0, (e.heat || 0) / e.maxHp);
  // Burn meter: wide, thick, anchored left
  e.barFill.scale.x = e.burn;
  e.barFill.position.x = -2.5 * (1 - e.burn);
  // Body heats up IMMEDIATELY in the beam's colour (30% base tint + burn)
  if (e.bandsHitting > 0 && e.lastHitColour !== 0) {
    const r = ((e.lastHitColour >> 16) & 0xff) / 255;
    const g = ((e.lastHitColour >> 8) & 0xff) / 255;
    const b = (e.lastHitColour & 0xff) / 255;
    const t = Math.min(0.3 + e.burn * 1.0, 1.0);
    e.mesh.material.color.setRGB(
      0.25 * (1 - t) + r * t,
      0.2 * (1 - t) + g * t,
      0.2 * (1 - t) + b * t
    );
    const barBright = Math.min(1, 0.5 + e.bandsHitting * 0.25);
    e.barFill.material.color.setRGB(barBright, barBright * 0.4, 0);
  } else if (e.slowed) {
    // Gold slow visual: blue-gold tint + slight transparency
    e.mesh.material.color.setRGB(0.4, 0.5, 0.25);
    e.barFill.material.color.setHex(0xffe9a0);
  } else {
    const brightness = 0.35 + 0.15 * (1 - e.burn);
    e.mesh.material.color.setRGB(brightness, brightness * 0.8, brightness * 0.8);
    e.barFill.material.color.setHex(0xff4400);
  }
  const sizes = { mote: 2.5, husk: 3.5, carapace: 4.5, devourer: 8 };
  const s = sizes[e.type] || 3;
  e.mesh.scale.set(s / 3, s / 3, 1);
}
