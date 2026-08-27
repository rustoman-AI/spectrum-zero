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
  CHORUS_SLOW_FACTOR, HEAT_DECAY_RATE, RESONANCE_MULTIPLIER, PRISM_TIERS
} from './config.js';
import { getSegments, getResonanceActive } from './beam.js';
import { getEnemyPool, deactivateEnemy, applyGoldSlow, triggerKillEffect } from './enemy.js';
import { getWorldWidth, getScene } from './renderer.js';
import { getFocusMultiplier } from './crafting.js';
import { addSlagDirect } from './foundry.js';
import { spawnContactGlow, spawnSparks, spawnDestruction } from './effects.js';
import { getActiveTier } from './prism.js';
import { playSinkGlug, playDeflect } from './audio.js';
import { isShieldDisabled } from './helios.js';

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
    enemy.shieldBlocking = false;

    // Enemy world position
    const ex = -worldWidth / 2 + laneWidth * (enemy.lane + 0.5);
    const ey = enemy.y;

    // Count full bands (intensity=1) and sub-rays (intensity<1) hitting this enemy
    let fullBands = 0;
    let subRays = 0;
    let subRayIntensity = 0;
    let goldHitting = false;
    let hitColour = 0;
    let totalBeamsHitting = 0;
    let contactX = ex, contactY = ey; // exact beam-hull contact point (first hit)
    let haveContact = false;

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      // Pre-split beam (raw sun column) does no damage
      if (seg.preSplit) continue;
      if (segmentIntersectsBox(seg, ex, ey, ENEMY_HIT_HALF_W, ENEMY_HIT_HALF_H)) {
        // Shield-bearer check: block beams within shieldAngle degrees of vertical.
        // Helios flare overpowers the plates — beams pass straight through.
        if (enemy.shieldAngle > 0 && !isShieldDisabled()) {
          const dx = seg.end.x - seg.start.x;
          const dy = seg.end.y - seg.start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            // Angle from vertical: atan2(|horizontal|, |vertical|)
            const angleFromVert = Math.atan2(Math.abs(dx / len), Math.abs(dy / len)) * (180 / Math.PI);
            if (angleFromVert <= enemy.shieldAngle) {
              // Blocked — deflection sparks + metallic sound + label, at the
              // exact point where the beam meets the shield plate.
              const cp = segmentBoxEntry(seg, ex, ey, ENEMY_HIT_HALF_W, ENEMY_HIT_HALF_H);
              const bx = cp ? cp.x : ex;
              const by = cp ? cp.y : ey + ENEMY_HIT_HALF_H;
              if (Math.random() < dt * 8) {
                spawnContactGlow(bx, by, 0xccaa44, 5);
                spawnSparks(bx, by, 0xffcc66, 3);
                playDeflect();
              }
              // Show "BLOCKED" label (throttled to once per ~1s per enemy)
              if (!enemy._lastBlockLabel || performance.now() - enemy._lastBlockLabel > 1000) {
                enemy._lastBlockLabel = performance.now();
                spawnBlockedLabel(ex, ey + ENEMY_HIT_HALF_H + 2);
              }
              enemy.shieldBlocking = true;
              continue; // this segment does no damage
            }
          }
        }
        totalBeamsHitting++;
        hitColour = seg.colour;
        if (!haveContact) {
          const cp = segmentBoxEntry(seg, ex, ey, ENEMY_HIT_HALF_W, ENEMY_HIT_HALF_H);
          if (cp) { contactX = cp.x; contactY = cp.y; haveContact = true; }
        }
        if (seg.colour === COLOUR_GOLD) goldHitting = true;
        if (seg.intensity >= 1.0) {
          fullBands++;
        } else {
          subRays++;
          subRayIntensity = seg.intensity;
        }
      }
    }

    // Update visual state for burn feedback
    enemy.bandsHitting = totalBeamsHitting;
    if (hitColour) enemy.lastHitColour = hitColour;

    // Apply gold slow
    if (goldHitting) {
      applyGoldSlow(enemy);
    }

    // Apply damage
    if (totalBeamsHitting > 0) {
      // -------------------------------------------------------
      // Damage formula (tier-aware, sub-rays excluded from synergy):
      //   tier = active prism tier → dBase, synergy from PRISM_TIERS
      //   synergyDPS = fullBands * dBase * (1 + synergy * (fullBands-1))
      //   flatDPS = subRays * dBase * subRayIntensity
      //   totalRaw = (synergyDPS + flatDPS) * focusMult * resonanceMult
      //   final = max(0, totalRaw - armour * totalBeams)
      // -------------------------------------------------------
      const tier = getActiveTier();
      const tierData = PRISM_TIERS[tier] || PRISM_TIERS[3];
      const dBase = tierData.dBase;
      const synBonus = tierData.synergy;
      const focusMult = getFocusMultiplier();
      const resMult = getResonanceActive() ? RESONANCE_MULTIPLIER : 1.0;
      const synergyDPS = fullBands > 0 ? fullBands * dBase * (1 + synBonus * (fullBands - 1)) : 0;
      const flatDPS = subRays * dBase * (subRayIntensity || 0.5);
      const raw = (synergyDPS + flatDPS) * focusMult * resMult;
      const dmg = Math.max(0, raw - enemy.armour * totalBeamsHitting);
      // Heat accumulator: damage adds heat, enemy dies when heat >= effectiveHP
      enemy.heat += dmg * dt;
      enemy.burn = enemy.heat / enemy.maxHp;

      // Intense contact FX at the exact beam-hull contact point.
      // A bright white-hot core glow every frame plus throttled sparks.
      spawnContactGlow(contactX, contactY, 0xffffff, raw * 1.5);
      if (Math.random() < dt * 20) {
        spawnContactGlow(contactX, contactY, hitColour || 0xffaa00, raw);
        spawnSparks(contactX, contactY, hitColour || 0xffcc66, 3);
      }

      if (enemy.heat >= enemy.maxHp) {
        const rewards = { mote: 5, husk: 10, carapace: 20, devourer: 0 };
        const reward = rewards[enemy.type] || 0;
        addSlagDirect(reward);
        totalKills++;
        const ex = -worldWidth / 2 + laneWidth * (enemy.lane + 0.5);
        const heavy = (enemy.type === 'flagship' || enemy.type === 'quadrireme');
        spawnDestruction(ex, enemy.y, heavy);
        // Sinking glug plays after the explosion (200ms delay)
        setTimeout(playSinkGlug, 200);
        triggerKillEffect(enemy, reward);
        deactivateEnemy(enemy);
      }
    } else {
      enemy.bandsHitting = 0;
      // Heat decay: accumulated heat cools when beam is not on target
      if (enemy.heat > 0) {
        enemy.heat = Math.max(0, enemy.heat - enemy.maxHp * HEAT_DECAY_RATE * dt);
        enemy.burn = enemy.heat / enemy.maxHp;
      }
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

// Return the exact point where a beam segment enters the enemy hitbox,
// i.e. the contact point on the hull/shield. Returns null if no intersection.
function segmentBoxEntry(seg, cx, cy, hw, hh) {
  const sx = seg.start.x, sy = seg.start.y;
  const dx = seg.end.x - sx, dy = seg.end.y - sy;
  const xmin = cx - hw, xmax = cx + hw;
  const ymin = cy - hh, ymax = cy + hh;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-8) {
    if (sx < xmin || sx > xmax) return null;
  } else {
    let t1 = (xmin - sx) / dx, t2 = (xmax - sx) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-8) {
    if (sy < ymin || sy > ymax) return null;
  } else {
    let t1 = (ymin - sy) / dy, t2 = (ymax - sy) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  // tmin is the entry parameter (clamped to segment start at 0)
  return { x: sx + dx * tmin, y: sy + dy * tmin };
}

// --- "BLOCKED" floating label ---
const blockedLabels = [];
let blockedTexture = null;

function getBlockedTexture() {
  if (blockedTexture) return blockedTexture;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const ctx = c.getContext('2d');
  // Bright white text with orange stroke for maximum contrast
  ctx.strokeStyle = '#FF6600';
  ctx.lineWidth = 3;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('BLOCKED', 64, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('BLOCKED', 64, 16);
  blockedTexture = new THREE.CanvasTexture(c);
  blockedTexture.minFilter = THREE.LinearFilter;
  blockedTexture.premultiplyAlpha = false;
  return blockedTexture;
}

function spawnBlockedLabel(x, y) {
  const scene = getScene();
  const geo = new THREE.PlaneGeometry(7, 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getBlockedTexture(), transparent: true, opacity: 1, alphaTest: 0.05, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 7);
  scene.add(mesh);
  blockedLabels.push({ mesh, life: 1.0, vy: 5 });
}

// Called from main loop to animate floating labels
export function updateBlockedLabels(dt) {
  for (let i = blockedLabels.length - 1; i >= 0; i--) {
    const l = blockedLabels[i];
    l.life -= dt;
    l.mesh.position.y += l.vy * dt;
    l.mesh.material.opacity = Math.max(0, l.life / 0.8);
    if (l.life <= 0) {
      const scene = getScene();
      scene.remove(l.mesh);
      l.mesh.geometry.dispose();
      l.mesh.material.dispose();
      blockedLabels.splice(i, 1);
    }
  }
}
