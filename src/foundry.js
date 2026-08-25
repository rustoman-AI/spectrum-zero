// ============================================================
// src/foundry.js — Beam-powered altar economy with overheat
//
// 4 altar zones on the city ground. Each requires a beam held on it
// for 80% of its rate. 20% accrues passively.
// Overheat: efficiency halves after 6s continuous, recovers over 10s.
// No beam can reach an altar AND a ship (opposite directions).
// ============================================================

import {
  ALTAR_RATES, ALTAR_POSITIONS, ALTAR_HW, ALTAR_HH,
  ALTAR_OVERHEAT_TIME, ALTAR_RECOVER_TIME
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';
import { getSegments } from './beam.js';

let resources = { brass: 0, bronze: 0, silver: 0, gold: 0 };
let faith = 0;
let priestCount = 0;
const altars = [];

export function getResources() { return resources; }
export function getFaith() { return faith; }
export function getPriestCount() { return priestCount; }
export function addPriest() { priestCount++; }

export function canAfford(cost) {
  if (!cost) return false;
  for (const key in cost) {
    if ((resources[key] || 0) < cost[key]) return false;
  }
  return true;
}

export function spend(cost) {
  for (const key in cost) { resources[key] -= cost[key]; }
}

export function addKillReward(reward) {
  if (!reward) return;
  for (const key in reward) { resources[key] = (resources[key] || 0) + reward[key]; }
}

export function resetFoundries() {
  resources = { brass: 0, bronze: 0, silver: 0, gold: 0 };
  faith = 0;
  priestCount = 0;
  for (const a of altars) { a.litTime = 0; a.overheated = false; a.cooldown = 0; a.everLit = false; }
}

export function spendFaith(amount) { faith -= amount; }

export function initFoundries() {
  const scene = getScene();
  resetFoundries();
  altars.length = 0;

  for (let i = 0; i < ALTAR_POSITIONS.length; i++) {
    const def = ALTAR_POSITIONS[i];

    // --- Glow ring (attention-grabbing pulse when unlit) ---
    const glowGeo = new THREE.RingGeometry(
      Math.max(ALTAR_HW, ALTAR_HH) * 1.3,
      Math.max(ALTAR_HW, ALTAR_HH) * 1.6,
      32
    );
    const glowMat = new THREE.MeshBasicMaterial({
      color: def.colour, transparent: true, opacity: 0.0, side: THREE.DoubleSide
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(def.x, def.y, -0.2);
    scene.add(glowMesh);

    // --- Altar body mesh ---
    const geo = new THREE.PlaneGeometry(ALTAR_HW * 2, ALTAR_HH * 2);
    const mat = new THREE.MeshBasicMaterial({
      color: def.colour, transparent: true, opacity: 0.25
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(def.x, def.y, -0.1);
    scene.add(mesh);

    // --- Label ---
    const lCanvas = document.createElement('canvas');
    lCanvas.width = 64; lCanvas.height = 20;
    const lCtx = lCanvas.getContext('2d');
    lCtx.fillStyle = '#ffffff';
    lCtx.font = 'bold 10px monospace';
    lCtx.textAlign = 'center';
    lCtx.fillText(def.type.toUpperCase(), 32, 14);
    const lTex = new THREE.CanvasTexture(lCanvas);
    lTex.minFilter = THREE.LinearFilter;
    const lGeo = new THREE.PlaneGeometry(6, 2);
    const lMat = new THREE.MeshBasicMaterial({ map: lTex, transparent: true, depthWrite: false });
    const labelMesh = new THREE.Mesh(lGeo, lMat);
    labelMesh.position.set(def.x, def.y + ALTAR_HH + 1.5, 0.2);
    scene.add(labelMesh);

    // --- Overheat arc (RingGeometry with partial theta) ---
    const arcRadius = Math.max(ALTAR_HW, ALTAR_HH) * 1.1;
    const arcGeo = new THREE.RingGeometry(arcRadius - 0.3, arcRadius, 32, 1, 0, 0.01);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x44cc44, transparent: true, opacity: 0.9, side: THREE.DoubleSide
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.set(def.x, def.y, 0.3);
    arcMesh.visible = false;
    scene.add(arcMesh);

    altars.push({
      type: def.type, colour: def.colour,
      x: def.x, y: def.y,
      mesh, glowMesh, arcMesh, arcRadius,
      lit: false, everLit: false,
      litTime: 0, overheated: false, cooldown: 0
    });
  }
}

export function updateFoundries(dt) {
  const segments = getSegments();
  const time = performance.now() * 0.001; // seconds for animation

  for (const altar of altars) {
    // Check if any beam segment hits this altar (segment-vs-AABB)
    // Pre-split beam (raw sun column) does not power altars
    altar.lit = false;
    for (let s = 0; s < segments.length; s++) {
      if (segments[s].preSplit) continue;
      if (segHitsBox(segments[s], altar.x, altar.y, ALTAR_HW, ALTAR_HH)) {
        altar.lit = true;
        break;
      }
    }
    if (altar.lit) altar.everLit = true;

    // Overheat logic
    if (altar.lit) {
      altar.litTime += dt;
      altar.cooldown = 0;
    } else {
      altar.litTime = 0;
      if (altar.overheated) {
        altar.cooldown += dt;
        if (altar.cooldown >= ALTAR_RECOVER_TIME) {
          altar.overheated = false;
          altar.cooldown = 0;
        }
      }
    }
    if (altar.litTime >= ALTAR_OVERHEAT_TIME && !altar.overheated) {
      altar.overheated = true;
    }

    // Compute efficiency
    let efficiency = 1.0;
    if (altar.overheated) efficiency = 0.5;

    // Resource accumulation
    const rates = ALTAR_RATES[altar.type];
    const passiveRate = rates.passive;
    const litRate = altar.lit ? rates.lit : 0;
    const totalRate = (passiveRate + litRate) * efficiency;
    resources[altar.type] += totalRate * dt;

    // --- VISUAL FEEDBACK ---

    // 1. Body mesh opacity
    if (altar.lit) {
      altar.mesh.material.opacity = altar.overheated ? 0.55 : 0.8;
    } else {
      // Unlit: gentle pulse if never lit (attract attention)
      if (!altar.everLit) {
        const pulse = 0.2 + 0.15 * Math.sin(time * 2.5 + altar.x * 0.5);
        altar.mesh.material.opacity = pulse;
      } else {
        altar.mesh.material.opacity = 0.25;
      }
    }

    // 2. Glow ring
    if (altar.lit) {
      // Steady bright glow matching metal colour
      altar.glowMesh.material.opacity = altar.overheated ? 0.2 : 0.5;
    } else if (!altar.everLit) {
      // Attention pulse — gentle breathing glow
      const gPulse = 0.1 + 0.2 * Math.abs(Math.sin(time * 1.8 + altar.x * 0.3));
      altar.glowMesh.material.opacity = gPulse;
    } else {
      altar.glowMesh.material.opacity = 0.0;
    }

    // 3. Overheat arc
    const heatFrac = Math.min(1, altar.litTime / ALTAR_OVERHEAT_TIME);
    const coolFrac = altar.overheated ? (1 - altar.cooldown / ALTAR_RECOVER_TIME) : 0;
    const arcFrac = altar.lit ? heatFrac : coolFrac;

    if (arcFrac > 0.01) {
      altar.arcMesh.visible = true;
      // Rebuild arc geometry with new theta length
      const theta = arcFrac * Math.PI * 2;
      altar.arcMesh.geometry.dispose();
      altar.arcMesh.geometry = new THREE.RingGeometry(
        altar.arcRadius - 0.3, altar.arcRadius, 32, 1,
        Math.PI * 0.5, // start at top
        theta
      );
      // Color: green → yellow → red
      if (arcFrac < 0.5) altar.arcMesh.material.color.setHex(0x44cc44);
      else if (arcFrac < 0.8) altar.arcMesh.material.color.setHex(0xcccc44);
      else altar.arcMesh.material.color.setHex(0xcc4444);
      if (altar.overheated) altar.arcMesh.material.color.setHex(0xcc4444);
    } else {
      altar.arcMesh.visible = false;
    }
  }

  // Priests generate faith
  faith += priestCount * dt;
}

// Segment-vs-AABB intersection test
function segHitsBox(seg, cx, cy, hw, hh) {
  const sx = seg.start.x, sy = seg.start.y;
  const ex = seg.end.x, ey = seg.end.y;
  const dx = ex - sx, dy = ey - sy;
  const xmin = cx - hw, xmax = cx + hw;
  const ymin = cy - hh, ymax = cy + hh;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-8) {
    if (sx < xmin || sx > xmax) return false;
  } else {
    let t1 = (xmin - sx) / dx, t2 = (xmax - sx) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-8) {
    if (sy < ymin || sy > ymax) return false;
  } else {
    let t1 = (ymin - sy) / dy, t2 = (ymax - sy) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Legacy compatibility
export function getSlag() { return resources.brass; }
export function getInsight() { return resources.bronze; }
export function getRecombination() { return 0; }
export function getInsightLog() { return []; }
export function spendSlag() {}
export function spendInsight() {}
export function addSlagDirect(amount) { resources.brass += amount; }
export function getFoundryColliders() { return []; }
