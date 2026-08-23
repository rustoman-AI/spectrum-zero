




// === src/config.js ===
// ============================================================
// src/config.js — All balance numbers and world dimensions
// Solar Siege: Reversed layout (sun top, ships descend, mirrors bottom)
// ============================================================

// --- World ---
const WORLD_HEIGHT = 100;

// --- Layout (sun at top, wall at bottom) ---
// Ships spawn at top, descend toward wall at bottom.
// Beam comes from sun (top), hits prism, splits, goes down to mirrors at bottom.
// Mirrors reflect beams UPWARD into descending ships.
const SUN_Y = 48;              // sun/beam source (top)
const SHIP_SPAWN_Y = 40;       // ships appear near top
const PRISM_Y = 30;            // prism splits light here
const MIRROR_FIELD_TOP = -15;  // top of mirror zone (player area, bottom of screen)
const MIRROR_FIELD_BOT = -35;  // bottom of mirror zone
const WALL_Y = -40;            // wall/breach line (ships breach here)
const ENEMY_LANE_COUNT = 5;

// --- DEV flags ---
const DEV = {
  INVINCIBLE: false,
};

// --- Beam ---
const MAX_BOUNCES = 8;
const MAX_SEGMENTS = 24;
const BEAM_WIDTH = 1.2;
const BEAM_GLOW_WIDTH = 2.4;
const PRISM_SPREAD_DEG = 30;   // wider spread for reversed layout
const PRISM_SPLIT_ANGLE = (PRISM_SPREAD_DEG / 2) * (Math.PI / 180);

// --- Prism tiers ---
// More bands = weaker each. Synergy scaled so focused DPS = 48 at all tiers.
const PRISM_TIERS = {
  3: { bands: 3, dBase: 10.0, synergy: 0.30, shape: 'triangle', cost: null },
  4: { bands: 4, dBase: 7.5,  synergy: 0.20, shape: 'diamond',  cost: { bronze: 300 } },
  5: { bands: 5, dBase: 6.0,  synergy: 0.15, shape: 'pentagon', cost: { silver: 200 } },
  6: { bands: 6, dBase: 5.0,  synergy: 0.12, shape: 'hexagon',  cost: { silver: 400 } },
};
const DEFAULT_PRISM_TIER = 3;
const D_BASE = 10;
const SYNERGY_BONUS = 0.3;

// --- Enemy types ---
const ENEMY_TYPES = {
  skiff:       { hp: 30,   armour: 0, speed: 5,   reward: { brass: 10 } },
  trireme:     { hp: 100,  armour: 0, speed: 3.5, reward: { brass: 20, bronze: 5 } },
  quadrireme:  { hp: 200,  armour: 2, speed: 2.5, reward: { bronze: 15, silver: 3 } },
  flagship:    { hp: 1500, armour: 4, speed: 1.0, reward: { gold: 20 } },
};

// --- Escalation ---
const ESCALATION_HP_FACTOR = 3;
const SESSION_DURATION = 600;  // 10 minutes

// --- Multi-currency economy (passive altars) ---
const ALTAR_RATES = {
  brass:  5,  // per second
  bronze: 3,
  silver: 2,
  gold:   1,
};

// --- Shop prices ---
const SHOP = {
  mirror:    { brass: 100, scaling: 50 },  // +50 per additional mirror
  prism3:    { bronze: 150 },
  prism4:    { bronze: 300 },
  prism5:    { silver: 200 },
  prism6:    { silver: 400 },
  priest:    { silver: 100 },  // generates 1 Faith/sec
};

// --- God altars (require Faith + Gold) ---
const GOD_ABILITIES = {
  zeus:     { faith: 100, gold: 10, name: 'Thunderstorm', duration: 5 },
  poseidon: { faith: 100, gold: 15, name: 'Maelstrom', duration: 8 },
  helios:   { faith: 100, gold: 20, name: 'Scorching Sun', duration: 10 },
};

// --- Phase timings (seconds) ---
const PHASE_1_END = 60;    // 1:00 - skiffs only
const PHASE_2_END = 180;   // 3:00 - armoured galleys
const PHASE_3_END = 540;   // 9:00 - main battle
// Phase 4: 9:00-10:00 - flagship

// --- Heat decay ---
const HEAT_DECAY_RATE = 0.15;

// --- Wall ---
const WALL_MAX_HP = 100;
const BREACH_DAMAGE = { skiff: 5, trireme: 15, quadrireme: 25, flagship: 100 };

// --- Mirror ---
const MIRROR_MAX_HITS = 3;
const MIRROR_COUNT_START = 3;
const MIRROR_LENGTH = 8;
const ROTATION_SENSITIVITY = 1.0;
const FREE_PLACEMENT = true;

// --- Pool sizes ---
const ENEMY_POOL_SIZE = 64;
const BEAM_SEGMENT_POOL_SIZE = 28;

// --- Resonance ---
const RESONANCE_MIN_BOUNCES = 3;
const RESONANCE_MULTIPLIER = 1.5;

// --- Colours ---
const COLOUR_WHITE  = 0xffffff;
const COLOUR_AMBER  = 0xff8c1a;
const COLOUR_CYAN   = 0x00ddff;
const COLOUR_GOLD   = 0xffe9a0;
const COLOUR_GREY   = 0x333333;

// --- Sockets (mirror field at bottom) ---
const SOCKET_POSITIONS = [
  [-15, -18], [0, -18], [15, -18],
  [-15, -25], [0, -25], [15, -25],
  [-15, -32], [0, -32], [15, -32],
];
const DEFAULT_PRISM_SOCKET = 1; // (0, -18) — but prism placed at PRISM_Y separately
const DEFAULT_MIRROR_SOCKETS = [3, 4, 5]; // 3 starting mirrors

// --- Foundry positions (not used in new economy, kept for compatibility) ---
const FOUNDRY_POSITIONS = [];
const FOUNDRY_HW = 5;
const FOUNDRY_HH = 3;
const FOUNDRY_Y = 10; // above mirrors, not used


// === src/strings.js ===
// ============================================================
// src/strings.js — All player-facing text (single source of truth)
//
// Game: Solar Siege (Archimedes defending Syracuse)
// ============================================================

// --- Game title ---
const TITLE = 'Solar Siege';

// --- Source / beam ---
const SOURCE_NAME = 'Helios';
const BEAM_WHITE_NAME = 'Sunlight';
const PRISM_NAME = 'Archimedes Lens';

// --- Foundries (Altars) ---
const FOUNDRY_LABELS = {
  forge: 'HEPHAESTUS',
  lensworks: 'ATHENA',
  chorus: 'APOLLO',
};

// --- Resources ---
const RES_SLAG = 'Bronze';
const RES_SLAG_SHORT = 'B';
const RES_INSIGHT = 'Tactics';
const RES_INSIGHT_SHORT = 'T';
const RES_RECOMBO = 'Convergence';
const RES_RECOMBO_SHORT = 'C';

// --- Enemies (Roman fleet) ---
const ENEMY_NAMES = {
  mote: 'Skiff',
  husk: 'Trireme',
  carapace: 'Quadrireme',
  devourer: 'Flagship',
};

// --- Crafting ---
const CRAFT_LABELS = {
  prism: 'Lens',
  repair: 'Greek Fire',
  reinforced: 'Br.Shield',
  ignition: 'Oil Slick',
  focus: 'Focus',
  anchor: 'Ballast',
};

// --- UI messages ---
const MSG_LOSE = 'SYRACUSE HAS FALLEN\n\nTap to retry';
const MSG_WIN = 'THE FLEET BURNS\n\nTap to play again';
const MSG_BREACH_LINE = 'The Sea Wall';

// --- HUD ---
const HUD_COST_SLAG = 'B';
const HUD_COST_INSIGHT = 'T';


// === src/renderer.js ===
// ============================================================
// src/renderer.js — Three.js scene, orthographic camera, resize
// Fixed 9:16 portrait render target with letterboxing.
// Two-pass rendering: main scene + overlay scene (always on top).
// ============================================================



const TARGET_ASPECT = 9 / 16;

let scene, camera, renderer, worldWidth;
// Overlay scene renders on top of main scene (second pass, no depth issues)
let overlayScene, overlayCamera;

function initRenderer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080808);

  worldWidth = WORLD_HEIGHT * TARGET_ASPECT;
  const hw = worldWidth / 2;
  const hh = WORLD_HEIGHT / 2;

  camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
  camera.position.z = 50;

  // Overlay scene (no background, renders on top)
  overlayScene = new THREE.Scene();
  overlayCamera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
  overlayCamera.position.z = 50;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false; // we manage clearing manually for two-pass
  document.body.appendChild(renderer.domElement);

  applyLetterbox();
  window.addEventListener('resize', applyLetterbox);
}

function applyLetterbox() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const winAspect = winW / winH;

  let canvasW, canvasH;
  if (winAspect > TARGET_ASPECT) {
    canvasH = winH;
    canvasW = Math.floor(winH * TARGET_ASPECT);
  } else {
    canvasW = winW;
    canvasH = Math.floor(winW / TARGET_ASPECT);
  }

  renderer.setSize(canvasW, canvasH);

  const el = renderer.domElement;
  el.style.position = 'absolute';
  el.style.left = Math.floor((winW - canvasW) / 2) + 'px';
  el.style.top = Math.floor((winH - canvasH) / 2) + 'px';
}

function getScene() { return scene; }
function getOverlayScene() { return overlayScene; }
function getCamera() { return camera; }
function getRenderer() { return renderer; }
function getWorldWidth() { return worldWidth; }

function render() {
  renderer.clear();
  renderer.render(scene, camera);
  // Second pass: overlay scene renders on top without clearing
  renderer.clearDepth();
  renderer.render(overlayScene, overlayCamera);
}

function screenToWorld(sx, sy) {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((sx - rect.left) / rect.width) * 2 - 1;
  const ny = -((sy - rect.top) / rect.height) * 2 + 1;
  const hw = worldWidth / 2;
  const hh = WORLD_HEIGHT / 2;
  return { x: nx * hw, y: ny * hh };
}


// === src/background.js ===
// ============================================================
// src/background.js — Environment bands (sea, shore, battlement)
//
// Pure rendering, no gameplay effect. All Y boundaries derived
// from config.js layout constants. Meshes at z=-10, behind everything.
//
// Respects prefers-reduced-motion: freezes wave scroll.
// ============================================================




