// ============================================================
// src/enemy.js — Ships spawn at top, descend toward wall at bottom
// ============================================================

import {
  ENEMY_POOL_SIZE, ENEMY_TYPES, SHIP_SPAWN_Y, SHIP_TOP_BOUND, WALL_Y, BATTLEMENT_TOP_Y,
  ENEMY_LANE_COUNT, WORLD_HEIGHT, WALL_MAX_HP, BREACH_DRIP_PCT, BREACH_SINK_TIME
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';
import { addKillReward } from './foundry.js';
import { spawnSparks, spawnContactGlow, spawnDestruction, spawnSmoke, spawnWake, getGlowTex } from './effects.js';

// Breach events from the most recent updateEnemies() call, for per-lane feedback.
const lastBreaches = [];
export function getLastBreaches() { return lastBreaches; }

// Visual size (world units, ~sprite height) per ship type. Half of this is the
// ship's leading-edge offset used for the ram-line crash so no ship of any
// size ever overlaps the mirror discs.
const SHIP_SIZE = { liburna: 2.5, trireme: 3.5, quadrireme: 4.5, cataphract: 4.0, quinquereme: 8 };
function shipHalfHeight(type) { return (SHIP_SIZE[type] || 3) / 2; }

const pool = [];
let enemyGroup = null;
const shipTextures = {};

// --- Procedural ship sprite generation (drawn to canvas at load) ---
function generateShipTextures() {
  const types = ['liburna', 'trireme', 'quadrireme', 'cataphract', 'quinquereme'];
  for (const type of types) {
    const sz = 128;
    const c = document.createElement('canvas');
    c.width = sz; c.height = sz;
    const ctx = c.getContext('2d');
    drawShip(ctx, sz, type);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.premultiplyAlpha = false;
    shipTextures[type] = tex;
  }
}

function drawShip(ctx, sz, type) {
  const cx = sz / 2;
  const cy = sz / 2;
  ctx.clearRect(0, 0, sz, sz);

  // Ship type variations
  const configs = {
    liburna:      { hullW: 0.55, hullH: 0.18, prowLen: 0.12, mastH: 0.40, sailW: 0.35, sailH: 0.30, oars: 0, stripe: '#8B4513', hullCol: '#6B4226', deckCol: '#9E6B3E' },
    trireme:      { hullW: 0.65, hullH: 0.20, prowLen: 0.15, mastH: 0.30, sailW: 0.18, sailH: 0.15, oars: 5, stripe: '#C41E3A', hullCol: '#5C3317', deckCol: '#8B6B4A' },
    quadrireme:   { hullW: 0.72, hullH: 0.22, prowLen: 0.16, mastH: 0.30, sailW: 0.20, sailH: 0.15, oars: 7, stripe: '#1E5631', hullCol: '#4A2B10', deckCol: '#7A5B3A' },
    cataphract:   { hullW: 0.68, hullH: 0.22, prowLen: 0.14, mastH: 0.28, sailW: 0.16, sailH: 0.12, oars: 5, stripe: '#CC8844', hullCol: '#5C3317', deckCol: '#8B6B4A' },
    quinquereme:  { hullW: 0.80, hullH: 0.25, prowLen: 0.18, mastH: 0.55, sailW: 0.50, sailH: 0.40, oars: 0, stripe: '#DAA520', hullCol: '#3D1F00', deckCol: '#6B4226' },
  };
  const cfg = configs[type] || configs.liburna;

  const hullW = cfg.hullW * sz;
  const hullH = cfg.hullH * sz;
  const prowLen = cfg.prowLen * sz;
  const mastH = cfg.mastH * sz;
  const sailW = cfg.sailW * sz;
  const sailH = cfg.sailH * sz;

  // Ship travels downward on screen. Prow (pointed) faces DOWN (toward wall).
  // Stern (flat/raised) at top. Hull is a long HORIZONTAL wedge, wider than tall.
  const hullCenterY = cy + 4; // hull slightly below centre (mast/sail above)
  const hullLeft = cx - hullW / 2;
  const hullRight = cx + hullW / 2;
  const prowTipY = hullCenterY + hullH * 0.5 + prowLen; // pointed tip below
  const sternY = hullCenterY - hullH * 0.5; // flat stern above

  ctx.save();

  // Hull body: flat-bottomed wedge shape
  ctx.beginPath();
  ctx.moveTo(cx, prowTipY);                                    // prow tip (bottom centre)
  ctx.lineTo(hullRight - 2, hullCenterY + hullH * 0.3);       // right bow
  ctx.lineTo(hullRight, hullCenterY - hullH * 0.2);           // right waist
  ctx.lineTo(hullRight - 3, sternY);                           // right stern
  ctx.lineTo(hullLeft + 3, sternY);                            // left stern (flat top)
  ctx.lineTo(hullLeft, hullCenterY - hullH * 0.2);            // left waist
  ctx.lineTo(hullLeft + 2, hullCenterY + hullH * 0.3);        // left bow
  ctx.closePath();
  ctx.fillStyle = cfg.hullCol;
  ctx.fill();

  // Deck stripe (lighter horizontal band across the hull)
  ctx.fillStyle = cfg.deckCol;
  ctx.fillRect(hullLeft + 4, hullCenterY - 3, hullW - 8, 5);

  // Painted stripe along waterline
  ctx.strokeStyle = cfg.stripe;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hullLeft + 4, hullCenterY + hullH * 0.15);
  ctx.lineTo(cx, prowTipY - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hullRight - 4, hullCenterY + hullH * 0.15);
  ctx.lineTo(cx, prowTipY - 4);
  ctx.stroke();

  // Oar strokes: angle DOWNWARD from hull toward water (below hull line)
  if (cfg.oars > 0) {
    ctx.strokeStyle = 'rgba(80, 50, 25, 0.8)';
    ctx.lineWidth = 1.5;
    const oarRegionTop = hullCenterY - hullH * 0.15;
    const oarRegionBot = hullCenterY + hullH * 0.2;
    const oarSpacing = (oarRegionBot - oarRegionTop) / (cfg.oars + 1);
    for (let i = 1; i <= cfg.oars; i++) {
      const oy = oarRegionTop + i * oarSpacing;
      // Left oar: angled downward-left
      ctx.beginPath();
      ctx.moveTo(hullLeft + 1, oy);
      ctx.lineTo(hullLeft - 10, oy + 6);
      ctx.stroke();
      // Right oar: angled downward-right
      ctx.beginPath();
      ctx.moveTo(hullRight - 1, oy);
      ctx.lineTo(hullRight + 10, oy + 6);
      ctx.stroke();
    }
  }

  // Stern ornament (raised transom)
  ctx.fillStyle = '#3D2010';
  ctx.fillRect(cx - hullW * 0.15, sternY - 4, hullW * 0.3, 5);

  // Mast (vertical, above hull centre)
  ctx.fillStyle = '#3D2010';
  ctx.fillRect(cx - 1.5, hullCenterY - mastH - hullH * 0.3, 3, mastH);

  // Sail (trapezoid, clearly above hull)
  if (sailW > 0 && sailH > 0) {
    const sailTop = hullCenterY - mastH - hullH * 0.3 + 4;
    const sailBot = sailTop + sailH;
    ctx.fillStyle = 'rgba(230, 215, 190, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - sailW / 2, sailBot);
    ctx.lineTo(cx + sailW / 2, sailBot);
    ctx.lineTo(cx + sailW * 0.35, sailTop);
    ctx.lineTo(cx - sailW * 0.35, sailTop);
    ctx.closePath();
    ctx.fill();
    // Cross-bar
    ctx.strokeStyle = '#3D2010';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - sailW / 2, sailBot);
    ctx.lineTo(cx + sailW / 2, sailBot);
    ctx.stroke();
  }

  // Prow ram ornament
  ctx.fillStyle = '#1A0A00';
  ctx.beginPath();
  ctx.moveTo(cx, prowTipY + 2);
  ctx.lineTo(cx - 3, prowTipY - 5);
  ctx.lineTo(cx + 3, prowTipY - 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function initEnemies() {
  const scene = getScene();
  enemyGroup = new THREE.Group();
  scene.add(enemyGroup);

  // Generate ship sprite textures (procedural canvas, no image files)
  generateShipTextures();

  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    const mesh = new THREE.Group();
    mesh.position.z = 0.3;

    // Ship sprite (canvas-drawn, swapped per type)
    const spriteGeo = new THREE.PlaneGeometry(6, 6);
    const spriteMat = new THREE.MeshBasicMaterial({
      map: shipTextures.liburna, transparent: true, alphaTest: 0.05, depthWrite: false
    });
    const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
    spriteMesh.position.z = 0.01;
    mesh.add(spriteMesh);

    // Emissive ember glow behind the hull — an additive orange halo that ramps
    // up as the ship approaches ignition (charring). Uses the shared soft glow
    // texture so it reads as a hot edge glow, not a flat rectangle.
    const emberGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({
        map: getGlowTex(), color: 0xff6600, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    emberGlow.position.z = -0.02; // just behind the sprite
    mesh.add(emberGlow);

    mesh.visible = false;

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

    // Shield plate: a row of sturdy, slightly-curved mantlet shields
    // (Scutum/Aspis style) mounted flush along the deck — NOT stacked domes.
    // Arc depth is shallow (~70% flatter than a full dome) and the bands sit
    // tightly together so they read as a clean armoured wall, with bronze rims.
    const shieldCanvas = document.createElement('canvas');
    shieldCanvas.width = 64; shieldCanvas.height = 32;
    const shCtx = shieldCanvas.getContext('2d');
    const bandColors = ['#AA7733', '#CC9944', '#DDBB55'];
    const ARC = 2;          // shallow arc depth (was 7 → ~70% flatter)
    const SPACING = 4.5;    // tight vertical spacing (was 9 → plates hug the hull)
    const BASE_Y = 20;      // sit low, flush against the deck profile
    const RX = 29;          // plate half-width (spans the hull cleanly)
    for (let b = 0; b < 3; b++) {
      const cy = BASE_Y - b * SPACING; // stack upward but close, not flaring
      // Plate body: a shallow rounded-rect-ish band via a squat top arc + flat base
      shCtx.fillStyle = bandColors[b];
      shCtx.beginPath();
      shCtx.ellipse(32, cy, RX, ARC, 0, Math.PI, 0); // shallow top curve
      shCtx.lineTo(32 + RX, cy + SPACING * 0.9);      // down the right edge
      shCtx.lineTo(32 - RX, cy + SPACING * 0.9);      // flat base back to left
      shCtx.closePath();
      shCtx.fill();
      // Bronze rim highlight along the plate's top edge (instant "armoured" read).
      shCtx.strokeStyle = '#EEDD88';
      shCtx.lineWidth = 1.0;
      shCtx.beginPath();
      shCtx.ellipse(32, cy, RX, ARC, 0, Math.PI, 0);
      shCtx.stroke();
    }
    const shTex = new THREE.CanvasTexture(shieldCanvas);
    shTex.minFilter = THREE.LinearFilter;
    shTex.premultiplyAlpha = false;
    const shieldPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 2.0),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, alphaTest: 0.05, depthWrite: false })
    );
    shieldPlate.position.y = 1.8; // mounted lower, flush along the deck
    shieldPlate.position.z = 0.08;
    shieldPlate.visible = false;
    mesh.add(shieldPlate);

    // Oars (3 per side, animated at runtime for oared ships)
    const oarMeshes = [];
    const OAR_COUNT = 3;
    const oarMat = new THREE.MeshBasicMaterial({ color: 0x5C3D2E });
    for (let side = -1; side <= 1; side += 2) {
      for (let oi = 0; oi < OAR_COUNT; oi++) {
        const oarGeo = new THREE.PlaneGeometry(0.2, 1.6);
        const oar = new THREE.Mesh(oarGeo, oarMat);
        // Position: along hull sides, angled downward toward water
        oar.position.x = side * 2.0;
        oar.position.y = oi * 0.7 - (OAR_COUNT * 0.7) / 2 + 0.5;
        oar.position.z = -0.02; // BEHIND the hull sprite
        oar.rotation.z = side * 0.6; // angled downward-outward (~35 degrees)
        oar.visible = false;
        mesh.add(oar);
        oarMeshes.push({ mesh: oar, side, index: oi });
      }
    }

    enemyGroup.add(mesh);
    pool.push({
      active: false, type: 'liburna',
      hp: 0, maxHp: 0, armour: 0, heat: 0,
      lane: 0, y: SHIP_SPAWN_Y,
      speed: 0, baseSpeed: 0,
      burn: 0, slowed: false,
      bandsHitting: 0, lastHitColour: 0,
      mesh, barFill, shieldPlate, oarMeshes, spriteMat, hullMat: spriteMat, emberGlow
    });
  }
}

