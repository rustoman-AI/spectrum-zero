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
  ALTAR_OVERHEAT_TIME, ALTAR_RECOVER_TIME, MIRROR_FIELD_BOT
} from './config.js';
import { getScene, getWorldWidth, getOverlayScene } from './renderer.js';
import { getSegments } from './beam.js';
import { getEnemyPool } from './enemy.js';

let resources = { bronze: 0, silver: 0, gold: 0 };
let faith = 0;
const altars = [];

// --- Floating "+1 <metal>" combat text ---
// A small pool of textured sprite planes that rise, expand and fade over ~0.7s
// whenever a lit altar generates a whole unit. Textures are pre-rendered per
// metal type (fixed strings "+1 Bz/Si/Gd") and shared; the pool just animates
// position/scale/opacity. Expired popups are hidden (removed from the render).
const POPUP_LIFE = 0.7;      // seconds
const POPUP_RISE = 5.0;      // world units risen over the life (~25px at this scale)
const popupPool = [];
const POPUP_POOL_SIZE = 24;
const popupTextures = {};    // type -> CanvasTexture
let popupGroup = null;

export function getResources() { return resources; }
export function getFaith() { return faith; }
export function gainFaith(amount) { faith += amount; }

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
  resources = { bronze: 0, silver: 0, gold: 0 };
  faith = 0;
  for (const a of altars) {
    a.litTime = 0; a.overheated = false; a.cooldown = 0; a.everLit = false;
    a.intAccum = 0;
  }
  // Retire any in-flight floating popups so none carry into the new run.
  for (let i = 0; i < popupPool.length; i++) {
    popupPool[i].userData.life = 0;
    popupPool[i].visible = false;
    popupPool[i].material.opacity = 0;
  }
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

    // --- Ceremonial brazier + eternal flame ---
    // A small Greek fire-bowl on the altar with a per-metal coloured flame, so
    // the altars instantly read as divine generating shrines. Drawn on a canvas
    // texture (bowl + layered flame gradient) and gently flickered per frame.
    const braMesh = makeBrazierMesh(def);
    // Sit the brazier on the altar body, just above its centre.
    braMesh.position.set(def.x, def.y + 0.8, 0.06);
    scene.add(braMesh);

    // --- High-contrast label + resource-tick indicator ---
    // Bold near-black name with a crisp white outline (strokeText) for legibility
    // against any background, plus a "+N <Metal>/s" tick so players instantly
    // know what the altar generates. Positioned ABOVE the altar (and clear of the
    // shop tray boundary at ~y-44.5), so the ability tray never covers it.
    const labelMesh = makeAltarLabelMesh(def);
    // ~y-41: above the altar + brazier and well clear of the shop tray top
    // (~y-44.5), so the ability tray can never cover the label, while staying
    // below the battlement line (y-40) so it doesn't float up onto the wall.
    labelMesh.position.set(def.x, def.y + 3.0, 0.07);
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
      type: def.type, colour: def.colour, popup: def.popup, short: def.short,
      x: def.x, y: def.y,
      mesh, glowMesh, arcMesh, arcRadius, labelMesh,
      braMesh, flameMesh: braMesh.userData.flameMesh,
      lit: false, everLit: false,
      litTime: 0, overheated: false, cooldown: 0,
      intAccum: 0, // last whole-unit count seen, for +1 popup detection
    });
  }

  initResourcePopups();
}

// Pre-render the "+1 Bz/Si/Gd" textures (one per metal) and build a reusable
// pool of sprite planes. Colours come from each altar def's `popup`.
function initResourcePopups() {
  const oScene = getOverlayScene();
  popupPool.length = 0;
  for (const k in popupTextures) delete popupTextures[k];

  if (!popupGroup) {
    popupGroup = new THREE.Group();
    oScene.add(popupGroup);
  } else {
    // Clear any meshes from a prior run.
    while (popupGroup.children.length) popupGroup.remove(popupGroup.children[0]);
  }

  // One shared texture per altar type.
  for (const def of ALTAR_POSITIONS) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const c = cv.getContext('2d');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = 'bold 30px monospace';
    const txt = '+1 ' + (def.short || def.type);
    // Dark outline for contrast, coloured fill in the metal's popup tint.
    c.lineJoin = 'round';
    c.lineWidth = 6;
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(txt, 64, 34);
    c.fillStyle = def.popup || '#ffffff';
    c.fillText(txt, 64, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
    tex.minFilter = THREE.LinearFilter;
    popupTextures[def.type] = tex;
  }

  // Reusable sprite pool. Each starts hidden with life=0.
  for (let i = 0; i < POPUP_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), mat);
    mesh.visible = false;
    mesh.userData = { life: 0 };
    popupGroup.add(mesh);
    popupPool.push(mesh);
  }
}