// Colours (all below 22% relative luminance)
const COL_DEEP_SEA = 0x12303F;
const COL_SHALLOW_SEA = 0x1A4257;
const COL_SURF = 0x3E7A93;
const COL_SHORE = 0x2E2419;
const COL_BATTLEMENT = 0x3A2E20;
const COL_WALL_EDGE = 0x1F1811;

let seaMesh = null;
let seaTexture = null;
let surfMesh = null;
let reduceMotion = false;

function initBackground() {
  const scene = getScene();
  const ww = getWorldWidth();
  const hh = WORLD_HEIGHT / 2;

  // Check prefers-reduced-motion
  if (typeof window.matchMedia === 'function') {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // --- Band boundaries (reversed: sea at top, city at bottom) ---
  const seaTop = hh;                    // top of world
  const seaBot = SHIP_SPAWN_Y - 5;     // sea extends to just above spawn area
  const skyBot = seaBot;
  const cityTop = MIRROR_FIELD_TOP + 5; // city above mirror field
  const cityBot = -hh;                  // bottom of world

  // --- 1. Sea band (top of screen where ships come from) ---
  const seaH = seaTop - seaBot;
  const cityGeo = new THREE.PlaneGeometry(ww + 2, seaH);
  const cityMat = new THREE.MeshBasicMaterial({ color: COL_DEEP_SEA, depthWrite: false });
  const cityMeshObj = new THREE.Mesh(cityGeo, cityMat);
  cityMeshObj.position.set(0, seaBot + seaH / 2, -10);
  scene.add(cityMeshObj);

  // --- 2. City/wall band (bottom, where player defends) ---
  const cityH = cityTop - cityBot;
  const battleGeo = new THREE.PlaneGeometry(ww + 2, cityH);
  const battleMat = new THREE.MeshBasicMaterial({ color: COL_BATTLEMENT, depthWrite: false });
  const battleMeshObj = new THREE.Mesh(battleGeo, battleMat);
  battleMeshObj.position.set(0, cityBot + cityH / 2, -10);
  scene.add(battleMeshObj);

  // Wall line
  const edgeGeo = new THREE.PlaneGeometry(ww + 2, 0.6);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5, depthWrite: false });
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
  edgeMesh.position.set(0, WALL_Y, -9.8);
  scene.add(edgeMesh);

  // --- 3. Sea texture with waves (covers the sea band) ---
  const seaCanvas = document.createElement('canvas');
  seaCanvas.width = 32;
  seaCanvas.height = 256;
  const ctx = seaCanvas.getContext('2d');
  drawSeaTexture(ctx, 32, 256);

  seaTexture = new THREE.CanvasTexture(seaCanvas);
  seaTexture.wrapS = THREE.RepeatWrapping;
  seaTexture.wrapT = THREE.RepeatWrapping;
  seaTexture.minFilter = THREE.LinearFilter;

  // Overlay on sea band
  const seaOverGeo = new THREE.PlaneGeometry(ww + 2, seaH);
  const seaOverMat = new THREE.MeshBasicMaterial({ map: seaTexture, transparent: true, opacity: 0.5, depthWrite: false });
  seaMesh = new THREE.Mesh(seaOverGeo, seaOverMat);
  seaMesh.position.set(0, seaBot + seaH / 2, -9.5);
  scene.add(seaMesh);

  // Surf/wave line not needed at top — the sea band IS the top
}

function updateBackground(dt) {
  // Scroll sea texture for wave motion
  if (seaTexture && !reduceMotion) {
    seaTexture.offset.y += dt * 0.02;
  }
}

function drawSeaTexture(ctx, w, h) {
  // Vertical gradient: shallow (top) to deep (bottom)
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#1A4257');   // shallow near shore
  gradient.addColorStop(1, '#12303F');   // deep at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Wave lines (3-4 horizontal lines at intervals)
  ctx.strokeStyle = 'rgba(30, 60, 80, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = 40 + i * 55;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x++) {
      ctx.lineTo(x, y + Math.sin(x * 0.5 + i * 2) * 2);
    }
    ctx.stroke();
  }
}


// === src/beam.js ===
// ============================================================
// src/beam.js — Iterative raycast beam solver with resonance detection
// ============================================================

// Segment: { start, end, colour, intensity, bounces }
let segments = [];
let dirty = true;
// Diagnostics — read by debug overlay
let maxBouncesUsed = 0;
let hitBounceCap = false;
function markDirty() { dirty = true; }
function isDirty() { return dirty; }
function getSegments() { return segments; }
function getBeamDiag() { return { maxBouncesUsed, hitBounceCap }; }
// Resonance: detected when 3+ bounces occur between the same mirror pair
let resonanceActive = false;
let resonanceMirrors = null; // [mirrorA, mirrorB] if resonance detected
function getResonanceActive() { return resonanceActive; }
function getResonanceMirrors() { return resonanceMirrors; }
// Called by main loop when dirty
function solve(sourceX, sourceY, mirrors, prisms, worldWidth, foundryColliders) {
  segments = [];
  maxBouncesUsed = 0;
  hitBounceCap = false;
  resonanceActive = false;
  resonanceMirrors = null;
  mirrorHitSequence = [];
  const dir = { x: 0, y: -1 };
  traceBeam(
    { x: sourceX, y: sourceY },
    dir,
    COLOUR_WHITE,
    1.0,
    mirrors,
    prisms,
    [], // foundries are pass-through, not colliders
    worldWidth,
    MAX_BOUNCES,
    null,
    0
  );
  dirty = false;
  // Post-solve: detect resonance (3+ bounces between same mirror pair)
  detectResonance();
}
let mirrorHitSequence = [];
function detectResonance() {
  if (mirrorHitSequence.length < RESONANCE_MIN_BOUNCES) return;
  for (let i = 0; i <= mirrorHitSequence.length - RESONANCE_MIN_BOUNCES; i++) {
    const a = mirrorHitSequence[i], b = mirrorHitSequence[i + 1];
    if (!a || !b || a === b) continue;
    let count = 2;
    for (let j = i + 2; j < mirrorHitSequence.length; j++) {
      if (mirrorHitSequence[j] === ((j - i) % 2 === 0 ? a : b)) count++; else break;
    }
    if (count >= RESONANCE_MIN_BOUNCES) { resonanceActive = true; resonanceMirrors = [a, b]; return; }
  }
}
function traceBeam(origin, direction, colour, intensity, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft, excludePrism, bouncesUsed) {
  if (segments.length >= MAX_SEGMENTS) return;
  if (bouncesLeft < 0) {
    hitBounceCap = true;
    return;
  }
  const hit = castRay(origin, direction, mirrors, prisms, foundryColliders, worldWidth, excludePrism);
  segments.push({
    start: { x: origin.x, y: origin.y },
    end: { x: hit.point.x, y: hit.point.y },
    colour,
    intensity,
    bounces: bouncesUsed
  });
  if (hit.type === 'mirror' && bouncesLeft > 0) {
    // Record for resonance detection
    mirrorHitSequence.push(hit.object);
    // -------------------------------------------------------
    // Reflection math (double-sided):
    // Given incident direction d and surface normal n,
    // reflected direction r = d - 2*(d·n)*n
    //
    // If d·n > 0, beam is hitting from behind — flip n so
    // reflection works correctly from either side.
    // -------------------------------------------------------
    let n = { x: hit.normal.x, y: hit.normal.y };
    const dot = direction.x * n.x + direction.y * n.y;
    // Flip normal if beam approaches from behind
    if (dot > 0) {
      n.x = -n.x;
      n.y = -n.y;
    }
    const dotFixed = direction.x * n.x + direction.y * n.y;
    const reflected = {
      x: direction.x - 2 * dotFixed * n.x,
      y: direction.y - 2 * dotFixed * n.y
    };
    // Normalise to avoid drift
    const len = Math.sqrt(reflected.x * reflected.x + reflected.y * reflected.y);
    reflected.x /= len;
    reflected.y /= len;
    const newBounces = bouncesUsed + 1;
    if (newBounces > maxBouncesUsed) maxBouncesUsed = newBounces;
    traceBeam(hit.point, reflected, colour, intensity, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft - 1, null, newBounces);
  } else if (hit.type === 'prism') {
    if (colour === COLOUR_WHITE) {
      // Generate N bands based on active prism tier
      const tier = (typeof getActiveTier === 'function') ? getActiveTier() : 3;
      const bands = generateBandAngles(tier);
      for (const band of bands) {
        if (segments.length >= MAX_SEGMENTS) break;
        const newDir = rotateVec(direction, band.angleOffset);
        traceBeam(hit.point, newDir, band.colour, intensity, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft - 1, hit.object, bouncesUsed);
      }
    } else {
      // Second prism on a coloured band: split into two weaker sub-rays
      const subRays = [
        { angleOffset: -PRISM_SPLIT_ANGLE * 0.5 },
        { angleOffset: PRISM_SPLIT_ANGLE * 0.5 },
      ];
      for (const sub of subRays) {
        if (segments.length >= MAX_SEGMENTS) break;
        const newDir = rotateVec(direction, sub.angleOffset);
        traceBeam(hit.point, newDir, colour, intensity * 0.5, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft - 1, hit.object, bouncesUsed);
      }
    }
  }
  // else: beam terminates (edge, foundry, enemy)
}
// Cast a ray and find the nearest intersection
function castRay(origin, direction, mirrors, prisms, foundryColliders, worldWidth, excludePrism) {
  let nearest = null;
  let nearestDist = Infinity;
  // Test mirrors
  for (const mirror of mirrors) {
    if (mirror.shattered) continue;
    const result = raySegmentIntersect(origin, direction, mirror.p1, mirror.p2);
    if (result && result.dist > 0.1 && result.dist < nearestDist) {
      nearestDist = result.dist;
      nearest = { type: 'mirror', point: result.point, normal: mirror.normal, object: mirror };
    }
  }
  // Test prisms
  for (const prism of prisms) {
    if (prism === excludePrism) continue;
    const result = rayCircleIntersect(origin, direction, prism.position, prism.radius);
    if (result && result.dist > 0.1 && result.dist < nearestDist) {
      nearestDist = result.dist;
      nearest = { type: 'prism', point: result.point, normal: null, object: prism };
    }
  }
  // Test foundries (absorbing — beam terminates here)
  for (const fnd of foundryColliders) {
    const result = rayAABBIntersect(origin, direction, fnd.x, fnd.y, FOUNDRY_HW, FOUNDRY_HH);
    if (result && result.dist > 0.1 && result.dist < nearestDist) {
      nearestDist = result.dist;
      nearest = { type: 'foundry', point: result.point, normal: null, object: fnd };
    }
  }
  // Test world bounds
  const edgeHit = rayBoundsIntersect(origin, direction, worldWidth);
  if (edgeHit && edgeHit.dist > 0.1 && edgeHit.dist < nearestDist) {
    nearestDist = edgeHit.dist;
    nearest = { type: 'edge', point: edgeHit.point, normal: null, object: null };
  }
  if (!nearest) {
    nearest = {
      type: 'edge',
      point: { x: origin.x + direction.x * 200, y: origin.y + direction.y * 200 },
      normal: null,
      object: null
    };
  }
  return nearest;
}
// Ray vs AABB intersection (for foundries)
// Returns first intersection point with the box boundary
function rayAABBIntersect(origin, dir, cx, cy, hw, hh) {
  const xmin = cx - hw, xmax = cx + hw;
  const ymin = cy - hh, ymax = cy + hh;
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dir.x) < 1e-8) {
    if (origin.x < xmin || origin.x > xmax) return null;
  } else {
    let t1 = (xmin - origin.x) / dir.x;
    let t2 = (xmax - origin.x) / dir.x;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dir.y) < 1e-8) {
    if (origin.y < ymin || origin.y > ymax) return null;
  } else {
    let t1 = (ymin - origin.y) / dir.y;
    let t2 = (ymax - origin.y) / dir.y;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  // tmin is the entry point
  if (tmin < 0.1) tmin = tmax; // if inside the box, use exit
  if (tmin < 0.1) return null;
  return {
    dist: tmin,
    point: { x: origin.x + dir.x * tmin, y: origin.y + dir.y * tmin }
  };
}
// Ray vs line segment intersection (for mirrors)
// Ray: P = origin + t * direction, t > 0
// Segment: from A to B
function raySegmentIntersect(origin, dir, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const denom = dir.x * dy - dir.y * dx;
  if (Math.abs(denom) < 1e-8) return null; // parallel
  const ox = A.x - origin.x;
  const oy = A.y - origin.y;
  const t = (ox * dy - oy * dx) / denom;
  const u = (ox * dir.y - oy * dir.x) / denom;
  if (t > 0 && u >= 0 && u <= 1) {
    return {
      dist: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t }
    };
  }
  return null;
}
// Ray vs circle intersection (for prisms)
function rayCircleIntersect(origin, dir, centre, radius) {
  const ocx = origin.x - centre.x;
  const ocy = origin.y - centre.y;
  const a = dir.x * dir.x + dir.y * dir.y;
  const b = 2 * (ocx * dir.x + ocy * dir.y);
  const c = ocx * ocx + ocy * ocy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  let t = (-b - sqrtDisc) / (2 * a);
  if (t < 0.1) t = (-b + sqrtDisc) / (2 * a);
  if (t < 0.1) return null;
  return {
    dist: t,
    point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t }
  };
}
// Ray vs world bounds (rectangle from -hw to hw, -hh to hh)
function rayBoundsIntersect(origin, dir, worldWidth) {
  const hw = worldWidth / 2;
  const hh = WORLD_HEIGHT / 2;
  let tMin = Infinity;
  let hitPoint = null;
  const edges = [
    { axis: 'x', val: -hw },
    { axis: 'x', val: hw },
    { axis: 'y', val: -hh },
    { axis: 'y', val: hh },
  ];
  for (const edge of edges) {
    let t;
    if (edge.axis === 'x') {
      if (Math.abs(dir.x) < 1e-8) continue;
      t = (edge.val - origin.x) / dir.x;
      if (t > 0.1 && t < tMin) {
        const y = origin.y + dir.y * t;
        if (y >= -hh && y <= hh) {
          tMin = t;
          hitPoint = { x: edge.val, y };
        }
      }
    } else {
      if (Math.abs(dir.y) < 1e-8) continue;
      t = (edge.val - origin.y) / dir.y;
      if (t > 0.1 && t < tMin) {
        const x = origin.x + dir.x * t;
        if (x >= -hw && x <= hw) {
          tMin = t;
          hitPoint = { x, y: edge.val };
        }
      }
    }
  }
  if (hitPoint) return { dist: tMin, point: hitPoint };
  return null;
}
// Generate N band angles evenly distributed across the split spread
function generateBandAngles(n) {
  const colours = [COLOUR_AMBER, COLOUR_CYAN, COLOUR_GOLD, COLOUR_AMBER, COLOUR_CYAN, COLOUR_GOLD];
  const bands = [];
  for (let i = 0; i < n; i++) {
    // Distribute from -PRISM_SPLIT_ANGLE to +PRISM_SPLIT_ANGLE
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1 to +1
    bands.push({ colour: colours[i % colours.length], angleOffset: t * PRISM_SPLIT_ANGLE });
  }
  return bands;
}
// Rotate a 2D vector by angle (radians)
function rotateVec(v, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos
  };
}


