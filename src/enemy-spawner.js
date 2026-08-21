// ============================================================
// src/enemy-spawner.js — Spawn schedule, escalation curve
//
// Phase 1 (0:00–4:00): Motes only, interval ramps from 3.5s to 2.0s
// Phase 2 (4:00–10:00): Husks + Carapaces, interval 1.8s
// Phase 3+ (10:00+): heavier mix, interval 1.5s (M4 will refine)
//
// Initial delay: 3.0s (no enemies in the first few seconds)
// Escalation: hp_multiplier = 1 + (t / 900) * 3
// ============================================================

import {
  ENEMY_LANE_COUNT, SESSION_DURATION, ESCALATION_HP_FACTOR,
  PHASE_1_END, PHASE_2_END, PHASE_3_END
} from './config.js';
import { spawnEnemy } from './enemy.js';

// Interval bounds
const PHASE1_INTERVAL_START = 3.5; // seconds, at t=0
const PHASE1_INTERVAL_END = 2.0;   // seconds, at t=PHASE_1_END
const PHASE2_INTERVAL = 1.8;
const PHASE3_INTERVAL = 1.5;
const INITIAL_DELAY = 3.0;         // no spawns before this

let spawnTimer = 0;
let spawnerElapsed = 0;
let totalSpawns = 0;

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
}

function getInterval() {
  if (spawnerElapsed < PHASE_1_END) {
    // Ramp: linearly interpolate from START to END over Phase 1
    const t = (spawnerElapsed - INITIAL_DELAY) / (PHASE_1_END - INITIAL_DELAY);
    const clamped = Math.max(0, Math.min(1, t));
    return PHASE1_INTERVAL_START + (PHASE1_INTERVAL_END - PHASE1_INTERVAL_START) * clamped;
  }
  if (spawnerElapsed < PHASE_2_END) return PHASE2_INTERVAL;
  return PHASE3_INTERVAL;
}

function doSpawn() {
  const hpMult = getEscalationMultiplier(spawnerElapsed);
  const lane = Math.floor(Math.random() * ENEMY_LANE_COUNT);

  if (spawnerElapsed < PHASE_1_END) {
    spawnEnemy('mote', lane, hpMult);
  } else if (spawnerElapsed < PHASE_2_END) {
    const roll = Math.random();
    if (roll < 0.5) {
      spawnEnemy('husk', lane, hpMult);
    } else if (roll < 0.85) {
      spawnEnemy('mote', lane, hpMult);
    } else {
      spawnEnemy('carapace', lane, hpMult);
    }
  } else {
    const roll = Math.random();
    if (roll < 0.3) {
      spawnEnemy('carapace', lane, hpMult);
    } else if (roll < 0.7) {
      spawnEnemy('husk', lane, hpMult);
    } else {
      spawnEnemy('mote', lane, hpMult);
    }
  }
}

// hp_multiplier = 1 + (t / 900) * 3
function getEscalationMultiplier(t) {
  return 1 + (t / SESSION_DURATION) * ESCALATION_HP_FACTOR;
}
