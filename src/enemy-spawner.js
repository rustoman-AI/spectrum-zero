// ============================================================
// src/enemy-spawner.js — Spawn schedule for 600s session
// Phase 1 (0-60s): Liburnae, first cataphract at 30s.
// Phase 2 (60-180s): Mixed, cataphract escorts every 20s.
// Phase 3 (180-540s): Heavy, cataphracts on all lanes.
// Phase 4 (540-600s): Quinquereme.
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

// Shield-bearer escort: tight column with 6-unit Y spacing
const ESCORT_SPACING = 6;

let spawnTimer = 0;
let spawnerElapsed = 0;
let totalSpawns = 0;
let quinqueremeSpawned = false;
let shieldBearerTimer = 0;
let firstShieldSpawned = false;
let shieldBearerLaneIndex = 0; // cycles through lanes

// --- Scripted 90s opening (judge-facing tutorial curve) ---
// Deterministic spawns for the first 90s. Each event fires once when the
// session clock passes its time. After 90s the normal phase spawner takes over.
const SCRIPT_END = 90;
const OPENING_SCRIPT = [
  // 0-20s: 3 slow liburnae, spaced — easy beam-aiming + altar-feeding tutorial
  { t: 2,  fn: () => spawnEnemy('liburna', 2, 1.0) },
  { t: 9,  fn: () => spawnEnemy('liburna', 1, 1.0) },
  { t: 15, fn: () => spawnEnemy('liburna', 3, 1.0) },
  // 20-45s: paired flank spawns — forces a 2nd mirror purchase
  { t: 21, fn: () => { spawnEnemy('liburna', 0, 1.0); spawnEnemy('liburna', 4, 1.0); } },
  { t: 28, fn: () => { spawnEnemy('liburna', 0, 1.0); spawnEnemy('liburna', 4, 1.0); } },
  { t: 34, fn: () => { spawnEnemy('trireme', 0, 1.0); spawnEnemy('trireme', 4, 1.0); } },
  { t: 40, fn: () => { spawnEnemy('trireme', 1, 1.0); spawnEnemy('trireme', 3, 1.0); } },
  // 45-75s: shield-bearers + triremes — pushes Helios stun / Poseidon vortex
  { t: 46, fn: () => spawnShieldFormation(2, 1.0) },
  { t: 55, fn: () => { spawnShieldFormation(1, 1.05); spawnEnemy('trireme', 3, 1.05); } },
  { t: 64, fn: () => { spawnShieldFormation(3, 1.1); spawnEnemy('trireme', 1, 1.1); } },
  { t: 71, fn: () => { spawnEnemy('quadrireme', 2, 1.1); spawnEnemy('trireme', 0, 1.1); spawnEnemy('trireme', 4, 1.1); } },
  // 75-90s: fast assault wave — tests defence + ultimate combos
  { t: 76, fn: () => { for (let l = 0; l < 5; l++) spawnEnemy('liburna', l, 1.15); } },
  { t: 81, fn: () => { spawnEnemy('trireme', 0, 1.2); spawnEnemy('trireme', 2, 1.2); spawnEnemy('trireme', 4, 1.2); } },
  { t: 85, fn: () => { spawnShieldFormation(2, 1.2); spawnEnemy('quadrireme', 0, 1.2); spawnEnemy('quadrireme', 4, 1.2); } },
  { t: 89, fn: () => { for (let l = 0; l < 5; l++) spawnEnemy('liburna', l, 1.25); } },
];
let scriptIndex = 0;

export function getSpawnCount() { return totalSpawns; }
export function getCurrentInterval() { return getInterval(); }

export function updateSpawner(dt, sessionTime) {
  spawnerElapsed = sessionTime;

  // --- Scripted opening: deterministic curve for the first 90s ---
  if (spawnerElapsed < SCRIPT_END) {
    while (scriptIndex < OPENING_SCRIPT.length && spawnerElapsed >= OPENING_SCRIPT[scriptIndex].t) {
      OPENING_SCRIPT[scriptIndex].fn();
      totalSpawns++;
      scriptIndex++;
    }
    return; // suppress the procedural spawner during the scripted opening
  }

  // Reset the procedural timers the first time we cross out of the script so
  // the phase spawner starts cleanly (no burst from a stale timer), and mark the
  // shield-bearer intro as done (the script already taught it) so the periodic
  // branch runs instead of re-spawning the lone "first" shield-bearer.
  if (!firstShieldSpawned) {
    firstShieldSpawned = true;
    shieldBearerTimer = 20;
    spawnTimer = getInterval();
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0 && spawnerElapsed >= INITIAL_DELAY) {
    doSpawn();
    totalSpawns++;
    spawnTimer = getInterval();
  }

  // Shield-bearer + escort spawning (separate timer)
  if (!firstShieldSpawned && spawnerElapsed >= 30) {
    firstShieldSpawned = true;
    // First one: alone in centre (the lesson — isolated, readable)
    spawnShieldFormation(2, 1.0);
    shieldBearerTimer = 20;
  } else if (firstShieldSpawned && spawnerElapsed >= 60) {
    shieldBearerTimer -= dt;
    if (shieldBearerTimer <= 0) {
      shieldBearerTimer = 20;
      const hpMult = 1 + (spawnerElapsed / SESSION_DURATION) * ESCALATION_HP_FACTOR;
      // Alternate through all 5 lanes
      const lane = getNextShieldLane();
      spawnShieldFormation(lane, hpMult);
    }
  }
}

