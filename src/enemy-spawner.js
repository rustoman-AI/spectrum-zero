// ============================================================
// src/enemy-spawner.js — Spawn schedule for 600s session
// Phase 1 (0-1:00): Skiffs. Phase 2 (1-3:00): Triremes+Quadriremes.
// Phase 3 (3-9:00): Heavy mix. Phase 4 (9-10:00): Flagship.
// ============================================================

import {
  ENEMY_LANE_COUNT, SESSION_DURATION, ESCALATION_HP_FACTOR,
  PHASE_1_END, PHASE_2_END, PHASE_3_END
} from './config.js';
import { spawnEnemy } from './enemy.js';

const PHASE1_INTERVAL = 2.5;
const PHASE2_INTERVAL = 1.5;
const PHASE3_INTERVAL = 1.2;
const INITIAL_DELAY = 2.0;

let spawnTimer = 0;
let spawnerElapsed = 0;
let totalSpawns = 0;
let flagshipSpawned = false;

export function getSpawnCount() { return totalSpawns; }
export function getCurrentInterval() { return getInterval(); }

export function updateSpawner(dt, sessionTime) {
  spawnerElapsed = sessionTime;
  spawnTimer -= dt;
  if (spawnTimer <= 0 && spawnerElapsed >= INITIAL_DELAY) {
    doSpawn();
    totalSpawns++;
    spawnTimer = getInterval();
  }
}

export function resetSpawner() {
  spawnTimer = INITIAL_DELAY;
  spawnerElapsed = 0;
  totalSpawns = 0;
  flagshipSpawned = false;
}

function getInterval() {
  if (spawnerElapsed < PHASE_1_END) return PHASE1_INTERVAL;
  if (spawnerElapsed < PHASE_2_END) return PHASE2_INTERVAL;
  return PHASE3_INTERVAL;
}

function doSpawn() {
  const hpMult = 1 + (spawnerElapsed / SESSION_DURATION) * ESCALATION_HP_FACTOR;
  const lane = Math.floor(Math.random() * ENEMY_LANE_COUNT);

  if (spawnerElapsed >= PHASE_3_END && !flagshipSpawned) {
    // Flagship at 9:00
    spawnEnemy('flagship', 2, 1.0); // no escalation on boss
    flagshipSpawned = true;
    return;
  }

  if (spawnerElapsed < PHASE_1_END) {
    spawnEnemy('skiff', lane, hpMult);
  } else if (spawnerElapsed < PHASE_2_END) {
    const roll = Math.random();
    if (roll < 0.4) spawnEnemy('trireme', lane, hpMult);
    else if (roll < 0.7) spawnEnemy('skiff', lane, hpMult);
    else spawnEnemy('quadrireme', lane, hpMult);
  } else {
    const roll = Math.random();
    if (roll < 0.35) spawnEnemy('quadrireme', lane, hpMult);
    else if (roll < 0.7) spawnEnemy('trireme', lane, hpMult);
    else spawnEnemy('skiff', lane, hpMult);
  }
}