// Spawn a "+1 <metal>" popup just above an altar. Grabs a dead pool sprite.
function spawnResourcePopup(altar) {
  const tex = popupTextures[altar.type];
  if (!tex) return;
  let mesh = null;
  for (let i = 0; i < popupPool.length; i++) {
    if (popupPool[i].userData.life <= 0) { mesh = popupPool[i]; break; }
  }
  if (!mesh) return; // pool exhausted this frame; skip (avoids unbounded growth)
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
  // Start just above the brazier flame; small horizontal jitter so stacked
  // ticks don't perfectly overlap.
  mesh.userData.life = POPUP_LIFE;
  mesh.userData.startY = altar.y + 3.0;
  mesh.userData.x = altar.x + (Math.random() - 0.5) * 1.6;
  mesh.position.set(mesh.userData.x, mesh.userData.startY, 0.4);
  mesh.scale.set(1, 1, 1);
  mesh.material.opacity = 1;
  mesh.visible = true;
}

// Animate + retire floating popups. Rise, expand slightly, fade over POPUP_LIFE.
function updateResourcePopups(dt) {
  for (let i = 0; i < popupPool.length; i++) {
    const m = popupPool[i];
    if (m.userData.life <= 0) continue;
    m.userData.life -= dt;
    if (m.userData.life <= 0) {
      // Expired: hide + free immediately.
      m.visible = false;
      m.material.opacity = 0;
      continue;
    }
    const t = 1 - m.userData.life / POPUP_LIFE; // 0 -> 1 over the life
    m.position.y = m.userData.startY + t * POPUP_RISE;
    const s = 1 + t * 0.35;          // expand ~35%
    m.scale.set(s, s, 1);
    m.material.opacity = 1 - t;      // fade 1 -> 0
  }
}

// Build a small ceremonial brazier (fire-bowl + eternal flame) as a canvas
// texture on a plane. Returns the mesh; the animated flame plane is stashed on
// mesh.userData.flameMesh so updateFoundries can flicker it. `def.flame` is the
// metal-specific flame colour; the bowl is tinted from `def.colour`.
function makeBrazierMesh(def) {
  const group = new THREE.Group();

  // --- Bowl (metal fire-bowl on a short stem) ---
  const bowlCv = document.createElement('canvas');
  bowlCv.width = 128; bowlCv.height = 96;
  const b = bowlCv.getContext('2d');
  const metal = '#' + def.colour.toString(16).padStart(6, '0');
  // Stem
  b.fillStyle = 'rgba(0,0,0,0.35)';
  b.fillRect(58, 60, 12, 30);
  b.fillStyle = metal;
  b.fillRect(56, 58, 16, 30);
  // Base foot
  b.fillRect(44, 86, 40, 8);
  // Bowl: a shallow metallic cup with a rim highlight.
  b.beginPath();
  b.moveTo(28, 54);
  b.quadraticCurveTo(64, 82, 100, 54); // rounded underside
  b.lineTo(96, 46);
  b.quadraticCurveTo(64, 60, 32, 46);  // inner lip
  b.closePath();
  b.fillStyle = metal;
  b.fill();
  // Rim highlight (metallic sheen)
  b.strokeStyle = 'rgba(255,255,255,0.55)';
  b.lineWidth = 2.5;
  b.beginPath();
  b.moveTo(30, 47);
  b.quadraticCurveTo(64, 61, 98, 47);
  b.stroke();
  const bowlTex = new THREE.CanvasTexture(bowlCv);
  bowlTex.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  bowlTex.minFilter = THREE.LinearFilter;
  const bowlMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3.15),
    new THREE.MeshBasicMaterial({ map: bowlTex, transparent: true, depthWrite: false })
  );
  bowlMesh.position.set(0, -0.5, 0);
  group.add(bowlMesh);

  // --- Flame (additive, layered teardrop in the metal's flame colour) ---
  const flCv = document.createElement('canvas');
  flCv.width = 64; flCv.height = 96;
  const f = flCv.getContext('2d');
  const drawFlame = (cx, topY, wid, hgt, col, a) => {
    f.beginPath();
    f.moveTo(cx, topY);                                   // pointed tip
    f.quadraticCurveTo(cx + wid, topY + hgt * 0.55, cx, topY + hgt); // right edge to base
    f.quadraticCurveTo(cx - wid, topY + hgt * 0.55, cx, topY);       // left edge back to tip
    f.closePath();
    f.fillStyle = col;
    f.globalAlpha = a;
    f.fill();
  };
  // Outer coloured flame, then a hot white-ish core.
  drawFlame(32, 8, 20, 78, def.flame, 0.85);
  drawFlame(32, 24, 11, 56, '#fff6d8', 0.9);
  f.globalAlpha = 1;
  const flTex = new THREE.CanvasTexture(flCv);
  flTex.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  flTex.minFilter = THREE.LinearFilter;
  const flameMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 3.15),
    new THREE.MeshBasicMaterial({
      map: flTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
    })
  );
  // Flame rises from inside the bowl.
  flameMesh.position.set(0, 1.4, 0.02);
  group.add(flameMesh);

  group.userData.flameMesh = flameMesh;
  return group;
}

