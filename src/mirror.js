// ============================================================
// src/mirror.js — Mirror objects, generic socket system, tweens
// ============================================================

import {
  SOCKET_POSITIONS, MIRROR_COUNT_START, MIRROR_MAX_HITS,
  COLOUR_GREY, DEFAULT_MIRROR_SOCKETS, MIRROR_TWEEN_MS
} from './config.js';
import { getScene } from './renderer.js';
import { markDirty } from './beam.js';

const sockets = [];
const mirrors = [];
let mirrorMeshGroup = null;

const MIRROR_LENGTH = 8;
const MIRROR_THICKNESS = 1;

// Active tweens: { mirror, fromX, fromY, toX, toY, elapsed, duration }
const tweens = [];

export function initSockets() {
  sockets.length = 0;
  for (let i = 0; i < SOCKET_POSITIONS.length; i++) {
    sockets.push({ type: null, objectRef: null });
  }
}

export function getSockets() { return sockets; }
export function getSocketPositions() { return SOCKET_POSITIONS; }
export function getMirrors() { return mirrors; }

export function initMirrors() {
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
    mesh,
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
    normal: { x: 0, y: 0 },
    length: MIRROR_LENGTH,
  };
}

export function updateMirrorGeometry(mirror) {
  const [sx, sy] = SOCKET_POSITIONS[mirror.socketIndex];
  const halfLen = mirror.length / 2;
  const cos = Math.cos(mirror.angle);
  const sin = Math.sin(mirror.angle);

  mirror.p1 = { x: sx - halfLen * cos, y: sy - halfLen * sin };
  mirror.p2 = { x: sx + halfLen * cos, y: sy + halfLen * sin };
  mirror.normal = { x: -sin, y: cos };

  mirror.mesh.position.set(sx, sy, 0);
  mirror.mesh.rotation.z = mirror.angle;
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
export function updateMirrorTweens(dt) {
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
export function moveMirrorToSocket(mirror, newSocketIndex) {
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

export function rotateMirror(mirror, newAngle) {
  mirror.angle = newAngle;
  updateMirrorGeometry(mirror);
  markDirty();
}

export function damageMirror(mirror) {
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

export function repairMirror(mirror) {
  mirror.hits = 0;
  mirror.shattered = false;
  mirror.mesh.material.color.setHex(0x8888cc);
  mirror.mesh.material.opacity = 1.0;
  mirror.mesh.material.transparent = false;
  markDirty();
}

export function updateAllMirrorGeometries() {
  for (const mirror of mirrors) {
    updateMirrorGeometry(mirror);
  }
}
