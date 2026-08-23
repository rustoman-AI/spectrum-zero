// ============================================================
// src/prism.js — Prism object, uses generic socket grid
// ============================================================

import { SOCKET_POSITIONS, COLOUR_WHITE, DEFAULT_PRISM_SOCKET, DEFAULT_PRISM_TIER, PRISM_TIERS, PRISM_Y } from './config.js';
import { getScene } from './renderer.js';
import { markDirty } from './beam.js';
import { getSockets, updateMirrorGeometry } from './mirror.js';

const prisms = [];
const PRISM_RADIUS = 2.5;
let activeTier = DEFAULT_PRISM_TIER;

export function getPrisms() { return prisms; }
export function getActiveTier() { return activeTier; }
export function getActiveTierData() { return PRISM_TIERS[activeTier]; }

export function setTier(newTier) {
  activeTier = newTier;
  markDirty(); // beam re-solves with new band count
}

export function resetTier() { activeTier = DEFAULT_PRISM_TIER; }

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

// Update prism glow based on beam activity (call from main loop)
export function updatePrismGlow(segments) {
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