// Build the high-contrast altar label + resource-tick as a single canvas texture
// plane. Bold near-black glyphs with a crisp white outline; a "+N <Metal>/s"
// line beneath in the metal's tint so the generated currency is unmistakable.
function makeAltarLabelMesh(def) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const c = cv.getContext('2d');
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';

  const name = def.label || def.type.toUpperCase();
  // Name: crisp white outline + near-black fill for max contrast on any bg.
  c.font = 'bold 34px monospace';
  c.lineWidth = 6;
  c.strokeStyle = '#f2f2f2';
  c.strokeText(name, 128, 30);
  c.fillStyle = '#111111';
  c.fillText(name, 128, 30);

  // Resource tick: "+N <Metal>/s" using the altar's LIT generation rate, in the
  // metal's tint with a dark outline so it stays legible.
  const rate = (ALTAR_RATES[def.type] && ALTAR_RATES[def.type].lit) || 1;
  const tick = '+' + rate + ' ' + (def.short || def.type) + '/s';
  const metal = '#' + def.colour.toString(16).padStart(6, '0');
  c.font = 'bold 22px monospace';
  c.lineWidth = 5;
  c.strokeStyle = '#0a0a0a';
  c.strokeText(tick, 128, 68);
  c.fillStyle = metal;
  c.fillText(tick, 128, 68);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  tex.minFilter = THREE.LinearFilter;
  // Plane aspect 256:96 -> keep it readable but compact over the altar.
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 3.56),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: false })
  );
  return mesh;
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
        segments[s].active = true; // beam feeding an altar → full-opacity tier
        // don't break: mark all segments feeding this altar
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
    const before = resources[altar.type];
    resources[altar.type] = before + totalRate * dt;

    // Floating "+1" combat text: spawn one popup per WHOLE unit generated while
    // the altar is lit (beam feeding it). Passive-only trickle doesn't pop, so
    // the popups clearly read as "the beam is producing". Cap at a couple per
    // frame so a huge dt hitch can't flood the pool.
    if (altar.lit) {
      const nowInt = Math.floor(resources[altar.type]);
      let crossed = nowInt - altar.intAccum;
      altar.intAccum = nowInt;
      if (crossed > 2) crossed = 2;
      for (let n = 0; n < crossed; n++) spawnResourcePopup(altar);
    } else {
      // Keep the counter in sync while unlit so re-lighting doesn't burst.
      altar.intAccum = Math.floor(resources[altar.type]);
    }

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

    // 4. Eternal flame flicker. Gentle idle flicker; taller/brighter while the
    // altar is actively lit by a beam (it's "receiving offering"), calmer when
    // overheated. Two out-of-phase sines keep the motion organic, not periodic.
    if (altar.flameMesh) {
      const fl = altar.flameMesh;
      const seed = altar.x * 0.7;
      const flick = 0.5 + 0.5 * Math.sin(time * 9 + seed) * Math.sin(time * 5.3 + seed * 1.7);
      let baseScale = altar.lit ? (altar.overheated ? 1.05 : 1.35) : 1.0;
      const sy = baseScale * (0.9 + flick * 0.22);
      const sx = 0.9 + flick * 0.12;
      fl.scale.set(sx, sy, 1);
      fl.material.opacity = (altar.lit ? 0.95 : 0.8) * (0.82 + flick * 0.18);
      // Slight vertical bob so the tip dances above the bowl rim.
      fl.position.y = 1.4 + (sy - 1) * 1.2;
    }
  }

  // Passive Faith trickle per actively burning ship, so Faith builds naturally
  // toward the ultimates even before a Helios cast. Rate cut 0.5 -> 0.15/s and
  // the burning count capped, because a single Zeus ignites a whole screen and
  // the old rate let one cast generate ~130 Faith — enough to nearly re-buy
  // itself. Now a Zeus's own fire yields only a modest trickle; sustained beam
  // burning is the reliable path. (Helios still grants its burst on top.)
  let burning = 0;
  const pool = getEnemyPool();
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (e.active && e.heat > 0 && !e.shieldBlocking) burning++;
  }
  faith += Math.min(burning, 4) * 0.08 * dt; // drip 0.15->0.08: the passive floor
  // was the real Faith engine (0.45/s at 3 ships ≈ 81 Faith/180s ≈ 3 casts on
  // its own). Halving it lands a committed run near ~4 total Zeus/Poseidon casts
  // while a casual run keeps a reachable repeat. Cap still guards mass ignition.

  // Animate + retire floating "+1" resource popups.
  updateResourcePopups(dt);
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

// Legacy compatibility (brass removed → maps to bronze, the common tier)
export function getSlag() { return resources.bronze; }
export function getInsight() { return resources.bronze; }
export function getRecombination() { return 0; }
export function getInsightLog() { return []; }
export function spendSlag() {}
export function spendInsight() {}
export function addSlagDirect(amount) { resources.bronze += amount; }
export function getFoundryColliders() { return []; }
export function getAltarAudioState() {
  let litCount = 0;
  let anyOverheated = false;
  for (const a of altars) {
    if (a.lit) litCount++;
    if (a.overheated) anyOverheated = true;
  }
  return { litCount, anyOverheated };
}