// === src/beam-render.js ===
// ============================================================
// src/beam-render.js — Quad mesh pool for beam segment rendering
//
// Each segment is a textured quad with additive blending.
// A second wider quad behind provides soft glow.
// Pool is pre-allocated; unused meshes are hidden.
//
// Width encodes power: thicker = stronger beam.
// Gold band renders thinner and pulses slowly.
// ============================================================




const meshes = [];      // { core: Mesh, glow: Mesh }
let poolReady = false;
let pulseTime = 0;

// Gold is rendered at 60% width of other bands to be visually distinct
const GOLD_WIDTH_FACTOR = 0.6;

function initBeamRenderer() {
  const scene = getScene();
  for (let i = 0; i < BEAM_SEGMENT_POOL_SIZE; i++) {
    const core = createQuadMesh(1.0);
    const glow = createQuadMesh(0.35);
    core.visible = false;
    glow.visible = false;
    // Beams render behind objects (z < 0)
    glow.position.z = -0.5;
    core.position.z = -0.3;
    scene.add(glow);
    scene.add(core);
    meshes.push({ core, glow });
  }
  poolReady = true;
}

function updateBeamPulse(dt) {
  pulseTime += dt;
}

function rebuildBeams(segments) {
  if (!poolReady) return;

  for (let i = 0; i < BEAM_SEGMENT_POOL_SIZE; i++) {
    const entry = meshes[i];
    if (i < segments.length) {
      const seg = segments[i];

      // Width proportional to intensity: full=1.0, halved sub-ray=0.5
      let widthMult = seg.intensity;
      // Gold is thinner
      if (seg.colour === COLOUR_GOLD) widthMult *= GOLD_WIDTH_FACTOR;
      // Gold pulses: opacity oscillates 0.7–1.0
      let opacityMult = 1.0;
      if (seg.colour === COLOUR_GOLD) {
        opacityMult = 0.7 + 0.3 * Math.sin(pulseTime * 2.5);
      }

      const coreW = BEAM_WIDTH * widthMult;
      const glowW = BEAM_GLOW_WIDTH * widthMult;

      // Edge fade: reduce opacity if segment ends near world boundary
      const hh = WORLD_HEIGHT / 2;
      const edgeMargin = 4; // fade starts this many units from edge
      const endDistFromEdge = Math.min(
        Math.abs(seg.end.x) < 28 ? 99 : 28 - Math.abs(seg.end.x) + edgeMargin,
        hh - Math.abs(seg.end.y) + edgeMargin
      );
      const edgeFade = Math.min(1, Math.max(0.1, endDistFromEdge / edgeMargin));
      const finalOpacity = opacityMult * edgeFade;

      positionQuad(entry.core, seg.start, seg.end, coreW);
      positionQuad(entry.glow, seg.start, seg.end, glowW);
      setQuadColour(entry.core, seg.colour, seg.intensity * finalOpacity);
      setQuadColour(entry.glow, seg.colour, seg.intensity * 0.35 * finalOpacity);
      entry.core.visible = true;
      entry.glow.visible = true;
    } else {
      entry.core.visible = false;
      entry.glow.visible = false;
    }
  }
}

function createQuadMesh(opacity) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

function positionQuad(mesh, start, end, width) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  mesh.position.x = (start.x + end.x) / 2;
  mesh.position.y = (start.y + end.y) / 2;

  mesh.scale.x = length;
  mesh.scale.y = width;

  mesh.rotation.z = angle;
}

function setQuadColour(mesh, colour, intensity) {
  mesh.material.color.setHex(colour);
  mesh.material.opacity = Math.min(1.0, intensity);
}

// Hide/show all beam geometry (for game-over screen)
function setBeamsVisible(visible) {
  for (let i = 0; i < meshes.length; i++) {
    meshes[i].core.visible = visible && meshes[i].core.visible;
    meshes[i].glow.visible = visible && meshes[i].glow.visible;
  }
  if (!visible) {
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].core.visible = false;
      meshes[i].glow.visible = false;
    }
  }
}


// === src/mirror.js ===
// ============================================================
// src/mirror.js — Mirror objects, generic socket system, tweens
// ============================================================





const sockets = [];
const mirrors = [];
let mirrorMeshGroup = null;

const MIRROR_THICKNESS = 1;

// Active tweens: { mirror, fromX, fromY, toX, toY, elapsed, duration }
const tweens = [];

function initSockets() {
  sockets.length = 0;
  for (let i = 0; i < SOCKET_POSITIONS.length; i++) {
    sockets.push({ type: null, objectRef: null });
  }
}

function getSockets() { return sockets; }
function getSocketPositions() { return SOCKET_POSITIONS; }
function getMirrors() { return mirrors; }

function initMirrors() {
  const scene = getScene();
  mirrors.length = 0;
  tweens.length = 0;
  mirrorMeshGroup = new THREE.Group();
  scene.add(mirrorMeshGroup);

  for (let i = 0; i < MIRROR_COUNT_START; i++) {
    const socketIdx = DEFAULT_MIRROR_SOCKETS[i];
    const mirror = createMirror(socketIdx);
    mirrors.push(mirror);
    sockets[socketIdx].type = 'mirror';
    sockets[socketIdx].objectRef = mirror;
  }

  // Socket indicators: hidden when FREE_PLACEMENT is true
  if (!FREE_PLACEMENT) {
    for (let i = 0; i < SOCKET_POSITIONS.length; i++) {
      const [sx, sy] = SOCKET_POSITIONS[i];
      const indicator = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 1.8, 16),
        new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.5 })
      );
      indicator.position.set(sx, sy, -1.0);
      mirrorMeshGroup.add(indicator);
    }
  }
}

