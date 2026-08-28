// ============================================================
// src/mirror.js — Mirror objects, generic socket system, tweens
// ============================================================

import {
  SOCKET_POSITIONS, MIRROR_COUNT_START, MIRROR_MAX_HITS,
  COLOUR_GREY, DEFAULT_MIRROR_SOCKETS, MIRROR_LENGTH,
  FREE_PLACEMENT, MIRROR_FIELD_TOP, MIRROR_FIELD_BOT, MIRROR_MIN_Y,
  BATTLEMENT_TOP_Y, PRISM_Y
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';
import { markDirty } from './beam.js';

const sockets = [];
const mirrors = [];
let mirrorMeshGroup = null;

const MIRROR_THICKNESS = 1;
// Disc radius for the drag bounding box (half the mirror length ≈ the gold disc).
export const MIRROR_RADIUS = MIRROR_LENGTH / 2;
// px→world conversion for the spec offsets (world is 100u over ~780px portrait).
const PX = 100 / 780;

// Strict rectangular drag bounding box for a mirror centre. Shared by the live
// drag (input.js) and the drop commit (moveMirrorFree) so a disc can never be
// dragged off-stage, below the stone battlement, or up into the spawn area.
export function clampMirrorPos(x, y) {
  const hw = getWorldWidth() / 2;
  const minX = -hw + MIRROR_RADIUS;
  const maxX = hw - MIRROR_RADIUS;
  const minY = BATTLEMENT_TOP_Y + MIRROR_RADIUS + 10 * PX; // never below wall top
  const maxY = PRISM_Y - 150 * PX;                         // never into spawn area
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}
export function getMirrorFloorY() { return BATTLEMENT_TOP_Y + MIRROR_RADIUS; }

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
    // Default angles: flank mirrors horizontal (aim bands into ship lanes),
    // centre mirror vertical (needs player rotation to be useful)
    if (i === 1) {
      // Centre mirror (socket 4 at x=0): vertical, beam goes sideways
      mirror.angle = Math.PI / 2;
    } else {
      // Flank mirrors (sockets 3,5 at x=±15): horizontal, beam goes up
      mirror.angle = 0;
    }
    updateMirrorGeometry(mirror);
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
  const angle = 0; // default, overridden in initMirrors per-mirror

  // Draw mirror as bronze shield on wooden cart (canvas texture)
  const texSize = 64;
  const c = document.createElement('canvas');
  c.width = texSize; c.height = texSize;
  const ctx = c.getContext('2d');
  drawMirrorSprite(ctx, texSize);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.premultiplyAlpha = false;

  const spriteSize = MIRROR_LENGTH + 2; // slightly larger for the cart frame
  const geo = new THREE.PlaneGeometry(spriteSize, spriteSize);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sx, sy, 0);
  mesh.rotation.z = angle;
  mirrorMeshGroup.add(mesh);

  // Dynamic specular highlight: a soft additive glint sprite over the bronze
  // disc. As the disc rotates, the glint slides across its face (as if catching
  // a fixed overhead sun), and it flares brightest when the disc faces up.
  const hlCanvas = document.createElement('canvas');
  hlCanvas.width = 32; hlCanvas.height = 32;
  const hlCtx = hlCanvas.getContext('2d');
  const hlGrad = hlCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  hlGrad.addColorStop(0, 'rgba(255,250,230,0.95)');
  hlGrad.addColorStop(0.5, 'rgba(255,240,200,0.35)');
  hlGrad.addColorStop(1, 'rgba(255,240,200,0)');
  hlCtx.fillStyle = hlGrad; hlCtx.fillRect(0, 0, 32, 32);
  const hlTex = new THREE.CanvasTexture(hlCanvas);
  hlTex.minFilter = THREE.LinearFilter;
  const highlight = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({ map: hlTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  highlight.position.set(sx, sy, 0.05);
  mirrorMeshGroup.add(highlight);

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
    defaultX: sx,   // fallback slot for out-of-bounds recovery
    defaultY: sy,
    mesh,
    highlight,
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
    normal: { x: 0, y: 0 },
    length: MIRROR_LENGTH,
  };
}

