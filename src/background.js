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

// Colours (all below 22% luminance — beams must remain brightest). The build's
// luminance-budget check (build.js) hard-fails if any of these, or the sea
// gradient stops, reaches 22%, so the water can't drift bright unnoticed again.
const COL_SKY = 0x0a1520;       // near-black blue      (0.7%)
const COL_GROUND = 0x2E2419;    // warm dark stone      (1.9%)
const COL_WALL = 0x554433;      // wall line            (6.3%)

let seaMesh = null;
let seaTexture = null;
let seaCanvas = null;
let seaCtx = null;
let seaW = 64;
let seaH = 512;
let reduceMotion = false;
let waveOffset = 0;
let foamLine = null;
let foamPhase = 0;

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

  // Bake the wave crests into the texture ONCE, then animate via cheap UV
  // scrolling (texture.offset) instead of redrawing the canvas every frame.
  drawWaveCrests(seaCtx, seaW, seaH, 0);
  seaTexture = new THREE.CanvasTexture(seaCanvas);
  seaTexture.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  seaTexture.minFilter = THREE.LinearFilter;
  seaTexture.magFilter = THREE.LinearFilter;
  seaTexture.wrapS = THREE.RepeatWrapping;
  seaTexture.wrapT = THREE.RepeatWrapping;
  // Repeat vertically a bit so scrolling reveals continuous ripples.
  seaTexture.repeat.set(1, 1.5);

  const seaGeo = new THREE.PlaneGeometry(ww + 4, seaH_world);
  const seaMat = new THREE.MeshBasicMaterial({ map: seaTexture, depthWrite: false });
  seaMesh = new THREE.Mesh(seaGeo, seaMat);
  seaMesh.position.set(0, seaBot + seaH_world / 2, -10);
  scene.add(seaMesh);

  // --- 3. Shoreline foam (thin band at sea/ground boundary) ---
  const foamH = 1.2;
  const foamGeo = new THREE.PlaneGeometry(ww + 4, foamH);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0x1a3a48, transparent: true, opacity: 0.7, depthWrite: false });
  const foamMesh = new THREE.Mesh(foamGeo, foamMat);
  foamMesh.position.set(0, WALL_Y + foamH / 2, -9.8);
  scene.add(foamMesh);

  // Bright white foam line: a soft glowing strip where the water washes against
  // the lower battlement. Its opacity breathes with the wave rhythm.
  const foamLineH = 0.6;
  const flCanvas = document.createElement('canvas');
  flCanvas.width = 64; flCanvas.height = 8;
  const flCtx = flCanvas.getContext('2d');
  const flGrad = flCtx.createLinearGradient(0, 0, 0, 8);
  flGrad.addColorStop(0, 'rgba(255,255,255,0)');
  flGrad.addColorStop(0.5, 'rgba(235,245,250,0.9)');
  flGrad.addColorStop(1, 'rgba(255,255,255,0)');
  flCtx.fillStyle = flGrad; flCtx.fillRect(0, 0, 64, 8);
  const flTex = new THREE.CanvasTexture(flCanvas);
  flTex.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  flTex.minFilter = THREE.LinearFilter;
  const foamLineGeo = new THREE.PlaneGeometry(ww + 4, foamLineH);
  const foamLineMat = new THREE.MeshBasicMaterial({ map: flTex, transparent: true, opacity: 0.6, depthWrite: false });
  foamLine = new THREE.Mesh(foamLineGeo, foamLineMat);
  foamLine.position.set(0, WALL_Y + 0.5, -9.6);
  scene.add(foamLine);

  // Thin foam edge
  const edgeH = 0.3;
  const edgeGeo = new THREE.PlaneGeometry(ww + 4, edgeH);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x234858, transparent: true, opacity: 0.4, depthWrite: false });
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

  // Cheap animated ripple: scroll the baked wave texture's UVs. A slight
  // secondary horizontal sway adds a shimmer so it doesn't look like a
  // straight conveyor. No per-frame canvas redraw.
  waveOffset += dt * 0.03; // UV units/sec (texture is normalised 0..1)
  seaTexture.offset.y = (seaTexture.offset.y + dt * 0.03) % 1;
  seaTexture.offset.x = Math.sin(waveOffset * 6) * 0.012;

  // Foam line breathes with the wave rhythm (in sync with the 0.1Hz sea audio
  // feel): opacity + a tiny vertical bob as the surf washes the stone.
  if (foamLine) {
    foamPhase += dt;
    foamLine.material.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(foamPhase * 0.8));
    foamLine.position.y = WALL_Y + 0.5 + Math.sin(foamPhase * 0.8) * 0.15;
  }
}

// --- Sea drawing ---

function drawSeaBase(ctx, w, h) {
  // Vertical DEPTH gradient (canvas top = open sea/spawn, bottom = battlement
  // harbour). The WHOLE band is kept inside the dark #12303F..#1A4257 range so
  // it stays well under the 22% luminance ceiling and the pale beams remain the
  // brightest thing on screen. Stops are spread EVENLY across the full height
  // (no clustering) so the upper and lower bands blend over a wide transition
  // with no hard horizontal seam. Measured luminance (WCAG relative):
  //   #12303F 2.6% -> #143543 3.1% -> #163B4C 3.8% -> #1A4257 4.8%.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0,  '#12303F'); // open sea (top) — darkest
  grad.addColorStop(0.33, '#143543');
  grad.addColorStop(0.66, '#163B4C');
  grad.addColorStop(1.0,  '#1A4257'); // harbour (battlement) — lightest, still dark
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawWaveCrests(ctx, w, h, offset) {
  // Faint wave crests scrolling downward. Kept DIM (a muted blue-grey, low
  // alpha) so they read as surface shimmer, not bright lines against the dark
  // water. Crests are spread across the full height so several always cross the
  // mid gradient transition, breaking up any straight horizontal edge.
  const NUM_CRESTS = 9;
  const spacing = h / NUM_CRESTS;

  ctx.save();
  for (let i = 0; i < NUM_CRESTS; i++) {
    const baseY = ((i * spacing + offset) % h);
    // Low, varying opacity — a subtle cool shimmer, dark enough to stay under
    // the luminance ceiling and never form a hard seam.
    const alpha = 0.045 + 0.025 * Math.sin(i * 1.7);
    ctx.strokeStyle = `rgba(90, 140, 160, ${alpha})`;
    ctx.lineWidth = 1.0;
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