export function getEnemyPool() { return pool; }

export function spawnEnemy(type, lane, hpMultiplier, yOffset) {
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
      e.shieldAngle = template.shieldAngle || 0;
      e.shieldBlocking = false;
      e.stunTimer = 0;
      e.propulsion = template.propulsion || 'oared';
      e.oarPhase = Math.random() * Math.PI * 2; // random start phase
      e.driftX = 0;
      e.pullX = 0; // Poseidon whirlpool pull (separate from animation drift)
      e.zeusCharring = 0; // charring stage before death (0 = not charring)
      e.zeusPendingHeat = 0;
      e.breached = false; // wall-breach guard: damage fires exactly once
      e.sinkTimer = 0;    // crash-and-sink window (set on breach)
      // Restore pooled-sprite state cleared by a prior sink/char.
      if (e.spriteMat) { e.spriteMat.opacity = 1; e.spriteMat.color.setRGB(1, 1, 1); }
      if (e.emberGlow) e.emberGlow.material.opacity = 0;
      e.mesh.rotation.z = 0;
      e.lane = lane;
      // Spawn Y, clamped so the ship's TOP edge never crosses the crystal bound.
      const half = shipHalfHeight(type);
      e.y = Math.min(SHIP_SPAWN_Y + (yOffset || 0), SHIP_TOP_BOUND - half);
      e.speed = template.speed;
      e.baseSpeed = template.speed;
      e.burn = 0;
      e.heat = 0;
      e.heatGrace = 0;
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
  lastBreaches.length = 0;
  const ww = getWorldWidth();
  const lw = ww / ENEMY_LANE_COUNT;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    e.slowed = false;
    // Zeus stun: skip movement while stunned
    let moving = false;
    if (e.stunTimer && e.stunTimer > 0) {
      e.stunTimer -= dt;
    } else {
      e.y -= e.speed * dt; // descend
      moving = e.speed > 0.1;
    }

    // Trailing wake: faint foam puffs behind a moving hull (above it, since
    // ships travel downward). Throttled per ship so the pool isn't flooded.
    if (moving) {
      e.wakeTimer = (e.wakeTimer || 0) - dt;
      if (e.wakeTimer <= 0) {
        e.wakeTimer = 0.22 + Math.random() * 0.12;
        const wx = -ww / 2 + lw * (e.lane + 0.5) + (e.driftX || 0) + (e.pullX || 0);
        const wy = e.y + shipHalfHeight(e.type) * 0.7; // behind (above) the hull
        spawnWake(wx, wy, 0x9fb8c4); // pale foam-blue, small quick puff
      }
    }

    // Zeus charring: deferred kill stage (electric arcs then heat)
    if (e.zeusCharring > 0) {
      e.zeusCharring -= dt;
      // Visual: electric white-blue flicker during charring
      const flicker = Math.random() > 0.5 ? 2.5 : 1.2;
      e.spriteMat.color.setRGB(flicker, flicker, flicker * 1.2); // slight blue tint
      // Electric arc sparks around the hull
      const ww2 = getWorldWidth();
      const lw2 = ww2 / ENEMY_LANE_COUNT;
      const ex2 = -ww2 / 2 + lw2 * (e.lane + 0.5) + (e.driftX || 0) + (e.pullX || 0);
      if (Math.random() < 0.6) {
        spawnSparks(ex2, e.y, 0x88ccff, 2); // blue-white electric sparks
      }
      if (e.zeusCharring <= 0 && e.zeusPendingHeat) {
        // Apply the deferred heat now — bright electric burst on death
        spawnContactGlow(ex2, e.y, 0xaaddff, 80);
        e.heat += e.zeusPendingHeat;
        e.zeusPendingHeat = 0;
        e.spriteMat.color.setRGB(1, 1, 1); // reset tint
      }
    }

    // Propulsion animation
    if (e.propulsion === 'oared') {
      // Oar cycle: slow synchronized stroke (period ~2s)
      e.oarPhase += dt * 3.2; // ~2s full cycle
      // Hull rock: once per two strokes, ±1.5 degrees (slower, less twitchy)
      e.mesh.rotation.z = Math.sin(e.oarPhase * 0.5) * 0.026;
      e.driftX = 0;
    } else {
      // Sailed: gentle lateral drift (slow sinusoid)
      e.oarPhase += dt * 1.2;
      e.driftX = Math.sin(e.oarPhase) * 0.8; // gentle sway
      e.mesh.rotation.z = Math.sin(e.oarPhase * 0.7) * 0.015; // very slight roll
    }

    // Ships descend to the stone battlement and only breach when their hull's
    // LEADING (bottom) edge touches the battlement top. Damage is therefore
    // always at the wall/shoreline — never in open water mid-screen. The
    // `breached` guard makes the first-contact burst fire exactly once.
    //
    // STRICT STOP-LINE: hard-clamp the hull so its leading edge can never sink
    // past the battlement top within a single frame step. Without this, a fast
    // ship (or a large dt hitch) could overshoot the line for a frame and
    // visually dip its hull down onto the Bronze/Silver/Gold discs sitting at
    // the wall before the breach removes it. Clamping to `BATTLEMENT_TOP_Y +
    // half` guarantees zero ship-on-disc overlap: the hull rests exactly on the
    // line, then breaches. (BATTLEMENT_TOP_Y === RAM_LINE_Y === RAM_STOP_EDGE.)
    const half = shipHalfHeight(e.type);
    if (e.y - half < BATTLEMENT_TOP_Y) {
      e.y = BATTLEMENT_TOP_Y + half;
    }
    const leadingEdge = e.y - half;
    const atWall = leadingEdge <= BATTLEMENT_TOP_Y;

    // Clamp the contact X to the visible battlement so edge/flank ships (and
    // Poseidon-pulled ones) always render on-screen with a matching flash.
    const rawX = -ww / 2 + lw * (e.lane + 0.5) + (e.driftX || 0) + (e.pullX || 0);
    const edgeX = ww / 2 - 2;
    const cx = Math.max(-edgeX, Math.min(edgeX, rawX));

    if (atWall) {
      // INSTANT breach: deal the full wall damage ONCE, fire an explosion +
      // smoke burst, then remove the ship the SAME frame — it never lingers,
      // sinks, or stacks at the bottom of the screen.
      const dripPct = BREACH_DRIP_PCT[e.type] != null ? BREACH_DRIP_PCT[e.type] : 0.05;
      const heatFrac = Math.min(1, (e.heat || 0) / e.maxHp);
      // One-shot damage: the full breach amount (was bled over the sink window),
      // reduced if the ship was already burning.
      wallDamage += WALL_MAX_HP * dripPct * BREACH_SINK_TIME * Math.max(0.2, 1 - heatFrac);
      const heavy = (e.type === 'quinquereme' || e.type === 'quadrireme');
      spawnDestruction(cx, BATTLEMENT_TOP_Y + half, heavy); // explosion + embers
      spawnSmoke(cx, BATTLEMENT_TOP_Y + 1, 2);              // parting smoke burst
      lastBreaches.push({ x: cx, lane: e.lane });           // battlement stone flash
      deactivateEnemy(e);  // remove from logic array + fully hide/reset the mesh
      continue;
    }
    positionEnemy(e);
    updateEnemyVisual(e);
  }
  return wallDamage;
}

