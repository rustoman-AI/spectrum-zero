// ============================================================
// src/input.js — Multi-pointer mirror rotation + single-finger tap/drag
//
// Each pointer (finger) independently grabs and rotates one mirror.
// Distance-aware sensitivity: angleDelta = (tangential * K) / max(L, L_MIN)
// Angular velocity smoothing + speed clamp, frame-rate independent.
// ============================================================
import { SOCKET_POSITIONS, FREE_PLACEMENT } from './config.js';
import { screenToWorld, getScene } from './renderer.js';
import { getMirrors, moveMirrorToSocket, rotateMirror, getSockets, updateMirrorGeometry, moveMirrorFree } from './mirror.js';
import { getSegments, getBeamDiag } from './beam.js';
import { isGameOver, handleRestartTap, getElapsed, getBreaches } from './session.js';
import { handleCraftTap } from './crafting.js';
import { getSpawnCount, getCurrentInterval } from './enemy-spawner.js';
import { getKillCount } from './damage.js';
import { getInsightLog } from './foundry.js';

// --- Constants ---
const DRAG_THRESHOLD = 3;
const HIT_RADIUS = 8;
const SOCKET_SNAP_RADIUS = 10;

// Distance-aware rotation
const ROT_K = 1.8;
const ROT_L_MIN = 15;
const ROT_LERP_RATE = 0.20;   // 20% per frame toward target (at 60fps baseline)
const ROT_MAX_SPEED = 2.5;    // max rad/s

// --- Per-pointer state ---
// Each active pointer gets an entry: { state, mirror, targetAngle, prevWorld, startWorld, startedOnMirror }
const PSTATE_IDLE = 0;
const PSTATE_PENDING = 1;    // down, waiting to see if it's a tap or drag/rotate
const PSTATE_ROTATE = 2;
const PSTATE_DRAG = 3;

const pointers = new Map();  // pointerId → pointer state object

// Track which mirrors are currently owned (grabbed) by a pointer
function mirrorIsOwned(mirror) {
  for (const ps of pointers.values()) {
    if (ps.mirror === mirror && (ps.state === PSTATE_ROTATE || ps.state === PSTATE_DRAG)) return true;
  }
  return false;
}

// --- Highlight ring pool (supports 2 simultaneous) ---
const MAX_HIGHLIGHTS = 2;
const highlightMeshes = [];
let dropTargetMesh = null;

// --- Canvas ref ---
let canvasEl = null;

// --- Debug ---
let debugEl = null;
let debugVisible = false;

export function initInput(canvas) {
  canvasEl = canvas;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
  canvas.addEventListener('lostpointercapture', onPointerUp, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') toggleDebug();
  });
  createHighlights();
  createDebugOverlay();
}

function createHighlights() {
  const scene = getScene();
  for (let i = 0; i < MAX_HIGHLIGHTS; i++) {
    const geo = new THREE.RingGeometry(4, 4.6, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = 0.5;
    mesh.visible = false;
    scene.add(mesh);
    highlightMeshes.push(mesh);
  }
  // Drop target for drag
  const geo2 = new THREE.RingGeometry(4.2, 4.8, 24);
  const mat2 = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 });
  dropTargetMesh = new THREE.Mesh(geo2, mat2);
  dropTargetMesh.position.z = 0.5;
  dropTargetMesh.visible = false;
  scene.add(dropTargetMesh);
}

function updateHighlights() {
  // Hide all first
  for (const h of highlightMeshes) h.visible = false;
  // Show one per active rotating/dragging pointer
  let idx = 0;
  for (const ps of pointers.values()) {
    if (ps.mirror && (ps.state === PSTATE_ROTATE || ps.state === PSTATE_DRAG) && idx < MAX_HIGHLIGHTS) {
      const m = ps.mirror;
      const mx = FREE_PLACEMENT ? m.freeX : SOCKET_POSITIONS[m.socketIndex][0];
      const my = FREE_PLACEMENT ? m.freeY : SOCKET_POSITIONS[m.socketIndex][1];
      highlightMeshes[idx].position.x = mx;
      highlightMeshes[idx].position.y = my;
      highlightMeshes[idx].visible = true;
      idx++;
    }
  }
}

// --- Pointer handlers ---

