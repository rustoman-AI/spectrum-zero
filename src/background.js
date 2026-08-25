// ============================================================
// src/background.js — Environment bands for reversed layout
//
// Sky strip at top, sea with vertical gradient from spawn to wall,
// foam shoreline at wall edge, warm stone city ground at bottom.
// All boundaries derived from gameplay constants.
// Scrolling wave crests via canvas texture offset.
// ============================================================

import {
  WORLD_HEIGHT, MIRROR_FIELD_TOP, MIRROR_FIELD_BOT,
  WALL_Y, SUN_Y, SHIP_SPAWN_Y, PRISM_Y
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';

// Colours (all below 22% luminance — beams must remain brightest)
const COL_SKY = 0x0a1520;       // near-black blue
const COL_GROUND = 0x2E2419;    // warm dark stone
const COL_WALL = 0x554433;      // wall line

let seaMesh = null;
let seaTexture = null;
let seaCanvas = null;
let seaCtx = null;
let seaW = 64;
let seaH = 512;
let reduceMotion = false;
let waveOffset = 0;

export function initBackground() {
  const scene = getScene();
  const ww = getWorldWidth();
  const hh = WORLD_HEIGHT / 2;

  if (typeof window.matchMedia === 'function') {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Band boundaries derived from layout constants
  const skyTop = hh;
  const skyBot = SHIP_SPAWN_Y + 2;
  const seaTop = skyBot;
  const seaBot = WALL_Y;
  const groundTop = WALL_Y;
  const groundBot = -hh;

  // --- 1. Sky strip ---
  const skyH = skyTop - skyBot;
  if (skyH > 0) {
    const skyGeo = new THREE.PlaneGeometry(ww + 4, skyH);
    const skyMat = new THREE.MeshBasicMaterial({ color: COL_SKY, depthWrite: false });
    const skyMeshObj = new THREE.Mesh(skyGeo, skyMat);
    skyMeshObj.position.set(0, skyBot + skyH / 2, -10);
    scene.add(skyMeshObj);
  }

  // --- 2. Sea band (gradient + animated wave texture) ---
  const seaH_world = seaTop - seaBot;

  // Sea canvas: vertical gradient + wave crests drawn procedurally
  seaCanvas = document.createElement('canvas');
  seaCanvas.width = seaW;
  seaCanvas.height = seaH;
  seaCtx = seaCanvas.getContext('2d');
  drawSeaBase(seaCtx, seaW, seaH);

  seaTexture = new THREE.CanvasTexture(seaCanvas);
  seaTexture.minFilter = THREE.LinearFilter;
  seaTexture.magFilter = THREE.LinearFilter;

  const seaGeo = new THREE.PlaneGeometry(ww + 4, seaH_world);
  const seaMat = new THREE.MeshBasicMaterial({ map: seaTexture, depthWrite: false });
  seaMesh = new THREE.Mesh(seaGeo, seaMat);
  seaMesh.position.set(0, seaBot + seaH_world / 2, -10);
  scene.add(seaMesh);

  // --- 3. Shoreline foam (thin bright band at sea/ground boundary) ---
  const foamH = 1.5;
  const foamGeo = new THREE.PlaneGeometry(ww + 4, foamH);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0x2a5060, transparent: true, opacity: 0.7, depthWrite: false });
  const foamMesh = new THREE.Mesh(foamGeo, foamMat);
  foamMesh.position.set(0, WALL_Y + foamH / 2, -9.8);
  scene.add(foamMesh);

  // Thin white foam edge
  const edgeH = 0.4;
  const edgeGeo = new THREE.PlaneGeometry(ww + 4, edgeH);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x3a6878, transparent: true, opacity: 0.5, depthWrite: false });
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
  edgeMesh.position.set(0, WALL_Y + edgeH / 2, -9.7);
  scene.add(edgeMesh);

  // --- 4. City ground ---
  const groundH = groundTop - groundBot;
  const groundGeo = new THREE.PlaneGeometry(ww + 4, groundH);
  const groundMat = new THREE.MeshBasicMaterial({ color: COL_GROUND, depthWrite: false });
  const groundMeshObj = new THREE.Mesh(groundGeo, groundMat);
  groundMeshObj.position.set(0, groundBot + groundH / 2, -10);
  scene.add(groundMeshObj);

  // Wall line (breach boundary — subtle stone wall, not a red danger line)
  const wallGeo = new THREE.PlaneGeometry(ww + 4, 1.2);
  const wallMat = new THREE.MeshBasicMaterial({ color: COL_WALL, depthWrite: false });
  const wallMeshObj = new THREE.Mesh(wallGeo, wallMat);
  wallMeshObj.position.set(0, WALL_Y, -9.5);
  scene.add(wallMeshObj);
}

export function updateBackground(dt) {
  if (!seaTexture || reduceMotion) return;

  // Scroll wave crests by redrawing with offset
  waveOffset += dt * 12; // pixels per second scroll speed
  if (waveOffset > seaH) waveOffset -= seaH;

  drawSeaBase(seaCtx, seaW, seaH);
  drawWaveCrests(seaCtx, seaW, seaH, waveOffset);
  seaTexture.needsUpdate = true;
}

// --- Sea drawing ---

function drawSeaBase(ctx, w, h) {
  // Vertical gradient: dark at top (#12303F), lighter toward shore (#1A4257)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0e2530');  // darkest at top (deep sea, horizon)
  grad.addColorStop(0.4, '#12303F');
  grad.addColorStop(0.8, '#1A4257');
  grad.addColorStop(1.0, '#1e4a60'); // lightest at bottom (approaching shore)
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawWaveCrests(ctx, w, h, offset) {
  // 6 thin wave crest lines scrolling downward
  const NUM_CRESTS = 6;
  const spacing = h / NUM_CRESTS;

  ctx.save();
  for (let i = 0; i < NUM_CRESTS; i++) {
    const baseY = ((i * spacing + offset) % h);
    // Varying opacity per crest (some subtle, some slightly brighter)
    const alpha = 0.08 + 0.04 * Math.sin(i * 1.7);
    ctx.strokeStyle = `rgba(80, 140, 170, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = baseY + Math.sin(x * 0.3 + i * 2.1) * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
