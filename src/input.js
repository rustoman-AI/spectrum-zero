// ============================================================
// src/input.js — Pointer events, drag/rotate, debug overlay
// ============================================================
import { SOCKET_POSITIONS, COLOUR_WHITE, ROTATION_SENSITIVITY, MOTE_TRAVEL_TIME_S, ENEMY_TRAVEL_DIST, ENEMY_TYPES, FREE_PLACEMENT } from './config.js';
import { screenToWorld, getScene } from './renderer.js';
import { getMirrors, moveMirrorToSocket, rotateMirror, getSockets, updateMirrorGeometry, moveMirrorFree } from './mirror.js';
import { getSegments, getBeamDiag } from './beam.js';
import { isGameOver, handleRestartTap, getElapsed, getBreaches } from './session.js';
import { handleCraftTap } from './crafting.js';
import { getSpawnCount, getCurrentInterval } from './enemy-spawner.js';
import { getKillCount } from './damage.js';
import { getInsightLog } from './foundry.js';
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
let prevPointerWorld = null;  // previous frame's pointer world coords (for delta)
let targetAngle = 0;          // smoothed rotation target
const DRAG_THRESHOLD = 3;
const HIT_RADIUS = 8;
const SOCKET_SNAP_RADIUS = 10;

// --- Distance-aware rotation constants ---
const ROT_K = 1.8;           // tuning constant: controls overall sensitivity
const ROT_L_MIN = 15;        // minimum beam length (prevents explosive rotation on short beams)
const ROT_LERP_RATE = 0.20;  // 20% per frame toward target (at 60fps)
const ROT_MAX_SPEED = 2.5;   // max radians/second angular speed
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
export function initInput(canvas) {
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
      } else if (selectedObject && selectedType === 'mirror') {
        // Any swipe while a mirror is selected = rotate (including on the mirror itself)
        state = STATE_ROTATE;
        targetAngle = selectedObject.angle; // start from current angle
        prevPointerWorld = { x: world.x, y: world.y };
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
    // Distance-aware rotation: angleDelta = (pointerDelta * K) / max(L, L_MIN)
    if (prevPointerWorld) {
      const pdx = world.x - prevPointerWorld.x;
      const pdy = world.y - prevPointerWorld.y;
      // Use tangential component of pointer movement (perpendicular to mirror→pointer line)
      const mx = FREE_PLACEMENT ? selectedObject.freeX : SOCKET_POSITIONS[selectedObject.socketIndex][0];
      const my = FREE_PLACEMENT ? selectedObject.freeY : SOCKET_POSITIONS[selectedObject.socketIndex][1];
      const toPointerX = world.x - mx;
      const toPointerY = world.y - my;
      const toPointerLen = Math.sqrt(toPointerX * toPointerX + toPointerY * toPointerY);
      if (toPointerLen > 0.1) {
        // Tangential component: cross product of (toPointer_normalized, pointerDelta)
        const tangential = (toPointerX * pdy - toPointerY * pdx) / toPointerLen;
        // Get reflected beam length from this mirror
        const L = getReflectedBeamLength(selectedObject);
        const angleDelta = (tangential * ROT_K) / Math.max(L, ROT_L_MIN);
        targetAngle += angleDelta;
      }
    }
    prevPointerWorld = { x: world.x, y: world.y };
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
    // Rotation done, stay selected. Snap to final target.
    if (selectedObject) rotateMirror(selectedObject, targetAngle);
    prevPointerWorld = null;
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
  for (const mirror of mirrors) {
    if (mirror.shattered) continue;
    const mx = FREE_PLACEMENT ? mirror.freeX : SOCKET_POSITIONS[mirror.socketIndex][0];
    const my = FREE_PLACEMENT ? mirror.freeY : SOCKET_POSITIONS[mirror.socketIndex][1];
    const dist = Math.sqrt((wx - mx) ** 2 + (wy - my) ** 2);
    if (dist < HIT_RADIUS) {
      return { type: 'mirror', object: mirror };
    }
  }
  // Prism is fixed infrastructure — not selectable
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
export function tickDebug(dt) {
  updateRotationSmoothing(dt);
  updateDebug();
}

// --- Distance-aware rotation helpers ---

// Get the length of the reflected beam leaving this mirror (longest segment originating from it)
function getReflectedBeamLength(mirror) {
  const segments = getSegments();
  const mx = FREE_PLACEMENT ? mirror.freeX : SOCKET_POSITIONS[mirror.socketIndex][0];
  const my = FREE_PLACEMENT ? mirror.freeY : SOCKET_POSITIONS[mirror.socketIndex][1];
  const SNAP_DIST = 5; // how close a segment start must be to count as "from this mirror"
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
  return maxLen > 0 ? maxLen : 50; // fallback: mid-range if no segment found
}

// Lerp mirror angle toward targetAngle each frame, clamped by max angular speed
function updateRotationSmoothing(dt) {
  if (state !== STATE_ROTATE || !selectedObject || selectedType !== 'mirror') return;
  if (!dt || dt <= 0) dt = 1 / 60;

  let diff = targetAngle - selectedObject.angle;
  // Normalize diff to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  // Frame-rate independent lerp: 1 - (1-rate)^(dt*60)
  const lerpFactor = 1 - Math.pow(1 - ROT_LERP_RATE, dt * 60);
  let step = diff * lerpFactor;

  // Clamp angular speed
  const maxStep = ROT_MAX_SPEED * dt;
  if (Math.abs(step) > maxStep) {
    step = Math.sign(step) * maxStep;
  }

  if (Math.abs(diff) > 0.001) {
    rotateMirror(selectedObject, selectedObject.angle + step);
  }
}
