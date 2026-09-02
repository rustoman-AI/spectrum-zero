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

  // Draw mirror as an elongated bronze shield (canvas texture). Higher-res than
  // the old disc so the lengthwise specular streak, rim, and end rivets stay
  // crisp when the sprite is scaled up on screen.
  const texSize = 128;
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

  // Dynamic sun-catch glint: a soft additive glow sitting ON the shield face
  // that brightens when the polished surface tilts up toward the overhead sun.
  // The orientation cue comes from the elongated shape + baked lengthwise
  // streak; this glint just adds a live "catches the light" flare so the
  // surface reads as a real reflector. Kept centred on the face (not floating
  // off to the side) so it stays married to the narrow shield at every angle.
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
    new THREE.PlaneGeometry(4.5, 2.2), // wide, low — hugs the elongated face
    new THREE.MeshBasicMaterial({ map: hlTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
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

// Draw an elongated bronze shield mirror seen at an angle. The whole thing is
// drawn LONG along the local X axis (which is the mirror's reflecting line,
// p1->p2), so when the mesh rotates by mirror.angle the elongation + lengthwise
// specular streak rotate with it — the tilt is readable at a glance, unlike the
// old near-circular disc. Layers, back to front: wooden backing frame, then the
// long oval bronze face with a darker rim, a bright specular highlight running
// the length of the face, and forged rivets at each end.
function drawMirrorSprite(ctx, sz) {
  const cx = sz / 2;
  const cy = sz / 2;
  ctx.clearRect(0, 0, sz, sz);

  // Long/short half-extents of the shield face. Clearly wider than tall
  // (~2.6:1) so orientation is unmistakable at any angle.
  const rx = sz * 0.40;   // half-length along local X (the reflecting line)
  const ry = sz * 0.155;  // half-height across it

  // --- Wooden backing frame (a plank a touch longer + taller than the face) ---
  const fx = rx + sz * 0.05;
  const fy = ry + sz * 0.055;
  ctx.save();
  ctx.translate(cx, cy);
  // Plank body with rounded ends.
  ctx.fillStyle = '#3a2412';
  roundRectPath(ctx, -fx, -fy, fx * 2, fy * 2, fy);
  ctx.fill();
  // Wood-grain edge highlight (top) + shadow (bottom) for a little depth.
  ctx.strokeStyle = 'rgba(120,84,50,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-fx + fy, -fy + 0.6); ctx.lineTo(fx - fy, -fy + 0.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.moveTo(-fx + fy, fy - 0.6); ctx.lineTo(fx - fy, fy - 0.6); ctx.stroke();
  ctx.restore();

  // --- Bronze face (long oval) with a metallic cross-gradient (top-lit) ---
  const grad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  grad.addColorStop(0.0, '#f0d18a');  // top edge catching light
  grad.addColorStop(0.35, '#cf9e4c'); // polished bronze
  grad.addColorStop(0.7, '#9a6a34');  // lower bronze
  grad.addColorStop(1.0, '#5f3e1f');  // bottom rim shadow
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Darker rim ring around the face.
  ctx.strokeStyle = '#4a2f14';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // --- Specular highlight running along the length of the face ---
  // A long, bright, soft streak just above the centreline — reads as sunlight
  // glancing off a polished curved surface. Baked into the sprite so it turns
  // with the mirror.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 2, ry - 1.5, 0, 0, Math.PI * 2);
  ctx.clip(); // keep the streak inside the face
  const streak = ctx.createLinearGradient(0, cy - ry, 0, cy + ry * 0.2);
  streak.addColorStop(0.0, 'rgba(255,250,235,0.0)');
  streak.addColorStop(0.45, 'rgba(255,252,240,0.95)');
  streak.addColorStop(0.7, 'rgba(255,245,215,0.25)');
  streak.addColorStop(1.0, 'rgba(255,245,215,0.0)');
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.32, rx * 0.86, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Forged rivets at each end of the shield ---
  const rivetX = rx * 0.82;
  for (const s of [-1, 1]) {
    const px = cx + s * rivetX;
    ctx.beginPath();
    ctx.arc(px, cy, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#e8c880';       // bright rivet head
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#6b4a22';     // rivet shadow ring
    ctx.stroke();
  }
}

// Rounded-rectangle path helper (canvas has no built-in in older engines).
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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

  // Sun-catch glint: centred on the shield face and rotated with it so its wide
  // axis lies along the shield's length. Brightens when the polished face tilts
  // up toward the virtual overhead sun (surface normal.y -> 1).
  if (mirror.highlight) {
    const ny = mirror.normal.y;
    mirror.highlight.position.set(sx, sy, 0.05);
    mirror.highlight.rotation.z = mirror.angle; // wide glint follows the length
    const facing = Math.max(0, ny);              // 0..1
    mirror.highlight.material.opacity = 0.12 + 0.5 * facing;
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
    // Keep the sun-catch glint centred on the shield (and aligned) during tween.
    if (tw.mirror.highlight) {
      tw.mirror.highlight.position.set(x, y, 0.05);
      tw.mirror.highlight.rotation.z = tw.mirror.angle;
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