// Spawn shield-bearer leading 2-3 escorts in tight column
function spawnShieldFormation(lane, hpMult) {
  // Leader
  spawnEnemy('cataphract', lane, hpMult, 0);
  // 2 trailing ships (liburnae early, triremes later)
  const escortType = spawnerElapsed < PHASE_2_END ? 'liburna' : 'trireme';
  const escortCount = spawnerElapsed < PHASE_2_END ? 2 : 3;
  for (let i = 1; i <= escortCount; i++) {
    spawnEnemy(escortType, lane, hpMult, ESCORT_SPACING * i);
  }
}

// Cycle shield-bearer through lanes: 2, 0, 4, 1, 3, repeat
function getNextShieldLane() {
  const order = [2, 0, 4, 1, 3];
  const lane = order[shieldBearerLaneIndex % order.length];
  shieldBearerLaneIndex++;
  return lane;
}

export function resetSpawner() {
  spawnTimer = INITIAL_DELAY;
  spawnerElapsed = 0;
  totalSpawns = 0;
  quinqueremeSpawned = false;
  shieldBearerTimer = 0;
  firstShieldSpawned = false;
  shieldBearerLaneIndex = 0;
  scriptIndex = 0;
}

function getInterval() {
  if (spawnerElapsed < PHASE_1_END) return PHASE1_INTERVAL;
  if (spawnerElapsed < PHASE_2_END) return PHASE2_INTERVAL;
  return PHASE3_INTERVAL;
}

function doSpawn() {
  const hpMult = 1 + (spawnerElapsed / SESSION_DURATION) * ESCALATION_HP_FACTOR;

  if (spawnerElapsed >= PHASE_3_END && !quinqueremeSpawned) {
    // Quinquereme flagship: random lane, drifts laterally (handled in enemy update if desired)
    const bossLane = Math.floor(Math.random() * ENEMY_LANE_COUNT);
    spawnEnemy('quinquereme', bossLane, 1.0);
    quinqueremeSpawned = true;
    return;
  }

  // All phases: use full lane range for all types
  const lane = Math.floor(Math.random() * ENEMY_LANE_COUNT);

  if (spawnerElapsed < PHASE_1_END) {
    // Phase 1: liburnae on random lanes
    spawnEnemy('liburna', lane, hpMult);
  } else if (spawnerElapsed < PHASE_2_END) {
    // Phase 2: mix of types across all lanes
    const roll = Math.random();
    if (roll < 0.25) {
      spawnEnemy('quadrireme', lane, hpMult);
    } else if (roll < 0.55) {
      spawnEnemy('trireme', lane, hpMult);
    } else {
      spawnEnemy('liburna', lane, hpMult);
    }
    // Paired pressure every 5th spawn on random opposite lanes
    if (totalSpawns % 5 === 0) {
      const pairA = Math.floor(Math.random() * 2);       // 0 or 1
      const pairB = ENEMY_LANE_COUNT - 1 - pairA;        // 4 or 3
      spawnEnemy('liburna', pairA, hpMult);
      spawnEnemy('liburna', pairB, hpMult);
    }
  } else {
    // Phase 3: heavy across all lanes
    const roll = Math.random();
    if (roll < 0.35) {
      spawnEnemy('quadrireme', lane, hpMult);
    } else if (roll < 0.65) {
      spawnEnemy('trireme', lane, hpMult);
    } else {
      spawnEnemy('liburna', lane, hpMult);
    }
    // Paired heavy pressure every 4th spawn
    if (totalSpawns % 4 === 0) {
      const pairA = Math.floor(Math.random() * 2);       // 0 or 1
      const pairB = ENEMY_LANE_COUNT - 1 - pairA;        // 4 or 3
      spawnEnemy('trireme', pairA, hpMult);
      spawnEnemy('trireme', pairB, hpMult);
    }
  }
}