function createMirror(socketIndex) {
  const [sx, sy] = SOCKET_POSITIONS[socketIndex];
  const angle = Math.PI / 4;

  const geo = new THREE.PlaneGeometry(MIRROR_LENGTH, MIRROR_THICKNESS);
  const mat = new THREE.MeshBasicMaterial({ color: 0x8888cc });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sx, sy, 0);
  mesh.rotation.z = angle;
  mirrorMeshGroup.add(mesh);

  return {
    id: socketIndex,
    socketIndex,
    angle,
    hits: 0,
    shattered: false,
    reinforced: false,
    anchored: false,
    freeX: sx,
    freeY: sy,
    mesh,
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
    normal: { x: 0, y: 0 },
    length: MIRROR_LENGTH,
  };
}

function updateMirrorGeometry(mirror) {
  let sx, sy;
  if (FREE_PLACEMENT && mirror.freeX !== undefined) {
    sx = mirror.freeX;
    sy = mirror.freeY;
  } else {
    [sx, sy] = SOCKET_POSITIONS[mirror.socketIndex];
  }
  const halfLen = mirror.length / 2;
  const cos = Math.cos(mirror.angle);
  const sin = Math.sin(mirror.angle);

  mirror.p1 = { x: sx - halfLen * cos, y: sy - halfLen * sin };
  mirror.p2 = { x: sx + halfLen * cos, y: sy + halfLen * sin };
  mirror.normal = { x: -sin, y: cos };

  mirror.mesh.position.set(sx, sy, 0);
  mirror.mesh.rotation.z = mirror.angle;
}

// Free placement: move mirror to position, clamped to mirror field
function moveMirrorFree(mirror, x, y) {
  const ww = getWorldWidth();
  const hw = ww / 2;
  mirror.freeX = Math.max(-hw + 2, Math.min(hw - 2, x));
  mirror.freeY = Math.max(MIRROR_FIELD_BOT, Math.min(MIRROR_FIELD_TOP, y));
  updateMirrorGeometry(mirror);
  markDirty();
}

// --- Tween system ---

// Ease-out cubic: decelerates to zero
function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Start a tween from current visual position to target socket
function startTween(mirror, fromX, fromY) {
  const [toX, toY] = SOCKET_POSITIONS[mirror.socketIndex];
  // Remove any existing tween for this mirror
  for (let i = tweens.length - 1; i >= 0; i--) {
    if (tweens[i].mirror === mirror) tweens.splice(i, 1);
  }
  tweens.push({
    mirror,
    fromX, fromY,
    toX, toY,
    elapsed: 0,
    duration: MIRROR_TWEEN_MS / 1000
  });
}

// Called from main loop each frame. Returns true if any tween is active.
function updateMirrorTweens(dt) {
  let anyActive = false;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.elapsed += dt;
    const t = Math.min(tw.elapsed / tw.duration, 1);
    const e = easeOut(t);

    const x = tw.fromX + (tw.toX - tw.fromX) * e;
    const y = tw.fromY + (tw.toY - tw.fromY) * e;
    tw.mirror.mesh.position.x = x;
    tw.mirror.mesh.position.y = y;

    // During tween, update geometry based on interpolated position
    // so beam sweeps smoothly
    const halfLen = tw.mirror.length / 2;
    const cos = Math.cos(tw.mirror.angle);
    const sin = Math.sin(tw.mirror.angle);
    tw.mirror.p1 = { x: x - halfLen * cos, y: y - halfLen * sin };
    tw.mirror.p2 = { x: x + halfLen * cos, y: y + halfLen * sin };
    tw.mirror.normal = { x: -sin, y: cos };

    markDirty(); // re-solve beam every frame during tween
    anyActive = true;

    if (t >= 1) {
      // Tween complete — snap to final position
      updateMirrorGeometry(tw.mirror);
      tweens.splice(i, 1);
    }
  }
  return anyActive;
}

// Move mirror to a new socket with tween
function moveMirrorToSocket(mirror, newSocketIndex) {
  const oldIndex = mirror.socketIndex;
  const targetSocket = sockets[newSocketIndex];

  // Capture current visual position for tween start
  const fromX = mirror.mesh.position.x;
  const fromY = mirror.mesh.position.y;

  if (targetSocket.type !== null && targetSocket.objectRef !== mirror) {
    const other = targetSocket.objectRef;
    sockets[oldIndex].type = targetSocket.type;
    sockets[oldIndex].objectRef = other;
    if (other.socketIndex !== undefined) {
      other.socketIndex = oldIndex;
      const [ox, oy] = SOCKET_POSITIONS[oldIndex];
      if (other.mesh) other.mesh.position.set(ox, oy, 0);
      if (other.p1) updateMirrorGeometry(other);
      if (other.position) {
        other.position.x = ox;
        other.position.y = oy;
      }
    }
  } else {
    sockets[oldIndex].type = null;
    sockets[oldIndex].objectRef = null;
  }

  sockets[newSocketIndex].type = 'mirror';
  sockets[newSocketIndex].objectRef = mirror;
  mirror.socketIndex = newSocketIndex;

  // Start tween from dragged position to target socket
  startTween(mirror, fromX, fromY);
  markDirty();
}

function rotateMirror(mirror, newAngle) {
  mirror.angle = newAngle;
  updateMirrorGeometry(mirror);
  markDirty();
}

function damageMirror(mirror) {
  if (mirror.shattered) return;
  mirror.hits++;
  if (mirror.hits >= MIRROR_MAX_HITS && !mirror.reinforced) {
    mirror.shattered = true;
    mirror.mesh.material.color.setHex(0x330000);
    mirror.mesh.material.opacity = 0.3;
    mirror.mesh.material.transparent = true;
    markDirty();
  } else {
    const darkness = 1 - (mirror.hits / MIRROR_MAX_HITS) * 0.4;
    mirror.mesh.material.color.setRGB(0.53 * darkness, 0.53 * darkness, 0.8 * darkness);
  }
}

function repairMirror(mirror) {
  mirror.hits = 0;
  mirror.shattered = false;
  mirror.mesh.material.color.setHex(0x8888cc);
  mirror.mesh.material.opacity = 1.0;
  mirror.mesh.material.transparent = false;
  markDirty();
}

function updateAllMirrorGeometries() {
  for (const mirror of mirrors) {
    updateMirrorGeometry(mirror);
  }
}

// Reset all mirrors to default positions, angles, and states
function resetMirrors() {
  for (let i = 0; i < mirrors.length; i++) {
    const mirror = mirrors[i];
    const socketIdx = DEFAULT_MIRROR_SOCKETS[i];
    const [sx, sy] = SOCKET_POSITIONS[socketIdx];
    // Reset socket occupancy
    sockets[mirror.socketIndex].type = null;
    sockets[mirror.socketIndex].objectRef = null;
    // Restore to default socket
    mirror.socketIndex = socketIdx;
    mirror.freeX = sx;
    mirror.freeY = sy;
    mirror.angle = Math.PI / 4;
    mirror.hits = 0;
    mirror.shattered = false;
    mirror.reinforced = false;
    mirror.anchored = false;
    mirror.mesh.material.color.setHex(0x8888cc);
    mirror.mesh.material.opacity = 1.0;
    mirror.mesh.material.transparent = false;
    mirror.mesh.visible = true;
    sockets[socketIdx].type = 'mirror';
    sockets[socketIdx].objectRef = mirror;
    updateMirrorGeometry(mirror);
  }
}


// === src/prism.js ===
// ============================================================
// src/prism.js — Prism object, uses generic socket grid
// ============================================================






const prisms = [];
const PRISM_RADIUS = 2.5;
let activeTier = DEFAULT_PRISM_TIER;

function getPrisms() { return prisms; }
function getActiveTier() { return activeTier; }
function getActiveTierData() { return PRISM_TIERS[activeTier]; }

function setTier(newTier) {
  activeTier = newTier;
  markDirty(); // beam re-solves with new band count
}

function resetTier() { activeTier = DEFAULT_PRISM_TIER; }

// Reset prisms to initial state (remove craft-purchased ones, keep default)
function resetPrisms() {
  const sockets = getSockets();
  // Remove all prisms from sockets
  for (const prism of prisms) {
    if (sockets[prism.socketIndex]) {
      sockets[prism.socketIndex].type = null;
      sockets[prism.socketIndex].objectRef = null;
    }
    if (prism.mesh) prism.mesh.visible = false;
  }
  prisms.length = 0;
  // Re-place the default prism
  placePrism(DEFAULT_PRISM_SOCKET);
}

function initPrisms() {
  prisms.length = 0;
  // Place prism in default socket — directly below aperture
  placePrism(DEFAULT_PRISM_SOCKET);
}

function placePrism(socketIndex) {
  const scene = getScene();
  const sockets = getSockets();
  const [sx, sy] = SOCKET_POSITIONS[socketIndex];

  // Diamond shape (rotated square): apex up, vertices at top/bottom/left/right
  // Faceted: 4 triangles from centre, each a different brightness
  const r = PRISM_RADIUS;
  const group = new THREE.Group();
  group.position.set(sx, sy, 0.2);

  // Four facet triangles: top, right, bottom, left
  const verts = [
    { x: 0, y: r },     // top apex
    { x: r, y: 0 },     // right
    { x: 0, y: -r },    // bottom
    { x: -r, y: 0 },    // left
  ];
  // Cool glass tones, slightly different per facet
  const facetColours = [0xddeeff, 0xbbddee, 0xaaccdd, 0xccddee];
  // Bottom facets get a faint band-colour tint
  const bottomTints = [null, null, 0xffe9a0, 0xff8c1a]; // top, right = glass; bottom = gold hint; left = amber hint
  for (let i = 0; i < 4; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 4];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(a.x, a.y);
    shape.lineTo(b.x, b.y);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const col = bottomTints[i] || facetColours[i];
    const mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true,
      opacity: i >= 2 ? 0.7 : 0.85, // bottom half slightly more translucent
    });
    const facetMesh = new THREE.Mesh(geo, mat);
    facetMesh.position.z = 0.01 * i; // tiny offset to avoid z-fight
    group.add(facetMesh);
  }

  // Internal glow (additive, brightens with beam)
  const glowGeo = new THREE.PlaneGeometry(r * 1.4, r * 1.4);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xddeeff, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.z = -0.05;
  group.add(glowMesh);

  scene.add(group);

  const prism = {
    id: prisms.length,
    socketIndex,
    position: { x: sx, y: sy },
    radius: PRISM_RADIUS,
    mesh: group,
    glowMat, // reference to update glow intensity
  };

  prisms.push(prism);
  sockets[socketIndex].type = 'prism';
  sockets[socketIndex].objectRef = prism;

  markDirty();
  return prism;
}

