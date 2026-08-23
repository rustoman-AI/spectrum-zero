// ============================================================
// src/enemy-spawner.js — Spawn schedule with paired spawning
//
// Phase 1: Motes only, single spawns, interval ramps 3.5→2.0s
// Phase 2+: Paired spawns at opposing X (60%+ apart), within 2s.
//   Fast mote on the OFF-side (away from current beam direction).
// ============================================================

import {
  ENEMY_LANE_COUNT, SESSION_DURATION, ESCALATION_HP_FACTOR,
  PHASE_1_END, PHASE_2_END, PHASE_3_END
} from './config.js';
import { spawnEnemy } from './enemy.js';
import { getSegments } from './beam.js';

const PHASE1_INTERVAL_START = 3.5;
const PHASE1_INTERVAL_END = 2.0;
const PHASE2_INTERVAL = 1.8;
const PHASE3_INTERVAL = 1.5;
const INITIAL_DELAY = 3.0;
const PAIR_DELAY = 1.5; // seconds between members of a pair
const PAIR_MIN_SEPARATION = 3; // minimum lane gap (60% of 5 = 3 lanes apart)

let spawnTimer = 0;
let spawnerElapsed = 0;
let totalSpawns = 0;
let pendingPair = null; // { type, lane, hpMult, timer }

export function getSpawnCount() { return totalSpawns; }
export function getCurrentInterval() { return getInterval(); }

export function updateSpawner(dt, sessionTime) {
  spawnerElapsed = sessionTime;
  // Handle pending pair member
  if (pendingPair) {
    pendingPair.timer -= dt;
    if (pendingPair.timer <= 0) {
      spawnEnemy(pendingPair.type, pendingPair.lane, pendingPair.hpMult);
      totalSpawns++;
      pendingPair = null;
    }
  }
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
  pendingPair = null;
}

function getInterval() {
  if (spawnerElapsed < PHASE_1_END) {
    const t = (spawnerElapsed - INITIAL_DELAY) / (PHASE_1_END - INITIAL_DELAY);
    const clamped = Math.max(0, Math.min(1, t));
    return PHASE1_INTERVAL_START + (PHASE1_INTERVAL_END - PHASE1_INTERVAL_START) * clamped;
  }
  if (spawnerElapsed < PHASE_2_END) return PHASE2_INTERVAL;
  return PHASE3_INTERVAL;
}

// Determine which side the beam is currently pointing (left or right of centre)
function getBeamSide() {
  const segs = getSegments();
  let avgX = 0;
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    avgX += segs[i].end.x;
    count++;
  }
  return count > 0 ? (avgX / count > 0 ? 'right' : 'left') : 'left';
}

function doSpawn() {
  const hpMult = getEscalationMultiplier(spawnerElapsed);

  if (spawnerElapsed < PHASE_1_END) {
    // Phase 1: single motes, random lane
    const lane = Math.floor(Math.random() * ENEMY_LANE_COUNT);
    spawnEnemy('mote', lane, hpMult);
  } else {
    // Phase 2+: paired spawns at opposing sides
    const beamSide = getBeamSide();
    // Primary spawn: heavy on beam side (player sees it, focuses on it)
    // Secondary (pair): fast mote on OFF side (pressure where attention isn't)
    const primaryLane = beamSide === 'right'
      ? Math.floor(Math.random() * 2) + 3  // lanes 3-4 (right side)
      : Math.floor(Math.random() * 2);      // lanes 0-1 (left side)
    const offLane = beamSide === 'right'
      ? Math.floor(Math.random() * 2)       // lanes 0-1 (left, off-side)
      : Math.floor(Math.random() * 2) + 3;  // lanes 3-4 (right, off-side)

    // Ensure separation >= PAIR_MIN_SEPARATION
    const actualSep = Math.abs(primaryLane - offLane);
    const finalOffLane = actualSep >= PAIR_MIN_SEPARATION ? offLane :
      (primaryLane < 2 ? ENEMY_LANE_COUNT - 1 : 0);

    // Primary: husk or carapace
    if (spawnerElapsed < PHASE_2_END) {
      const roll = Math.random();
      if (roll < 0.5) spawnEnemy('husk', primaryLane, hpMult);
      else if (roll < 0.85) spawnEnemy('carapace', primaryLane, hpMult);
      else spawnEnemy('mote', primaryLane, hpMult);
    } else {
      const roll = Math.random();
      if (roll < 0.4) spawnEnemy('carapace', primaryLane, hpMult);
      else spawnEnemy('husk', primaryLane, hpMult);
    }

    // Schedule the off-side pair member (fast mote) after PAIR_DELAY
    pendingPair = { type: 'mote', lane: finalOffLane, hpMult, timer: PAIR_DELAY };
  }
}

function getEscalationMultiplier(t) {
  return 1 + (t / SESSION_DURATION) * ESCALATION_HP_FACTOR;
}