// Add a new mirror at purchase — placed in the centre of mirror field, horizontal (angle=0)
export function addMirror() {
  const ww = getWorldWidth();
  // Find a free socket, or place freely in the mirror field
  let socketIdx = -1;
  for (let i = 0; i < sockets.length; i++) {
    if (sockets[i].type === null) { socketIdx = i; break; }
  }
  if (socketIdx < 0) socketIdx = 0; // fallback

  const mirror = createMirror(socketIdx);
  mirror.angle = 0; // horizontal — immediately useful (reflects beams upward)

  if (FREE_PLACEMENT) {
    // Place the new mirror at the emptiest spot in the field: scan a grid of
    // candidate positions and pick the one whose nearest existing mirror is
    // furthest away. This never drops a mirror onto an occupied coordinate and
    // spreads purchases across the width. The starting mirrors sit at
    // x=-15/0/+15 on y=-25; new ones prefer the lower row (-29, whose sprite
    // still stays inside the field, spanning -35..-23) and the width extremes.
    // The field is short, so with many mirrors some proximity is unavoidable —
    // but the chosen spot is always the most separated one available.
    const halfW = Math.min(ww / 2 - 6, 26);
    const rows = [-26, -14];  // prefer the lower row (listed first) on ties
    const STEPS = 13;
    let best = { x: 0, y: -26, score: -Infinity };
    for (const cy of rows) {
      for (let s = 0; s < STEPS; s++) {
        const cx = -halfW + (2 * halfW) * (s / (STEPS - 1));
        let nearest = Infinity;
        for (const m of mirrors) {
          const d = Math.hypot(cx - m.freeX, cy - m.freeY);
          if (d < nearest) nearest = d;
        }
        if (nearest > best.score) best = { x: cx, y: cy, score: nearest };
      }
    }
    mirror.freeX = best.x;
    mirror.freeY = best.y;
    mirror.defaultX = best.x; // recovery slot for a purchased mirror
    mirror.defaultY = best.y;
  }

  updateMirrorGeometry(mirror);
  mirrors.push(mirror);
  sockets[socketIdx].type = 'mirror';
  sockets[socketIdx].objectRef = mirror;
  markDirty();
  return mirror;
}

function drawMirrorSprite(ctx, sz) {
  const cx = sz / 2;
  const cy = sz / 2;
  ctx.clearRect(0, 0, sz, sz);

  // Wooden cart frame (horizontal bar behind the shield)
  ctx.fillStyle = '#3D2010';
  ctx.fillRect(cx - sz * 0.42, cy - 2, sz * 0.84, 4);

  // Wheels (small circles at ends)
  ctx.fillStyle = '#2A1500';
  ctx.beginPath();
  ctx.arc(cx - sz * 0.38, cy + 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + sz * 0.38, cy + 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Wheel spokes
  ctx.strokeStyle = '#5C3D2E';
  ctx.lineWidth = 0.8;
  for (let w = -1; w <= 1; w += 2) {
    const wx = cx + w * sz * 0.38;
    const wy = cy + 3;
    ctx.beginPath(); ctx.moveTo(wx - 2, wy); ctx.lineTo(wx + 2, wy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, wy - 2); ctx.lineTo(wx, wy + 2); ctx.stroke();
  }

  // Bronze polished shield face (large ellipse — wider than tall since mirror is oriented horizontally)
  const shieldRx = sz * 0.32;
  const shieldRy = sz * 0.28;
  // Metallic gradient
  const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, shieldRx);
  grad.addColorStop(0, '#E8C87A');   // bright highlight
  grad.addColorStop(0.3, '#CC9944'); // polished bronze
  grad.addColorStop(0.7, '#996633'); // darker bronze
  grad.addColorStop(1, '#664422');   // rim shadow
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, shieldRx, shieldRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shield rim ring
  ctx.strokeStyle = '#553311';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, shieldRx, shieldRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Centre boss (raised bump)
  ctx.fillStyle = '#DDAA55';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#AA7733';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function updateMirrorGeometry(mirror) {
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

  // Specular glint: slides along the disc's surface normal and flares brightest
  // when the normal faces up toward a virtual overhead sun (normal.y -> 1).
  if (mirror.highlight) {
    const nx = mirror.normal.x, ny = mirror.normal.y;
    const off = 1.6; // how far along the normal the glint sits
    mirror.highlight.position.set(sx + nx * off, sy + ny * off, 0.05);
    // Brightness peaks when the polished face tilts toward the sun (ny high).
    const facing = Math.max(0, ny);              // 0..1
    mirror.highlight.material.opacity = 0.2 + 0.65 * facing;
  }
}

