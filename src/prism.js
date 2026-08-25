// ============================================================
// src/prism.js — Prism: fixed infrastructure at (0, PRISM_Y)
// Not draggable. Splits the white sun beam into coloured bands.
// ============================================================

import { COLOUR_WHITE, DEFAULT_PRISM_TIER, PRISM_TIERS, PRISM_Y } from './config.js';
import { getScene } from './renderer.js';
import { markDirty } from './beam.js';

const prisms = [];
const PRISM_RADIUS = 2.5;
let activeTier = DEFAULT_PRISM_TIER;

export function getPrisms() { return prisms; }
export function getActiveTier() { return activeTier; }
export function getActiveTierData() { return PRISM_TIERS[activeTier]; }

export function setTier(newTier) {
  activeTier = newTier;
  markDirty();
}

export function resetTier() { activeTier = DEFAULT_PRISM_TIER; }

export function resetPrisms() {
  // Prism is fixed — just reset tier
  activeTier = DEFAULT_PRISM_TIER;
  markDirty();
}

export function initPrisms() {
  if (prisms.length > 0) return; // already placed, don't duplicate
  const scene = getScene();
  const x = 0;
  const y = PRISM_Y;

  const r = PRISM_RADIUS;
  const group = new THREE.Group();
  group.position.set(x, y, 0.2);

  // Diamond shape: 4 facet triangles
  const verts = [
    { x: 0, y: r },
    { x: r, y: 0 },
    { x: 0, y: -r },
    { x: -r, y: 0 },
  ];
  const facetColours = [0xddeeff, 0xbbddee, 0xaaccdd, 0xccddee];
  const bottomTints = [null, null, 0xffe9a0, 0xff8c1a];
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
      opacity: i >= 2 ? 0.7 : 0.85,
    });
    const facetMesh = new THREE.Mesh(geo, mat);
    facetMesh.position.z = 0.01 * i;
    group.add(facetMesh);
  }

  // Internal glow
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
    id: 0,
    position: { x: x, y: y },
    radius: PRISM_RADIUS,
    mesh: group,
    glowMat,
  };
  prisms.push(prism);
  markDirty();
}

// Update prism glow based on beam activity
export function updatePrismGlow(segments) {
  for (const prism of prisms) {
    if (!prism.glowMat) continue;
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