// Move prism to a new socket (swap if occupied)
function movePrismToSocket(prism, newSocketIndex) {
  const sockets = getSockets();
  const oldIndex = prism.socketIndex;
  const targetSocket = sockets[newSocketIndex];

  if (targetSocket.type !== null && targetSocket.objectRef !== prism) {
    // Swap
    const other = targetSocket.objectRef;
    sockets[oldIndex].type = targetSocket.type;
    sockets[oldIndex].objectRef = other;
    if (other.socketIndex !== undefined) {
      other.socketIndex = oldIndex;
      const [ox, oy] = SOCKET_POSITIONS[oldIndex];
      if (other.mesh) other.mesh.position.set(ox, oy, 0);
      // If it's a mirror, update its geometry
      if (other.p1) {
        updateMirrorGeometry(other);
      }
      if (other.position) {
        other.position.x = ox;
        other.position.y = oy;
      }
    }
  } else {
    sockets[oldIndex].type = null;
    sockets[oldIndex].objectRef = null;
  }

  // Place prism in new socket
  const [sx, sy] = SOCKET_POSITIONS[newSocketIndex];
  sockets[newSocketIndex].type = 'prism';
  sockets[newSocketIndex].objectRef = prism;
  prism.socketIndex = newSocketIndex;
  prism.position.x = sx;
  prism.position.y = sy;
  prism.mesh.position.set(sx, sy, 0);

  markDirty();
}

// Update prism glow based on beam activity (call from main loop)
function updatePrismGlow(segments) {
  for (const prism of prisms) {
    if (!prism.glowMat) continue;
    // Check if any segment terminates at this prism (beam passing through)
    let lit = false;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const dx = seg.end.x - prism.position.x;
      const dy = seg.end.y - prism.position.y;
      if (dx * dx + dy * dy < prism.radius * prism.radius * 2) {
        lit = true;
        break;
      }
    }
    prism.glowMat.opacity = lit ? 0.5 + 0.2 * Math.sin(performance.now() * 0.005) : 0.15;
  }
}


// === src/enemy.js ===
// ============================================================
// src/enemy.js — Ships spawn at top, descend toward wall at bottom
// ============================================================





const pool = [];
let enemyGroup = null;

function initEnemies() {
  const scene = getScene();
  enemyGroup = new THREE.Group();
  scene.add(enemyGroup);

  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(3, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.3;

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

    enemyGroup.add(mesh);
    pool.push({
      active: false, type: 'skiff',
      hp: 0, maxHp: 0, armour: 0, heat: 0,
      lane: 0, y: SHIP_SPAWN_Y,
      speed: 0, baseSpeed: 0,
      burn: 0, slowed: false,
      bandsHitting: 0, lastHitColour: 0,
      mesh, barFill
    });
  }
}

function getEnemyPool() { return pool; }

function spawnEnemy(type, lane, hpMultiplier) {
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
      e.lane = lane;
      e.y = SHIP_SPAWN_Y;
      e.speed = template.speed;
      e.baseSpeed = template.speed;
      e.burn = 0;
      e.heat = 0;
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
function updateEnemies(dt) {
  let wallDamage = 0;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    e.slowed = false;
    e.y -= e.speed * dt; // descend
    if (e.y <= WALL_Y) {
      // Breach: ship reached the wall
      const dmg = BREACH_DAMAGE[e.type] || 10;
      const heatFrac = Math.min(1, (e.heat || 0) / e.maxHp);
      wallDamage += dmg * Math.max(0.2, 1 - heatFrac);
      deactivateEnemy(e);
      continue;
    }
    positionEnemy(e);
    updateEnemyVisual(e);
  }
  return wallDamage;
}

function applyGoldSlow(enemy) { enemy.slowed = true; }

function applySlowStates() {
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!e.active) continue;
    e.speed = e.slowed ? e.baseSpeed * 0.5 : e.baseSpeed;
  }
}

function deactivateEnemy(enemy) {
  enemy.active = false;
  enemy.mesh.visible = false;
}

function triggerKillEffect(enemy, reward) {
  addKillReward(reward);
  enemy.mesh.material.color.setHex(0xffffff);
}

function getActiveEnemies() { return pool.filter(e => e.active); }

function resetEnemies() {
  for (let i = 0; i < pool.length; i++) {
    pool[i].active = false;
    pool[i].mesh.visible = false;
  }
}

function positionEnemy(e) {
  const worldWidth = getWorldWidth();
  const laneWidth = worldWidth / ENEMY_LANE_COUNT;
  const x = -worldWidth / 2 + laneWidth * (e.lane + 0.5);
  e.mesh.position.x = x;
  e.mesh.position.y = e.y;
}

function updateEnemyVisual(e) {
  e.burn = Math.max(0, (e.heat || 0) / e.maxHp);
  e.barFill.scale.x = e.burn;
  e.barFill.position.x = -2.5 * (1 - e.burn);
  if (e.bandsHitting > 0 && e.lastHitColour !== 0) {
    const r = ((e.lastHitColour >> 16) & 0xff) / 255;
    const g = ((e.lastHitColour >> 8) & 0xff) / 255;
    const b = (e.lastHitColour & 0xff) / 255;
    const t = Math.min(0.3 + e.burn * 1.0, 1.0);
    e.mesh.material.color.setRGB(0.25*(1-t)+r*t, 0.2*(1-t)+g*t, 0.2*(1-t)+b*t);
  } else if (e.slowed) {
    e.mesh.material.color.setRGB(0.4, 0.5, 0.25);
  } else {
    const brightness = 0.35 + 0.15 * (1 - e.burn);
    e.mesh.material.color.setRGB(brightness, brightness*0.8, brightness*0.8);
  }
  const sizes = { skiff: 2.5, trireme: 3.5, quadrireme: 4.5, flagship: 8 };
  const s = sizes[e.type] || 3;
  e.mesh.scale.set(s/3, s/3, 1);
}


// === src/enemy-spawner.js ===
// ============================================================
// src/enemy-spawner.js — Spawn schedule for 600s session
// Phase 1 (0-1:00): Skiffs. Phase 2 (1-3:00): Triremes+Quadriremes.
// Phase 3 (3-9:00): Heavy mix. Phase 4 (9-10:00): Flagship.
// ============================================================




const PHASE1_INTERVAL = 2.5;
const PHASE2_INTERVAL = 1.5;
const PHASE3_INTERVAL = 1.2;
const INITIAL_DELAY = 2.0;

let spawnTimer = 0;
let spawnerElapsed = 0;
let totalSpawns = 0;
let flagshipSpawned = false;

function getSpawnCount() { return totalSpawns; }
function getCurrentInterval() { return getInterval(); }

function updateSpawner(dt, sessionTime) {
  spawnerElapsed = sessionTime;
  spawnTimer -= dt;
  if (spawnTimer <= 0 && spawnerElapsed >= INITIAL_DELAY) {
    doSpawn();
    totalSpawns++;
    spawnTimer = getInterval();
  }
}

function resetSpawner() {
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


// === src/foundry.js ===
// ============================================================
// src/foundry.js — Multi-currency passive altar economy
// 4 metals generated automatically. No beam interaction needed.
// ============================================================



// Resources
let resources = { brass: 0, bronze: 0, silver: 0, gold: 0 };
let faith = 0;
let priestCount = 0;

function getResources() { return resources; }
function getFaith() { return faith; }
function getPriestCount() { return priestCount; }
function addPriest() { priestCount++; }

function canAfford(cost) {
  if (!cost) return false;
  for (const key in cost) {
    if ((resources[key] || 0) < cost[key]) return false;
  }
  return true;
}

function spend(cost) {
  for (const key in cost) {
    resources[key] -= cost[key];
  }
}

function addKillReward(reward) {
  if (!reward) return;
  for (const key in reward) {
    resources[key] = (resources[key] || 0) + reward[key];
  }
}

function resetFoundries() {
  resources = { brass: 0, bronze: 0, silver: 0, gold: 0 };
  faith = 0;
  priestCount = 0;
}

function updateFoundries(dt) {
  // Passive altar income
  resources.brass += ALTAR_RATES.brass * dt;
  resources.bronze += ALTAR_RATES.bronze * dt;
  resources.silver += ALTAR_RATES.silver * dt;
  resources.gold += ALTAR_RATES.gold * dt;
  // Priests generate faith
  faith += priestCount * dt;
}

function spendFaith(amount) {
  faith -= amount;
}

// Legacy exports for compatibility
function getSlag() { return resources.brass; }
function getInsight() { return resources.bronze; }
function getRecombination() { return 0; }
function getInsightLog() { return []; }
function spendSlag() {}
function spendInsight() {}
function addSlagDirect(amount) { resources.brass += amount; }
function getFoundryColliders() { return []; }
function initFoundries() { resetFoundries(); }


// === src/crafting.js ===
// ============================================================
// src/crafting.js — Shop UI: mirrors, prisms, priests, god abilities
// Rendered as in-scene canvas texture at bottom of playfield.
// ============================================================







let trayMesh = null;
let trayCanvas = null;
let trayCtx = null;
let trayTexture = null;
let trayY = 0;
let trayWidth = 0;
const trayHeight = 5;
let mirrorsBought = 0;
let focusCount = 0;

// Shop items displayed in the tray
const SHOP_ITEMS = [
  { id: 'mirror', label: 'Mirror', getCost: () => ({ brass: SHOP.mirror.brass + mirrorsBought * SHOP.mirror.scaling }) },
  { id: 'prism4', label: '4-Prism', getCost: () => SHOP.prism4 },
  { id: 'prism5', label: '5-Prism', getCost: () => SHOP.prism5 },
  { id: 'prism6', label: '6-Prism', getCost: () => SHOP.prism6 },
  { id: 'priest', label: 'Priest', getCost: () => SHOP.priest },
  { id: 'zeus',   label: 'Zeus', getCost: () => ({ faith: GOD_ABILITIES.zeus.faith, gold: GOD_ABILITIES.zeus.gold }) },
];

function getFocusMultiplier() { return 1 + focusCount * 0.15; }

function initCrafting() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  mirrorsBought = 0;
  activeTier = 3;
  focusCount = 0;

  trayWidth = worldWidth * 0.95;
  trayY = -WORLD_HEIGHT / 2 + 3;

  trayCanvas = document.createElement('canvas');
  trayCanvas.width = 512;
  trayCanvas.height = 40;
  trayCtx = trayCanvas.getContext('2d');

  trayTexture = new THREE.CanvasTexture(trayCanvas);
  trayTexture.minFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(trayWidth, trayHeight);
  const mat = new THREE.MeshBasicMaterial({ map: trayTexture, transparent: true, depthWrite: false });
  trayMesh = new THREE.Mesh(geo, mat);
  trayMesh.position.set(0, trayY, 0);
  oScene.add(trayMesh);
}

