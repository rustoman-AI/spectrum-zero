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
let shieldBearerTimer = 0;
let firstShieldSpawned = false;

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

  // Shield-bearer spawning (separate timer)
  // First at 30s alone in centre, then every 20s from 60s
  if (!firstShieldSpawned && spawnerElapsed >= 30) {
    firstShieldSpawned = true;
    spawnEnemy('shieldbearer', 2, 1.0); // centre lane, no escalation on first
    shieldBearerTimer = 20;
  } else if (firstShieldSpawned && spawnerElapsed >= 60) {
    shieldBearerTimer -= dt;
    if (shieldBearerTimer <= 0) {
      shieldBearerTimer = 20;
      const hpMult = 1 + (spawnerElapsed / SESSION_DURATION) * ESCALATION_HP_FACTOR;
      // Phase 2: centre only. Phase 3+: also flanks
      if (spawnerElapsed >= PHASE_2_END) {
        const flankLane = Math.random() < 0.5 ? 0 : 4;
        spawnEnemy('shieldbearer', flankLane, hpMult);
      } else {
        spawnEnemy('shieldbearer', 2, hpMult);
      }
    }
  }
}

export function resetSpawner() {
  spawnTimer = INITIAL_DELAY;
  spawnerElapsed = 0;
  totalSpawns = 0;
  flagshipSpawned = false;
  shieldBearerTimer = 0;
  firstShieldSpawned = false;
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
    // Heavier ships in centre lane (lane 2), lighter on edges
    const centreLane = 2;
    const edgeLane = Math.random() < 0.5 ? 0 : 4;
    const roll = Math.random();
    if (roll < 0.3) {
      // Heavy in centre
      spawnEnemy('quadrireme', centreLane, hpMult);
    } else if (roll < 0.6) {
      spawnEnemy('trireme', centreLane, hpMult);
    } else {
      // Fast skiffs on random lane
      spawnEnemy('skiff', lane, hpMult);
    }
    // Periodic paired edge waves (every 5th spawn)
    if (totalSpawns % 5 === 0) {
      spawnEnemy('skiff', 0, hpMult);
      spawnEnemy('skiff', 4, hpMult);
    }
  } else {
    // Phase 3: heavy centre + paired edges
    const centreLane = 2;
    const roll = Math.random();
    if (roll < 0.4) {
      spawnEnemy('quadrireme', centreLane, hpMult);
    } else if (roll < 0.7) {
      spawnEnemy('trireme', centreLane, hpMult);
    } else {
      spawnEnemy('skiff', lane, hpMult);
    }
    if (totalSpawns % 4 === 0) {
      spawnEnemy('trireme', 0, hpMult);
      spawnEnemy('trireme', 4, hpMult);
    }
  }
}
