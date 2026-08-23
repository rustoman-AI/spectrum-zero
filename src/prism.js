// ============================================================
// src/prism.js — Prism object, uses generic socket grid
// ============================================================

import { SOCKET_POSITIONS, COLOUR_WHITE, DEFAULT_PRISM_SOCKET } from './config.js';
import { getScene } from './renderer.js';
import { markDirty } from './beam.js';
import { getSockets, updateMirrorGeometry } from './mirror.js';

const prisms = [];
const PRISM_RADIUS = 2.5; // hit radius for beam intersection

export function getPrisms() { return prisms; }

// Reset prisms to initial state (remove craft-purchased ones, keep default)
export function resetPrisms() {
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

export function initPrisms() {
  prisms.length = 0;
  // Place prism in default socket — directly below aperture
  placePrism(DEFAULT_PRISM_SOCKET);
}

export function placePrism(socketIndex) {
  const scene = getScene();
  const sockets = getSockets();
  const [sx, sy] = SOCKET_POSITIONS[socketIndex];

  // Visible equilateral triangle, point-up
  const shape = new THREE.Shape();
  const r = PRISM_RADIUS;
  shape.moveTo(0, r);
  shape.lineTo(-r * 0.866, -r * 0.5);
  shape.lineTo(r * 0.866, -r * 0.5);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xeeeeff,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sx, sy, 0.2);
  scene.add(mesh);

  const prism = {
    id: prisms.length,
    socketIndex,
    position: { x: sx, y: sy },
    radius: PRISM_RADIUS,
    mesh,
  };

  prisms.push(prism);
  sockets[socketIndex].type = 'prism';
  sockets[socketIndex].objectRef = prism;

  markDirty();
  return prism;
}

// Move prism to a new socket (swap if occupied)
export function movePrismToSocket(prism, newSocketIndex) {
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