function updateCraftingTray() {
  if (!trayCtx) return;
  const res = getResources();
  const faith = getFaith();

  trayCtx.clearRect(0, 0, 512, 40);
  trayCtx.fillStyle = 'rgba(0,0,0,0.7)';
  trayCtx.fillRect(0, 0, 512, 40);

  const btnW = 512 / SHOP_ITEMS.length;
  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const item = SHOP_ITEMS[i];
    const cost = item.getCost();
    const affordable = canAffordCombined(cost, res, faith);
    const x = i * btnW;

    trayCtx.fillStyle = affordable ? 'rgba(80,80,120,0.9)' : 'rgba(30,30,30,0.7)';
    trayCtx.fillRect(x + 1, 1, btnW - 2, 38);

    trayCtx.fillStyle = affordable ? '#ffffff' : '#555555';
    trayCtx.font = 'bold 9px monospace';
    trayCtx.textAlign = 'center';
    trayCtx.fillText(item.label, x + btnW / 2, 14);

    trayCtx.font = '7px monospace';
    trayCtx.fillStyle = affordable ? '#aaaaaa' : '#333333';
    trayCtx.fillText(costStr(cost), x + btnW / 2, 28);
  }
  trayTexture.needsUpdate = true;
}

function handleCraftTap(worldX, worldY) {
  const halfW = trayWidth / 2;
  const halfH = trayHeight / 2;
  if (worldY < trayY - halfH || worldY > trayY + halfH) return false;
  if (worldX < -halfW || worldX > halfW) return false;

  const normX = (worldX + halfW) / trayWidth;
  const btnIndex = Math.floor(normX * SHOP_ITEMS.length);
  if (btnIndex < 0 || btnIndex >= SHOP_ITEMS.length) return false;

  return attemptPurchase(SHOP_ITEMS[btnIndex]);
}

function resetCrafting() {
  mirrorsBought = 0;
  focusCount = 0;
  if (typeof resetTier === 'function') resetTier();
}

function attemptPurchase(item) {
  const res = getResources();
  const faith = getFaith();
  const cost = item.getCost();
  if (!canAffordCombined(cost, res, faith)) return false;

  // Spend resources
  const resCost = {};
  for (const k in cost) {
    if (k === 'faith') { spendFaith(cost[k]); }
    else { resCost[k] = cost[k]; }
  }
  if (Object.keys(resCost).length > 0) spend(resCost);

  switch (item.id) {
    case 'mirror': mirrorsBought++; break;
    case 'prism4': setTier(4); markDirty(); break;
    case 'prism5': setTier(5); markDirty(); break;
    case 'prism6': setTier(6); markDirty(); break;
    case 'priest': addPriest(); break;
    case 'zeus': triggerGodAbility('zeus'); break;
  }
  return true;
}

function triggerGodAbility(god) {
  // TODO: implement god ability effects
  console.log('[God] ' + god + ' activated!');
}

function canAffordCombined(cost, res, faith) {
  for (const k in cost) {
    if (k === 'faith') { if (faith < cost[k]) return false; }
    else { if ((res[k] || 0) < cost[k]) return false; }
  }
  return true;
}

function costStr(cost) {
  const parts = [];
  for (const k in cost) {
    parts.push(cost[k] + k[0].toUpperCase());
  }
  return parts.join(' ');
}


// === src/effects.js ===
// ============================================================
// src/effects.js — Contact glow, sparks, destruction sequence, audio
// Pooled sprites, no per-frame allocation.
// ============================================================



// --- Contact glow pool (beam hitting enemy) ---
const GLOW_POOL_SIZE = 8;
const glowPool = [];

// --- Spark pool (short-lived particles on damage) ---
const SPARK_POOL_SIZE = 24;
const sparkPool = [];

// --- Debris pool (destruction particles) ---
const DEBRIS_POOL_SIZE = 16;
const debrisPool = [];

// --- WebAudio context (created on first user interaction) ---
let audioCtx = null;

function initEffects() {
  const scene = getScene();
  // Contact glows
  for (let i = 0; i < GLOW_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(3, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.4;
    scene.add(mesh);
    glowPool.push({ mesh, life: 0, colour: 0xffffff, scale: 1 });
  }
  // Sparks
  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.5;
    scene.add(mesh);
    sparkPool.push({ mesh, life: 0, vx: 0, vy: 0 });
  }
  // Debris
  for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
    const geo = new THREE.PlaneGeometry(1.2, 1.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x886644, transparent: true, opacity: 0, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.z = 0.3;
    scene.add(mesh);
    debrisPool.push({ mesh, life: 0, vx: 0, vy: 0, gravity: 0 });
  }
}

function updateEffects(dt) {
  // Glows: fade out
  for (const g of glowPool) {
    if (g.life > 0) {
      g.life -= dt;
      g.mesh.material.opacity = Math.max(0, g.life * 2);
      g.mesh.scale.set(g.scale * (1 + (1 - g.life) * 0.5), g.scale * (1 + (1 - g.life) * 0.5), 1);
      if (g.life <= 0) g.mesh.visible = false;
    }
  }
  // Sparks: move + fade
  for (const s of sparkPool) {
    if (s.life > 0) {
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.vy -= 30 * dt; // gravity
      s.mesh.material.opacity = Math.max(0, s.life * 3);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
  // Debris: move + gravity + fade
  for (const d of debrisPool) {
    if (d.life > 0) {
      d.life -= dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.vy -= d.gravity * dt;
      d.mesh.material.opacity = Math.max(0, d.life / 1.5);
      d.mesh.rotation.z += 3 * dt;
      if (d.life <= 0) d.mesh.visible = false;
    }
  }
}

// Spawn a contact glow at position, scaled by DPS
function spawnContactGlow(x, y, colour, dps) {
  for (const g of glowPool) {
    if (g.life <= 0) {
      g.mesh.position.x = x;
      g.mesh.position.y = y;
      g.mesh.material.color.setHex(colour);
      g.mesh.material.opacity = 0.6;
      g.mesh.visible = true;
      g.life = 0.15;
      g.scale = 0.5 + Math.min(dps / 50, 2);
      g.colour = colour;
      return;
    }
  }
}

// Spawn sparks at position
function spawnSparks(x, y, colour, count) {
  for (let n = 0; n < count; n++) {
    for (const s of sparkPool) {
      if (s.life <= 0) {
        s.mesh.position.x = x;
        s.mesh.position.y = y;
        s.mesh.material.color.setHex(colour);
        s.mesh.material.opacity = 1;
        s.mesh.visible = true;
        s.life = 0.2 + Math.random() * 0.2;
        s.vx = (Math.random() - 0.5) * 30;
        s.vy = Math.random() * 20;
        break;
      }
    }
  }
}

// Destruction sequence: flash + debris + audio
function spawnDestruction(x, y) {
  // Flash (large bright glow)
  spawnContactGlow(x, y, 0xffffff, 100);
  // Debris particles
  for (let i = 0; i < 8; i++) {
    for (const d of debrisPool) {
      if (d.life <= 0) {
        d.mesh.position.x = x;
        d.mesh.position.y = y;
        d.mesh.material.opacity = 1;
        d.mesh.visible = true;
        d.life = 0.8 + Math.random() * 0.7; // 0.8-1.5s
        d.vx = (Math.random() - 0.5) * 25;
        d.vy = Math.random() * 15 + 5;
        d.gravity = 20 + Math.random() * 10;
        d.mesh.rotation.z = Math.random() * 6.28;
        break;
      }
    }
  }
  // Audio: wood crack + thump
  playDestructionSound();
}

// --- WebAudio synthesis ---
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  return audioCtx;
}

function playDestructionSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Wood crack: short noise burst
  const noiseLen = 0.08;
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseLen);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  // Low thump: sine at 60Hz
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

function resetEffects() {
  for (const g of glowPool) { g.life = 0; g.mesh.visible = false; }
  for (const s of sparkPool) { s.life = 0; s.mesh.visible = false; }
  for (const d of debrisPool) { d.life = 0; d.mesh.visible = false; }
}


// === src/damage.js ===
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










const ENEMY_HIT_HALF_W = 3;
const ENEMY_HIT_HALF_H = 3;
let totalKills = 0;

function getKillCount() { return totalKills; }
function resetDamage() { totalKills = 0; }

