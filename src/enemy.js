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

export function initEnemies() {
  const scene = getScene();
  enemyGroup = new THREE.Group();
  scene.add(enemyGroup);

  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(3, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.3;

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

    enemyGroup.add(mesh);
    pool.push({
      active: false, type: 'skiff',
      hp: 0, maxHp: 0, armour: 0, heat: 0,
      lane: 0, y: SHIP_SPAWN_Y,
      speed: 0, baseSpeed: 0,
      burn: 0, slowed: false,
      bandsHitting: 0, lastHitColour: 0,
      mesh, barFill
    });
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
      e.y = SHIP_SPAWN_Y;
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
    e.y -= e.speed * dt; // descend
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

export function triggerKillEffect(enemy, reward) {
  addKillReward(reward);
  enemy.mesh.material.color.setHex(0xffffff);
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
  e.mesh.position.x = x;
  e.mesh.position.y = e.y;
}

function updateEnemyVisual(e) {
  e.burn = Math.max(0, (e.heat || 0) / e.maxHp);
  e.barFill.scale.x = e.burn;
  e.barFill.position.x = -2.5 * (1 - e.burn);
  if (e.bandsHitting > 0 && e.lastHitColour !== 0) {
    const r = ((e.lastHitColour >> 16) & 0xff) / 255;
    const g = ((e.lastHitColour >> 8) & 0xff) / 255;
    const b = (e.lastHitColour & 0xff) / 255;
    const t = Math.min(0.3 + e.burn * 1.0, 1.0);
    e.mesh.material.color.setRGB(0.25*(1-t)+r*t, 0.2*(1-t)+g*t, 0.2*(1-t)+b*t);
  } else if (e.slowed) {
    e.mesh.material.color.setRGB(0.4, 0.5, 0.25);
  } else {
    const brightness = 0.35 + 0.15 * (1 - e.burn);
    e.mesh.material.color.setRGB(brightness, brightness*0.8, brightness*0.8);
  }
  const sizes = { skiff: 2.5, trireme: 3.5, quadrireme: 4.5, flagship: 8 };
  const s = sizes[e.type] || 3;
  e.mesh.scale.set(s/3, s/3, 1);
}
