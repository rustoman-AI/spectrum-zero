// ============================================================
// src/damage.js — DPS formula, armour, kill handling
//
// Per frame: for each active enemy, count beam segments that
// intersect its hitbox. Apply the DPS formula from the GDD:
//
//   DPS = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1))
//   final = max(0, DPS - armour * N)
//   enemy.hp -= final * dt
//
// Gold band also applies slow via enemy.js.
// On kill: deactivate enemy, award Slag.
// ============================================================

import {
  D_BASE, SYNERGY_BONUS, COLOUR_GOLD, ENEMY_LANE_COUNT,
  CHORUS_SLOW_FACTOR
} from './config.js';
import { getSegments } from './beam.js';
import { getEnemyPool, deactivateEnemy, applyGoldSlow, triggerKillEffect } from './enemy.js';
import { getWorldWidth } from './renderer.js';
import { getFocusMultiplier } from './crafting.js';
import { addSlagDirect } from './foundry.js';
import { spawnContactGlow, spawnSparks, spawnDestruction } from './effects.js';
import { RESONANCE_MULTIPLIER } from './config.js';
import { getResonanceActive } from './beam.js';

const ENEMY_HIT_HALF_W = 3;
const ENEMY_HIT_HALF_H = 3;
let totalKills = 0;

export function getKillCount() { return totalKills; }
export function resetDamage() { totalKills = 0; }

export function updateDamage(dt) {
  const segments = getSegments();
  const pool = getEnemyPool();
  const worldWidth = getWorldWidth();
  const laneWidth = worldWidth / ENEMY_LANE_COUNT;

  for (let i = 0; i < pool.length; i++) {
    const enemy = pool[i];
    if (!enemy.active) continue;

    // Enemy world position
    const ex = -worldWidth / 2 + laneWidth * (enemy.lane + 0.5);
    const ey = enemy.y;

    // Count how many beam segments hit this enemy
    let bandsHitting = 0;
    let goldHitting = false;
    let hitColour = 0;

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      if (segmentIntersectsBox(seg, ex, ey, ENEMY_HIT_HALF_W, ENEMY_HIT_HALF_H)) {
        bandsHitting++;
        hitColour = seg.colour;
        if (seg.colour === COLOUR_GOLD) goldHitting = true;
      }
    }

    // Update visual state for burn feedback
    enemy.bandsHitting = bandsHitting;
    if (hitColour) enemy.lastHitColour = hitColour;

    // Apply gold slow
    if (goldHitting) {
      applyGoldSlow(enemy);
    }

    // Apply damage
    if (bandsHitting > 0) {
      // -------------------------------------------------------
      // Damage formula (from GDD §8.1):
      //   DPS = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1)) * focusMult
      //   final = max(0, DPS - armour * N)
      // -------------------------------------------------------
      const N = bandsHitting;
      const focusMult = getFocusMultiplier();
      const resMult = getResonanceActive() ? RESONANCE_MULTIPLIER : 1.0;
      const raw = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1)) * focusMult * resMult;
      const dmg = Math.max(0, raw - enemy.armour * N);
      enemy.hp -= dmg * dt;
      enemy.burn = 1 - (enemy.hp / enemy.maxHp);

      // Contact glow + sparks (throttled: every ~0.1s)
      if (Math.random() < dt * 10) {
        const ex = -worldWidth / 2 + laneWidth * (enemy.lane + 0.5);
        spawnContactGlow(ex, enemy.y, hitColour || 0xffaa00, raw);
        spawnSparks(ex, enemy.y, hitColour || 0xffaa00, 2);
      }

      if (enemy.hp <= 0) {
        const rewards = { mote: 5, husk: 10, carapace: 20, devourer: 0 };
        const reward = rewards[enemy.type] || 0;
        addSlagDirect(reward);
        totalKills++;
        const ex = -worldWidth / 2 + laneWidth * (enemy.lane + 0.5);
        spawnDestruction(ex, enemy.y);
        triggerKillEffect(enemy, reward);
        deactivateEnemy(enemy);
      }
    } else {
      enemy.bandsHitting = 0;
    }
  }
}

// Test if a line segment (beam) intersects an axis-aligned box (enemy hitbox)
function segmentIntersectsBox(seg, cx, cy, hw, hh) {
  // Use parametric line-vs-AABB test
  const sx = seg.start.x;
  const sy = seg.start.y;
  const ex = seg.end.x;
  const ey = seg.end.y;
  const dx = ex - sx;
  const dy = ey - sy;

  // Box bounds
  const xmin = cx - hw;
  const xmax = cx + hw;
  const ymin = cy - hh;
  const ymax = cy + hh;

  let tmin = 0;
  let tmax = 1;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (sx < xmin || sx > xmax) return false;
  } else {
    let t1 = (xmin - sx) / dx;
    let t2 = (xmax - sx) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (sy < ymin || sy > ymax) return false;
  } else {
    let t1 = (ymin - sy) / dy;
    let t2 = (ymax - sy) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}