function onPointerDown(e) {
  e.preventDefault();
  const id = e.pointerId;

  // Game over: any tap restarts
  if (isGameOver()) {
    handleRestartTap();
    return;
  }

  // Capture this pointer
  try { canvasEl.setPointerCapture(id); } catch (_) {}

  const world = screenToWorld(e.clientX, e.clientY);
  const hit = findMirrorAt(world.x, world.y);

  let mirror = null;
  if (hit && !mirrorIsOwned(hit)) {
    mirror = hit;
  }

  pointers.set(id, {
    state: PSTATE_PENDING,
    mirror: mirror,
    targetAngle: mirror ? mirror.angle : 0,
    prevWorld: { x: world.x, y: world.y },
    startWorld: { x: world.x, y: world.y },
    startedOnMirror: !!mirror,
  });
}

function onPointerMove(e) {
  e.preventDefault();
  const id = e.pointerId;
  const ps = pointers.get(id);
  if (!ps) return;

  const world = screenToWorld(e.clientX, e.clientY);

  if (ps.state === PSTATE_PENDING) {
    // Check if moved past threshold → commit to rotate or drag
    const dx = world.x - ps.startWorld.x;
    const dy = world.y - ps.startWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > DRAG_THRESHOLD) {
      if (ps.mirror) {
        if (FREE_PLACEMENT && ps.startedOnMirror) {
          ps.state = PSTATE_DRAG;
        } else {
          ps.state = PSTATE_ROTATE;
          ps.targetAngle = ps.mirror.angle;
          ps.prevWorld = { x: world.x, y: world.y };
        }
      } else {
        // Swiped on empty — check if there's a non-owned mirror nearby to grab
        const hit = findMirrorAt(world.x, world.y);
        if (hit && !mirrorIsOwned(hit)) {
          ps.mirror = hit;
          ps.state = PSTATE_ROTATE;
          ps.targetAngle = hit.angle;
          ps.prevWorld = { x: world.x, y: world.y };
        }
        // else: stray swipe, ignore
      }
    }
    updateHighlights();
    return;
  }

  if (ps.state === PSTATE_ROTATE && ps.mirror) {
    // Distance-aware rotation
    const mirror = ps.mirror;
    const mx = FREE_PLACEMENT ? mirror.freeX : SOCKET_POSITIONS[mirror.socketIndex][0];
    const my = FREE_PLACEMENT ? mirror.freeY : SOCKET_POSITIONS[mirror.socketIndex][1];

    const pdx = world.x - ps.prevWorld.x;
    const pdy = world.y - ps.prevWorld.y;
    const toPointerX = world.x - mx;
    const toPointerY = world.y - my;
    const toPointerLen = Math.sqrt(toPointerX * toPointerX + toPointerY * toPointerY);

    if (toPointerLen > 0.1) {
      const tangential = (toPointerX * pdy - toPointerY * pdx) / toPointerLen;
      const L = getReflectedBeamLength(mirror);
      const angleDelta = (tangential * ROT_K) / Math.max(L, ROT_L_MIN);
      ps.targetAngle += angleDelta;
    }
    ps.prevWorld = { x: world.x, y: world.y };
  }

  if (ps.state === PSTATE_DRAG && ps.mirror) {
    ps.mirror.mesh.position.x = world.x;
    ps.mirror.mesh.position.y = world.y;
    const nearest = findNearestSocket(world.x, world.y);
    if (nearest !== null) {
      const [sx, sy] = SOCKET_POSITIONS[nearest];
      dropTargetMesh.position.x = sx;
      dropTargetMesh.position.y = sy;
      dropTargetMesh.visible = true;
    } else {
      dropTargetMesh.visible = false;
    }
  }

  updateHighlights();
}