function updateDamage(dt) {
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

    // Count full bands (intensity=1) and sub-rays (intensity<1) hitting this enemy
    let fullBands = 0;
    let subRays = 0;
    let subRayIntensity = 0;
    let goldHitting = false;
    let hitColour = 0;
    let totalBeamsHitting = 0;

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      if (segmentIntersectsBox(seg, ex, ey, ENEMY_HIT_HALF_W, ENEMY_HIT_HALF_H)) {
        totalBeamsHitting++;
        hitColour = seg.colour;
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
      const tier = (typeof getActiveTier === 'function') ? getActiveTier() : 3;
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

      // Contact glow + sparks (throttled: every ~0.1s)
      if (Math.random() < dt * 10) {
        const ex = -worldWidth / 2 + laneWidth * (enemy.lane + 0.5);
        spawnContactGlow(ex, enemy.y, hitColour || 0xffaa00, raw);
        spawnSparks(ex, enemy.y, hitColour || 0xffaa00, 2);
      }

      if (enemy.heat >= enemy.maxHp) {
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


// === src/session.js ===
// ============================================================
// src/session.js — Timer, breach counter, win/lose state, reset
//
// Win: Recombination >= 100% at 15:00, OR Devourer killed.
// Lose: 3 breaches, OR 15:00 with Devourer alive + Recombination < 100%.
// ============================================================













let elapsed = 0;
let wallIntegrity = 100; // wall HP, starts at 100
let gameOver = false;
let gameWon = false;
let devourerKilled = false;


// HUD
let hudCanvas = null;
let hudCtx = null;
let hudTexture = null;
let hudMesh = null;

// Overlay
let overlayMesh = null;
let overlayCanvas = null;
let overlayCtx = null;
let overlayTexture = null;
let dimMesh = null;

function initSession() {
  elapsed = 0;
  wallIntegrity = WALL_MAX_HP;
  gameOver = false;
  gameWon = false;
  devourerKilled = false;
  createHud();
  createOverlay();
}

function getElapsed() { return elapsed; }
function getBreaches() { return Math.floor(WALL_MAX_HP - wallIntegrity); }
function getWallIntegrity() { return wallIntegrity; }
function isGameOver() { return gameOver; }
function isGameWon() { return gameWon; }
function notifyDevourerKilled() { devourerKilled = true; }

function updateSession(dt) {
  if (gameOver) return;
  elapsed += dt;

  // Check win/lose at session end
  if (elapsed >= SESSION_DURATION) {
    const recombo = getRecombination();
    if (recombo >= 100 || devourerKilled) {
      triggerWin();
    } else {
      triggerLose();
    }
  }

  // Devourer killed mid-session is also a win
  if (devourerKilled && !gameOver) {
    triggerWin();
  }
}

function addBreaches(damage) {
  if (damage <= 0 || gameOver) return;
  if (DEV.INVINCIBLE) return;
  wallIntegrity = Math.max(0, wallIntegrity - damage);
  if (wallIntegrity <= 0) {
    triggerLose();
  }
}

function updateHud() {
  if (!hudCtx) return;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const res = getResources();

  hudCtx.clearRect(0, 0, 512, 64);
  // Timer (top-left)
  hudCtx.fillStyle = elapsed >= 480 ? '#ff4444' : '#ffffff';
  hudCtx.font = 'bold 24px monospace';
  hudCtx.textAlign = 'left';
  hudCtx.fillText(timeStr, 8, 20);
  // Wall (top-right)
  hudCtx.textAlign = 'right';
  hudCtx.fillStyle = wallIntegrity > 30 ? '#ffffff' : '#ff4444';
  hudCtx.font = '18px monospace';
  hudCtx.fillText('Wall:' + Math.ceil(wallIntegrity) + '%', 504, 20);
  // Resources (bottom row)
  hudCtx.font = '13px monospace';
  hudCtx.textAlign = 'left';
  hudCtx.fillStyle = '#ccaa44';
  hudCtx.fillText('Br:' + Math.floor(res.brass), 8, 48);
  hudCtx.fillStyle = '#cc8833';
  hudCtx.fillText('Bz:' + Math.floor(res.bronze), 100, 48);
  hudCtx.fillStyle = '#cccccc';
  hudCtx.fillText('Si:' + Math.floor(res.silver), 195, 48);
  hudCtx.fillStyle = '#ffdd00';
  hudCtx.fillText('Au:' + Math.floor(res.gold), 285, 48);
  hudCtx.fillStyle = '#aa88ff';
  hudCtx.fillText('F:' + Math.floor(getFaith()), 370, 48);

  hudTexture.needsUpdate = true;
}

  hudTexture.needsUpdate = true;
}

function resetSession() {
  elapsed = 0;
  wallIntegrity = WALL_MAX_HP;
  gameOver = false;
  gameWon = false;
  devourerKilled = false;
  resetEnemies();
  resetSpawner();
  resetDamage();
  resetFoundries();
  resetCrafting();
  resetMirrors();
  resetPrisms();
  resetTier();
  markDirty();
  hideOverlay();
  // Restore visibility hidden on end state
  if (typeof setBeamsVisible === 'function') setBeamsVisible(true);
  if (trayMesh) trayMesh.visible = true;
  if (hudMesh) hudMesh.visible = true;
}

function triggerWin() {
  gameOver = true;
  gameWon = true;
  onEndState();
  showOverlay(MSG_WIN);
}

function triggerLose() {
  gameOver = true;
  gameWon = false;
  onEndState();
  showOverlay(MSG_LOSE);
}

// Called when game ends — hide beams, craft tray
function onEndState() {
  if (typeof setBeamsVisible === 'function') setBeamsVisible(false);
  if (trayMesh) trayMesh.visible = false;
  if (hudMesh) hudMesh.visible = false;
}

// --- HUD ---

function createHud() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 512 * dpr;
  hudCanvas.height = 64 * dpr;
  hudCtx = hudCanvas.getContext('2d');
  hudCtx.scale(dpr, dpr);

  hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.minFilter = THREE.LinearFilter;

  const hudGeo = new THREE.PlaneGeometry(worldWidth * 0.95, 7);
  const hudMat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    depthWrite: false
  });
  hudMesh = new THREE.Mesh(hudGeo, hudMat);
  hudMesh.position.set(0, WORLD_HEIGHT / 2 - 5, 0);
  oScene.add(hudMesh);
}

// --- Overlay ---

function createOverlay() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();

  const dimGeo = new THREE.PlaneGeometry(worldWidth * 1.2, WORLD_HEIGHT * 1.2);
  const dimMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  dimMesh = new THREE.Mesh(dimGeo, dimMat);
  dimMesh.position.set(0, 0, 0);
  dimMesh.visible = false;
  oScene.add(dimMesh);

  overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = 256;
  overlayCanvas.height = 128;
  overlayCtx = overlayCanvas.getContext('2d');

  overlayTexture = new THREE.CanvasTexture(overlayCanvas);
  overlayTexture.minFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(worldWidth * 0.8, 30);
  const mat = new THREE.MeshBasicMaterial({
    map: overlayTexture,
    transparent: true,
    depthWrite: false
  });
  overlayMesh = new THREE.Mesh(geo, mat);
  overlayMesh.position.set(0, 5, 1);
  overlayMesh.visible = false;
  oScene.add(overlayMesh);
}

function showOverlay(text) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.fillStyle = gameWon ? '#00ff88' : '#ff4444';
  overlayCtx.font = 'bold 22px monospace';
  overlayCtx.textAlign = 'center';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    overlayCtx.fillText(lines[i], 128, 40 + i * 28);
  }
  overlayTexture.needsUpdate = true;
  overlayMesh.visible = true;
  dimMesh.visible = true;
}

function hideOverlay() {
  if (overlayMesh) overlayMesh.visible = false;
  if (dimMesh) dimMesh.visible = false;
}

function handleRestartTap() {
  if (gameOver) {
    resetSession();
  }
}


// === src/input.js ===
// ============================================================
// src/input.js — Pointer events, drag/rotate, debug overlay
// ============================================================