// Free placement: move mirror to position, clamped to mirror field
export function moveMirrorFree(mirror, x, y) {
  const p = clampMirrorPos(x, y);
  mirror.freeX = p.x;
  mirror.freeY = p.y;
  updateMirrorGeometry(mirror);
  markDirty();
}

// Per-frame safety net: if any mirror has somehow ended up below the wall floor
// (a lost/out-of-bounds disc), snap it back to its default altar slot so it can
// never be permanently lost off-screen. Returns true if it recovered any mirror.
export function sanitizeMirrors() {
  const floor = getMirrorFloorY();
  let recovered = false;
  for (const m of mirrors) {
    if (m.freeY < floor || m.freeY == null || m.freeX == null || isNaN(m.freeY) || isNaN(m.freeX)) {
      m.freeX = (m.defaultX != null) ? m.defaultX : 0;
      m.freeY = (m.defaultY != null) ? m.defaultY : MIRROR_FIELD_TOP;
      if (m.mesh) m.mesh.position.set(m.freeX, m.freeY, m.mesh.position.z);
      updateMirrorGeometry(m);
      recovered = true;
    }
  }
  if (recovered) markDirty();
  return recovered;
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
    // Keep the specular glint tracking the disc during the tween.
    if (tw.mirror.highlight) {
      tw.mirror.highlight.position.set(x + (-sin) * 1.6, y + cos * 1.6, 0.05);
    }

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

// Reset all mirrors to default positions, angles, and states.
// Destroys every mirror (including ones bought during the run) and rebuilds
// the starting set, so nothing purchased survives a restart.
export function resetMirrors() {
  // Tear down all existing mirror meshes and clear socket occupancy
  for (let i = 0; i < mirrors.length; i++) {
    const m = mirrors[i];
    if (m.mesh) {
      if (mirrorMeshGroup) mirrorMeshGroup.remove(m.mesh);
      if (m.mesh.geometry) m.mesh.geometry.dispose();
      if (m.mesh.material) {
        if (m.mesh.material.map) m.mesh.material.map.dispose();
        m.mesh.material.dispose();
      }
    }
    // Also tear down the specular highlight sprite.
    if (m.highlight) {
      if (mirrorMeshGroup) mirrorMeshGroup.remove(m.highlight);
      if (m.highlight.geometry) m.highlight.geometry.dispose();
      if (m.highlight.material) {
        if (m.highlight.material.map) m.highlight.material.map.dispose();
        m.highlight.material.dispose();
      }
    }
  }
  mirrors.length = 0;
  tweens.length = 0;
  for (let i = 0; i < sockets.length; i++) {
    sockets[i].type = null;
    sockets[i].objectRef = null;
  }

  // Rebuild the starting mirrors (mirrors default state, same as initMirrors)
  for (let i = 0; i < MIRROR_COUNT_START; i++) {
    const socketIdx = DEFAULT_MIRROR_SOCKETS[i];
    const mirror = createMirror(socketIdx);
    mirror.angle = (i === 1) ? Math.PI / 2 : 0; // centre vertical, flanks horizontal
    updateMirrorGeometry(mirror);
    mirrors.push(mirror);
    sockets[socketIdx].type = 'mirror';
    sockets[socketIdx].objectRef = mirror;
  }
  markDirty();
}