function onPointerUp(e) {
  e.preventDefault();
  const id = e.pointerId;
  const ps = pointers.get(id);

  // Release capture
  try { canvasEl.releasePointerCapture(id); } catch (_) {}

  if (!ps) { pointers.delete(id); return; }

  if (ps.state === PSTATE_PENDING) {
    // Was a tap (no drag/rotate threshold crossed)
    const world = screenToWorld(e.clientX, e.clientY);
    if (!handleCraftTap(world.x, world.y)) {
      // Tap did nothing in craft tray — could be used for future tap-to-select
    }
  } else if (ps.state === PSTATE_ROTATE && ps.mirror) {
    // Snap to final target on release
    rotateMirror(ps.mirror, ps.targetAngle);
  } else if (ps.state === PSTATE_DRAG && ps.mirror) {
    const world = screenToWorld(e.clientX, e.clientY);
    if (FREE_PLACEMENT) {
      moveMirrorFree(ps.mirror, world.x, world.y);
    } else {
      const nearest = findNearestSocket(world.x, world.y);
      if (nearest !== null && nearest !== ps.mirror.socketIndex) {
        moveMirrorToSocket(ps.mirror, nearest);
      } else {
        const [sx, sy] = SOCKET_POSITIONS[ps.mirror.socketIndex];
        ps.mirror.mesh.position.set(sx, sy, ps.mirror.mesh.position.z);
      }
    }
    dropTargetMesh.visible = false;
  }

  pointers.delete(id);
  updateHighlights();
}

// --- Per-frame smoothing (called from main loop) ---
export function tickDebug(dt) {
  updateAllRotationSmoothing(dt);
  updateDebug();
}

function updateAllRotationSmoothing(dt) {
  if (!dt || dt <= 0) dt = 1 / 60;
  for (const ps of pointers.values()) {
    if (ps.state !== PSTATE_ROTATE || !ps.mirror) continue;
    const mirror = ps.mirror;

    let diff = ps.targetAngle - mirror.angle;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // Frame-rate independent lerp
    const lerpFactor = 1 - Math.pow(1 - ROT_LERP_RATE, dt * 60);
    let step = diff * lerpFactor;

    // Clamp angular speed
    const maxStep = ROT_MAX_SPEED * dt;
    if (Math.abs(step) > maxStep) step = Math.sign(step) * maxStep;

    if (Math.abs(diff) > 0.001) {
      rotateMirror(mirror, mirror.angle + step);
    }
  }
}

// --- Helpers ---

function getReflectedBeamLength(mirror) {
  const segments = getSegments();
  const mx = FREE_PLACEMENT ? mirror.freeX : SOCKET_POSITIONS[mirror.socketIndex][0];
  const my = FREE_PLACEMENT ? mirror.freeY : SOCKET_POSITIONS[mirror.socketIndex][1];
  const SNAP_DIST = 5;
  let maxLen = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const sdx = seg.start.x - mx;
    const sdy = seg.start.y - my;
    if (sdx * sdx + sdy * sdy < SNAP_DIST * SNAP_DIST) {
      const edx = seg.end.x - seg.start.x;
      const edy = seg.end.y - seg.start.y;
      const len = Math.sqrt(edx * edx + edy * edy);
      if (len > maxLen) maxLen = len;
    }
  }
  return maxLen > 0 ? maxLen : 50;
}

function findMirrorAt(wx, wy) {
  const mirrors = getMirrors();
  for (const mirror of mirrors) {
    if (mirror.shattered) continue;
    const mx = FREE_PLACEMENT ? mirror.freeX : SOCKET_POSITIONS[mirror.socketIndex][0];
    const my = FREE_PLACEMENT ? mirror.freeY : SOCKET_POSITIONS[mirror.socketIndex][1];
    const dist = Math.sqrt((wx - mx) ** 2 + (wy - my) ** 2);
    if (dist < HIT_RADIUS) return mirror;
  }
  return null;
}

function findNearestSocket(wx, wy) {
  let best = null;
  let bestDist = SOCKET_SNAP_RADIUS;
  for (let i = 0; i < SOCKET_POSITIONS.length; i++) {
    const [sx, sy] = SOCKET_POSITIONS[i];
    const dist = Math.sqrt((wx - sx) ** 2 + (wy - sy) ** 2);
    if (dist < bestDist) { bestDist = dist; best = i; }
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
  const diag = getBeamDiag();
  const activePointers = pointers.size;
  const rotatingCount = [...pointers.values()].filter(p => p.state === PSTATE_ROTATE).length;

  debugEl.textContent =
    `pointers: ${activePointers} | rotating: ${rotatingCount}\n` +
    `segments: ${segs.length} | maxBounce: ${diag.maxBouncesUsed} | capHit: ${diag.hitBounceCap}\n` +
    `spawns: ${getSpawnCount()} | kills: ${getKillCount()} | t: ${getElapsed().toFixed(0)}s\n` +
    `breaches: ${getBreaches()} | interval: ${getCurrentInterval().toFixed(1)}s`;
}