const STATE_IDLE = 0;
const STATE_SELECTED = 1;
const STATE_DRAG = 2;
const STATE_ROTATE = 3;
let state = STATE_IDLE;
let selectedObject = null;   // currently selected (highlighted)
let selectedType = null;     // 'mirror' or 'prism'
let dragObject = null;       // object being dragged (may differ from selected)
let dragType = null;
let pointerStart = null;     // world coords at pointer down
let pointerDownOnObject = null;  // what was under pointer at down
let pointerDownType = null;
const DRAG_THRESHOLD = 3;
const HIT_RADIUS = 8;
const SOCKET_SNAP_RADIUS = 10;
// Selection highlight ring
let highlightMesh = null;
// Drop-target highlight (shown during drag at nearest socket)
let dropTargetMesh = null;
// --- Debug overlay ---
let debugEl = null;
let debugVisible = false;
let lastPointerEvent = 'none';
let lastWorldCoord = { x: 0, y: 0 };
let lastHitCount = 0;
function initInput(canvas) {
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') toggleDebug();
  });
  createHighlight();
  createDebugOverlay();
}
function createHighlight() {
  const geo = new THREE.RingGeometry(4, 4.6, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 });
  highlightMesh = new THREE.Mesh(geo, mat);
  highlightMesh.position.z = 0.5;
  highlightMesh.visible = false;
  getScene().add(highlightMesh);
  // Drop target: yellow-ish ring shown at nearest socket while dragging
  const geo2 = new THREE.RingGeometry(4.2, 4.8, 24);
  const mat2 = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 });
  dropTargetMesh = new THREE.Mesh(geo2, mat2);
  dropTargetMesh.position.z = 0.5;
  dropTargetMesh.visible = false;
  getScene().add(dropTargetMesh);
}
function showHighlight(obj) {
  const hx = FREE_PLACEMENT ? obj.freeX : SOCKET_POSITIONS[obj.socketIndex][0];
  const hy = FREE_PLACEMENT ? obj.freeY : SOCKET_POSITIONS[obj.socketIndex][1];
  highlightMesh.position.x = hx;
  highlightMesh.position.y = hy;
  highlightMesh.visible = true;
}
function hideHighlight() {
  highlightMesh.visible = false;
}
function selectObject(obj, type) {
  selectedObject = obj;
  selectedType = type;
  state = STATE_SELECTED;
  showHighlight(obj);
}
function deselect() {
  selectedObject = null;
  selectedType = null;
  state = STATE_IDLE;
  hideHighlight();
}
// --- Pointer handlers ---
function onPointerDown(e) {
  e.preventDefault();
  // If game over, any tap restarts
  if (isGameOver()) {
    handleRestartTap();
    return;
  }
  const world = screenToWorld(e.clientX, e.clientY);
  lastPointerEvent = `down@${e.clientX},${e.clientY}`;
  lastWorldCoord = world;
  pointerStart = world;
  const hit = findObjectAt(world.x, world.y);
  lastHitCount = hit ? 1 : 0;
  pointerDownOnObject = hit ? hit.object : null;
  pointerDownType = hit ? hit.type : null;
  updateDebug();
}
function onPointerMove(e) {
  e.preventDefault();
  const world = screenToWorld(e.clientX, e.clientY);
  lastPointerEvent = `move@${e.clientX},${e.clientY}`;
  lastWorldCoord = world;
  if (!pointerStart) { updateDebug(); return; }
  const dx = world.x - pointerStart.x;
  const dy = world.y - pointerStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // If we haven't committed to a gesture yet
  if (state === STATE_IDLE || state === STATE_SELECTED) {
    if (dist > DRAG_THRESHOLD) {
      // Pointer moved significantly
      if (pointerDownOnObject && pointerDownType === 'mirror' && pointerDownOnObject !== selectedObject) {
        startDrag(pointerDownOnObject, pointerDownType);
      } else if (pointerDownOnObject && pointerDownType === 'prism') {
        startDrag(pointerDownOnObject, pointerDownType);
      } else if (selectedObject && selectedType === 'mirror') {
        // Any swipe while a mirror is selected = rotate (including on the mirror itself)
        state = STATE_ROTATE;
      }
    }
  }
  if (state === STATE_DRAG && dragObject) {
    dragObject.mesh.position.x = world.x;
    dragObject.mesh.position.y = world.y;
    // Show drop target at nearest socket (visual guide)
    const nearest = findNearestSocket(world.x, world.y);
    if (nearest !== null) {
      const [sx, sy] = SOCKET_POSITIONS[nearest];
      dropTargetMesh.position.x = sx;
      dropTargetMesh.position.y = sy;
      dropTargetMesh.visible = true;
    } else {
      dropTargetMesh.visible = false;
    }
  } else if (state === STATE_ROTATE && selectedObject && selectedType === 'mirror') {
    // Rotation: pointer angle relative to mirror centre = mirror angle
    const mx = FREE_PLACEMENT ? selectedObject.freeX : SOCKET_POSITIONS[selectedObject.socketIndex][0];
    const my = FREE_PLACEMENT ? selectedObject.freeY : SOCKET_POSITIONS[selectedObject.socketIndex][1];
    const angle = Math.atan2(world.y - my, world.x - mx);
    rotateMirror(selectedObject, angle);
  }
  updateDebug();
}
function onPointerUp(e) {
  e.preventDefault();
  const world = screenToWorld(e.clientX, e.clientY);
  lastPointerEvent = `up@${e.clientX},${e.clientY}`;
  lastWorldCoord = world;
  if (state === STATE_DRAG && dragObject) {
    // Drop
    if (FREE_PLACEMENT && dragType === 'mirror') {
      moveMirrorFree(dragObject, world.x, world.y);
    } else {
      const nearest = findNearestSocket(world.x, world.y);
      if (nearest !== null && nearest !== dragObject.socketIndex) {
        if (dragType === 'mirror') {
          moveMirrorToSocket(dragObject, nearest);
        } else if (dragType === 'prism') {
          movePrismToSocket(dragObject, nearest);
        }
      } else {
        const [sx, sy] = SOCKET_POSITIONS[dragObject.socketIndex];
        dragObject.mesh.position.set(sx, sy, dragObject.mesh.position.z);
      }
    }
    dragObject = null;
    dragType = null;
    dropTargetMesh.visible = false;
    state = selectedObject ? STATE_SELECTED : STATE_IDLE;
  } else if (state === STATE_ROTATE) {
    // Rotation done, stay selected
    state = STATE_SELECTED;
  } else {
    // It was a tap (no drag, no rotate)
    const hit = findObjectAt(world.x, world.y);
    if (hit) {
      if (hit.object === selectedObject) {
        // Tap on already-selected → deselect
        deselect();
      } else {
        // Tap on a different object → select it
        selectObject(hit.object, hit.type);
      }
    } else {
      // Tap on empty space — check crafting tray first
      if (!handleCraftTap(world.x, world.y)) {
        deselect();
      }
    }
  }
  pointerStart = null;
  pointerDownOnObject = null;
  pointerDownType = null;
  updateDebug();
}
function startDrag(obj, type) {
  state = STATE_DRAG;
  dragObject = obj;
  dragType = type;
}
// --- Hit detection (world coords) ---
function findObjectAt(wx, wy) {
  const mirrors = getMirrors();
  const prisms = getPrisms();
  for (const mirror of mirrors) {
    if (mirror.shattered) continue;
    const mx = FREE_PLACEMENT ? mirror.freeX : SOCKET_POSITIONS[mirror.socketIndex][0];
    const my = FREE_PLACEMENT ? mirror.freeY : SOCKET_POSITIONS[mirror.socketIndex][1];
    const dist = Math.sqrt((wx - mx) ** 2 + (wy - my) ** 2);
    if (dist < HIT_RADIUS) {
      return { type: 'mirror', object: mirror };
    }
  }
  for (const prism of prisms) {
    const dist = Math.sqrt((wx - prism.position.x) ** 2 + (wy - prism.position.y) ** 2);
    if (dist < HIT_RADIUS) {
      return { type: 'prism', object: prism };
    }
  }
  return null;
}
function findNearestSocket(wx, wy) {
  let best = null;
  let bestDist = SOCKET_SNAP_RADIUS;
  for (let i = 0; i < SOCKET_POSITIONS.length; i++) {
    const [sx, sy] = SOCKET_POSITIONS[i];
    const dist = Math.sqrt((wx - sx) ** 2 + (wy - sy) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
// --- Debug overlay ---
function createDebugOverlay() {
  debugEl = document.createElement('div');
  debugEl.style.cssText =
    'position:fixed;top:0;left:0;padding:8px;background:rgba(0,0,0,0.8);' +
    'color:#0f0;font:12px monospace;pointer-events:none;z-index:9999;' +
    'white-space:pre;display:none;';
  document.body.appendChild(debugEl);
}
function toggleDebug() {
  debugVisible = !debugVisible;
  debugEl.style.display = debugVisible ? 'block' : 'none';
}
function updateDebug() {
  if (!debugVisible) return;
  const segs = getSegments();
  const totalSegs = segs.length;
  const colouredSegs = segs.filter(s => s.colour !== COLOUR_WHITE);
  const bandCount = colouredSegs.length;
  const diag = getBeamDiag();
  // Per-segment colour names
  const colourName = (c) => {
    if (c === 0xffffff) return 'WHT';
    if (c === 0xff8c1a) return 'AMB';
    if (c === 0x00ddff) return 'CYN';
    if (c === 0xffe9a0) return 'GLD';
    return '???';
  };
  const segList = segs.map((s, i) =>
    `  ${i}: ${colourName(s.colour)} (${s.start.x.toFixed(0)},${s.start.y.toFixed(0)})->(${s.end.x.toFixed(0)},${s.end.y.toFixed(0)})`
  ).join('\n');
  debugEl.textContent =
    `ptr: ${lastPointerEvent}\n` +
    `world: (${lastWorldCoord.x.toFixed(1)}, ${lastWorldCoord.y.toFixed(1)})\n` +
    `state: ${['IDLE','SEL','DRAG','ROTATE'][state]}\n` +
    `hit: ${lastHitCount} objects\n` +
    `selected: ${selectedType || 'none'}\n` +
    `segments: ${totalSegs} | bands: ${bandCount}\n` +
    `max bounces: ${diag.maxBouncesUsed} | cap hit: ${diag.hitBounceCap}\n` +
    `mote spd: ${ENEMY_TYPES.mote.speed.toFixed(1)} | travel: ${MOTE_TRAVEL_TIME_S}s (${ENEMY_TRAVEL_DIST.toFixed(0)}u)\n` +
    `spawns: ${getSpawnCount()} | kills: ${getKillCount()} | t: ${getElapsed().toFixed(0)}s\n` +
    segList;
  const _t = Math.max(getElapsed(), 1), _m = _t / 60;
  debugEl.textContent += `\nrate: ${(getSpawnCount()/_m).toFixed(1)}sp/m ${(getKillCount()/_m).toFixed(1)}k/m ${(getBreaches()/_m).toFixed(1)}br/m intv:${getCurrentInterval().toFixed(1)}s`;
  const iLog = getInsightLog();
  if (iLog.length > 0) debugEl.textContent += '\n--- Insight ---\n' + iLog.slice(-5).map(e => `${e.t} ${e.delta} =${e.total} [${e.reason}]`).join('\n');
}
// Called from main loop each frame so overlay stays current when visible
function tickDebug() {
  updateDebug();
}


// === src/main.js ===
// ============================================================
// src/main.js — Entry point: init scene, start game loop
// ============================================================

















// --- Source state ---
let sourceX = 0;
let sourceY = SUN_Y;

// --- Clock ---
let lastTime = 0;
const MAX_DT = 1 / 30;

function init() {
  console.log('[Solar Siege] init starting');
  initRenderer();
  initBackground();
  initSockets();
  initMirrors();
  updateAllMirrorGeometries();
  initPrisms();
  initBeamRenderer();
  initEnemies();
  initFoundries();
  initCrafting();
  initEffects();
  initSession();
  resetSpawner();

  const canvas = getRenderer().domElement;
  initInput(canvas);

  markDirty();

  lastTime = performance.now();
  requestAnimationFrame(loop);
  console.log('[Solar Siege] init complete, loop running');

  // DEV marker: visible red label if any dev flag is on
  if (Object.values(DEV).some(v => v)) {
    const devLabel = document.createElement('div');
    devLabel.textContent = 'DEV';
    devLabel.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);color:#ff0000;font:bold 14px monospace;z-index:99999;pointer-events:none;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:3px;';
    document.body.appendChild(devLabel);
  }
}

function loop(now) {
  requestAnimationFrame(loop);

  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > MAX_DT) dt = MAX_DT;

  if (isGameOver()) {
    updateHud(); // keep HUD visible on end screen
    render();
    return;
  }

  // --- Update ---
  updateSession(dt);
  const sessionTime = getElapsed();

  updateBackground(dt);
  updateBeamPulse(dt);
  updateMirrorTweens(dt);

  // Beam solve (only on dirty)
  if (isDirty()) {
    const mirrors = getMirrors().filter(m => !m.shattered);
    const prisms = getPrisms();
    const worldWidth = getWorldWidth();
    const fndColliders = getFoundryColliders();
    solve(sourceX, sourceY, mirrors, prisms, worldWidth, fndColliders);
    rebuildBeams(getSegments());
  } else {
    rebuildBeams(getSegments());
  }
  updatePrismGlow(getSegments());

  // Spawner + enemies
  updateSpawner(dt, sessionTime);
  applySlowStates();
  const newBreaches = updateEnemies(dt);
  if (newBreaches > 0) {
    addBreaches(newBreaches);
  }

  // Damage
  updateDamage(dt);

  // Effects (glows, sparks, debris)
  updateEffects(dt);

  // Foundries (resource accumulation)
  updateFoundries(dt);

  // HUD + crafting tray
  updateHud();
  updateCraftingTray();
  tickDebug();

  // --- Render ---
  render();
}

// Boot — called by intro layer after video ends (or skip)
// init();




