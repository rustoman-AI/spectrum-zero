// ============================================================
// src/background.js — Environment bands (sea, shore, battlement)
//
// Pure rendering, no gameplay effect. All Y boundaries derived
// from config.js layout constants. Meshes at z=-10, behind everything.
//
// Respects prefers-reduced-motion: freezes wave scroll.
// ============================================================

import {
  WORLD_HEIGHT, MIRROR_FIELD_TOP, MIRROR_FIELD_BOT,
  WALL_Y, SUN_Y, SHIP_SPAWN_Y, PRISM_Y
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';

// Colours (all below 22% relative luminance)
const COL_DEEP_SEA = 0x12303F;
const COL_SHALLOW_SEA = 0x1A4257;
const COL_SURF = 0x3E7A93;
const COL_SHORE = 0x2E2419;
const COL_BATTLEMENT = 0x3A2E20;
const COL_WALL_EDGE = 0x1F1811;

let seaMesh = null;
let seaTexture = null;
let surfMesh = null;
let reduceMotion = false;

export function initBackground() {
  const scene = getScene();
  const ww = getWorldWidth();
  const hh = WORLD_HEIGHT / 2;

  // Check prefers-reduced-motion
  if (typeof window.matchMedia === 'function') {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // --- Band boundaries (reversed: sea at top, city at bottom) ---
  const seaTop = hh;                    // top of world
  const seaBot = SHIP_SPAWN_Y - 5;     // sea extends to just above spawn area
  const skyBot = seaBot;
  const cityTop = MIRROR_FIELD_TOP + 5; // city above mirror field
  const cityBot = -hh;                  // bottom of world

  // --- 1. Sea band (top of screen where ships come from) ---
  const seaH = seaTop - seaBot;
  const cityGeo = new THREE.PlaneGeometry(ww + 2, seaH);
  const cityMat = new THREE.MeshBasicMaterial({ color: COL_DEEP_SEA, depthWrite: false });
  const cityMeshObj = new THREE.Mesh(cityGeo, cityMat);
  cityMeshObj.position.set(0, seaBot + seaH / 2, -10);
  scene.add(cityMeshObj);

  // --- 2. City/wall band (bottom, where player defends) ---
  const cityH = cityTop - cityBot;
  const battleGeo = new THREE.PlaneGeometry(ww + 2, cityH);
  const battleMat = new THREE.MeshBasicMaterial({ color: COL_BATTLEMENT, depthWrite: false });
  const battleMeshObj = new THREE.Mesh(battleGeo, battleMat);
  battleMeshObj.position.set(0, cityBot + cityH / 2, -10);
  scene.add(battleMeshObj);

  // Wall line
  const edgeGeo = new THREE.PlaneGeometry(ww + 2, 0.6);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5, depthWrite: false });
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
  edgeMesh.position.set(0, WALL_Y, -9.8);
  scene.add(edgeMesh);

  // --- 3. Sea texture with waves (covers the sea band) ---
  const seaCanvas = document.createElement('canvas');
  seaCanvas.width = 32;
  seaCanvas.height = 256;
  const ctx = seaCanvas.getContext('2d');
  drawSeaTexture(ctx, 32, 256);

  seaTexture = new THREE.CanvasTexture(seaCanvas);
  seaTexture.wrapS = THREE.RepeatWrapping;
  seaTexture.wrapT = THREE.RepeatWrapping;
  seaTexture.minFilter = THREE.LinearFilter;

  // Overlay on sea band
  const seaOverGeo = new THREE.PlaneGeometry(ww + 2, seaH);
  const seaOverMat = new THREE.MeshBasicMaterial({ map: seaTexture, transparent: true, opacity: 0.5, depthWrite: false });
  seaMesh = new THREE.Mesh(seaOverGeo, seaOverMat);
  seaMesh.position.set(0, seaBot + seaH / 2, -9.5);
  scene.add(seaMesh);

  // Surf/wave line not needed at top — the sea band IS the top
}

export function updateBackground(dt) {
  // Scroll sea texture for wave motion
  if (seaTexture && !reduceMotion) {
    seaTexture.offset.y += dt * 0.02;
  }
}

function drawSeaTexture(ctx, w, h) {
  // Vertical gradient: shallow (top) to deep (bottom)
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#1A4257');   // shallow near shore
  gradient.addColorStop(1, '#12303F');   // deep at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Wave lines (3-4 horizontal lines at intervals)
  ctx.strokeStyle = 'rgba(30, 60, 80, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = 40 + i * 55;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x++) {
      ctx.lineTo(x, y + Math.sin(x * 0.5 + i * 2) * 2);
    }
    ctx.stroke();
  }
}