export function applyGoldSlow(enemy) { enemy.slowed = true; }

// Wind state: affects sailed ships more than oared
let windActive = false;
const WIND_SAIL_SLOW = 0.35;  // sailed ships slowed to 35% speed
const WIND_OAR_SLOW = 0.85;  // oared ships barely affected (85%)

export function setWindActive(active) { windActive = active; }
export function isWindActive() { return windActive; }

export function applySlowStates() {
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    let speedMult = 1.0;
    if (e.slowed) speedMult *= 0.5; // gold beam slow
    if (windActive) {
      speedMult *= (e.propulsion === 'sailed') ? WIND_SAIL_SLOW : WIND_OAR_SLOW;
    }
    e.speed = e.baseSpeed * speedMult;
  }
}

export function deactivateEnemy(enemy) {
  enemy.active = false;
  enemy.mesh.visible = false;
  // Clear per-mesh visual state so a lingering/hidden hull can never show
  // (charred colour, ember glow, faded sprite) if anything toggles visibility.
  if (enemy.emberGlow) enemy.emberGlow.material.opacity = 0;
  if (enemy.spriteMat) { enemy.spriteMat.opacity = 1; enemy.spriteMat.color.setRGB(1, 1, 1); }
  enemy.heat = 0;
  enemy.burn = 0;
  enemy.breached = false;
  enemy.sinkTimer = 0;
}

