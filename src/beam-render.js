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

import {
  BEAM_WIDTH, BEAM_GLOW_WIDTH, BEAM_SEGMENT_POOL_SIZE,
  COLOUR_GOLD, WORLD_HEIGHT
} from './config.js';
import { getScene } from './renderer.js';

const meshes = [];      // { core: Mesh, glow: Mesh }
let poolReady = false;
let pulseTime = 0;

// Gold is rendered at 60% width of other bands to be visually distinct
const GOLD_WIDTH_FACTOR = 0.6;

export function initBeamRenderer() {
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

export function updateBeamPulse(dt) {
  pulseTime += dt;
}

export function rebuildBeams(segments) {
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

      // Active/idle visual tiers: beams contacting a ship/prism/altar stay at
      // full opacity + width with an intense core glow; idle reflected beams
      // drop to 25% with a thinner stroke so active damage lines stand out.
      const isActive = seg.active !== false; // undefined (older segs) treated active
      const tierOpacity = isActive ? 1.0 : 0.25;
      const tierWidth = isActive ? 1.0 : 0.5;
      const glowBoost = isActive ? 1.5 : 0.35; // intense core glow on active beams
      // High-tier focused rays (5/6-prism) render with a fatter core so the
      // tightened band cluster reads as a few substantial rays, not thin noodles.
      const wideMult = seg.wide ? 1.6 : 1.0;

      const coreW = BEAM_WIDTH * widthMult * tierWidth * wideMult;
      const glowW = BEAM_GLOW_WIDTH * widthMult * tierWidth * wideMult * (isActive ? 1.2 : 1.0);

      // Edge fade: reduce opacity if segment ends near world boundary
      const hh = WORLD_HEIGHT / 2;
      const edgeMargin = 4; // fade starts this many units from edge
      const endDistFromEdge = Math.min(
        Math.abs(seg.end.x) < 28 ? 99 : 28 - Math.abs(seg.end.x) + edgeMargin,
        hh - Math.abs(seg.end.y) + edgeMargin
      );
      const edgeFade = Math.min(1, Math.max(0.1, endDistFromEdge / edgeMargin));
      const finalOpacity = opacityMult * edgeFade * tierOpacity;

      positionQuad(entry.core, seg.start, seg.end, coreW);
      positionQuad(entry.glow, seg.start, seg.end, glowW);
      setQuadColour(entry.core, seg.colour, seg.intensity * finalOpacity);
      setQuadColour(entry.glow, seg.colour, seg.intensity * glowBoost * finalOpacity);
      entry.core.visible = true;
      entry.glow.visible = true;
    } else {
      entry.core.visible = false;
      entry.glow.visible = false;
    }
  }
}

// Soft cross-beam gradient texture: bright down the centre line, fading to
// transparent at the top/bottom edges (across the beam WIDTH, which is the
// quad's local Y after scaling). Gives beams a luminous concentrated-sunbeam
// look with soft edge falloff instead of a flat solid bar. Length axis (X) is
// uniform so the beam reads continuous end-to-end.
let beamTexture = null;
function getBeamTexture() {
  if (beamTexture) return beamTexture;
  const h = 64, w = 8;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // Vertical gradient (across width): centre bright -> edges transparent.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.32, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.68, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  beamTexture = new THREE.CanvasTexture(c);
  beamTexture.minFilter = THREE.LinearFilter;
  beamTexture.magFilter = THREE.LinearFilter;
  return beamTexture;
}

function createQuadMesh(opacity) {
  const geo = new THREE.PlaneGeometry(1, 1);
  // The plane's local Y (UV v) is the beam-width axis, so the vertical texture
  // gradient produces the across-beam edge falloff; length (X) stays uniform.
  const mat = new THREE.MeshBasicMaterial({
    map: getBeamTexture(),
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
export function setBeamsVisible(visible) {
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