export function triggerKillEffect(enemy, reward) {
  addKillReward(reward);
  if (enemy.hullMat) enemy.hullMat.color.setHex(0xffffff);
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
  e.mesh.position.x = x + (e.driftX || 0) + (e.pullX || 0);
  e.mesh.position.y = e.y;
}

function updateEnemyVisual(e) {
  e.burn = Math.max(0, (e.heat || 0) / e.maxHp);
  e.barFill.scale.x = e.burn;
  e.barFill.position.x = -2.5 * (1 - e.burn);

  // Swap sprite texture to match type
  const tex = shipTextures[e.type] || shipTextures.liburna;
  if (e.spriteMat.map !== tex) {
    e.spriteMat.map = tex;
    e.spriteMat.needsUpdate = true;
  }

  // --- Charring: hull darkens toward charcoal as heat fills. The sprite colour
  // multiplies from white (1) down toward near-black charcoal (0.12) by burn.
  // A brief coloured lick from the last beam hit rides on top for feedback.
  const char = 1 - e.burn * 0.88;           // 1 → 0.12
  let cr = char, cg = char, cb = char;
  if (e.bandsHitting > 0 && e.lastHitColour !== 0) {
    const r = ((e.lastHitColour >> 16) & 0xff) / 255;
    const g = ((e.lastHitColour >> 8) & 0xff) / 255;
    const b = (e.lastHitColour & 0xff) / 255;
    const t = 0.25; // subtle beam-colour lick over the charred hull
    cr = char * (1 - t) + r * t;
    cg = char * (1 - t) + g * t;
    cb = char * (1 - t) + b * t;
  } else if (e.slowed) {
    cr = char * 0.7; cg = char * 0.9; cb = char * 0.5; // frosty gold-slow tint
  }
  e.spriteMat.color.setRGB(cr, cg, cb);

  // --- Emissive orange edge glow that ramps up just before ignition. Starts
  // appearing past ~55% heat and pulses hotter (toward white-orange) near 100%.
  if (e.emberGlow) {
    if (e.burn > 0.55) {
      const ign = (e.burn - 0.55) / 0.45;              // 0..1 over the last 45%
      const flick = 0.8 + 0.2 * Math.sin(performance.now() * 0.02 + e.oarPhase);
      e.emberGlow.material.opacity = Math.min(0.9, ign * 0.9) * flick;
      // Shift hue from ember-orange toward hot white-orange as it peaks.
      const g = 0.4 + ign * 0.5; // green channel rises → whiter/hotter
      e.emberGlow.material.color.setRGB(1, g, 0.1 + ign * 0.2);
      const gs = 1 + ign * 0.25;
      e.emberGlow.scale.set(gs, gs, 1);
    } else {
      e.emberGlow.material.opacity = 0;
    }
  }

  const s = SHIP_SIZE[e.type] || 3;
  e.mesh.scale.set(s/3, s/3, 1);
  // Shield plate visibility + glint
  if (e.shieldPlate) {
    const isShield = (e.type === 'cataphract');
    e.shieldPlate.visible = isShield;
    if (isShield) {
      // Subtle glint: opacity pulse
      const glint = 0.85 + 0.15 * Math.sin(performance.now() * 0.004 + e.oarPhase);
      e.shieldPlate.material.opacity = glint;
    }
  }

  // Oar animation (oared ships only)
  if (e.oarMeshes) {
    const isOared = e.propulsion === 'oared';
    for (const oarObj of e.oarMeshes) {
      oarObj.mesh.visible = isOared;
      if (isOared) {
        // Rowing stroke: sweep in a shallow arc below the hull
        // Base angle is downward-outward (0.6 rad), stroke adds ±0.3 rad
        const stroke = Math.sin(e.oarPhase + oarObj.index * 0.4);
        oarObj.mesh.rotation.z = oarObj.side * (0.6 + stroke * 0.25);
      }
    }
  }
}
