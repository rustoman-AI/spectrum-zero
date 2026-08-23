// ============================================================
// src/background.js — Environment bands for reversed layout
// Sky strip at top, sea from spawn to wall, city ground at bottom.
// All boundaries derived from gameplay constants.
// ============================================================

import {
  WORLD_HEIGHT, MIRROR_FIELD_TOP, MIRROR_FIELD_BOT,
  WALL_Y, SUN_Y, SHIP_SPAWN_Y, PRISM_Y
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';

// Colours (all below 22% luminance)
const COL_SKY = 0x0a1520;
const COL_DEEP_SEA = 0x12303F;
const COL_SHALLOW_SEA = 0x1A4257;
const COL_GROUND = 0x2E2419;

let seaMesh = null;
let seaTexture = null;
let reduceMotion = false;

export function initBackground() {
  const scene = getScene();
  const ww = getWorldWidth();
  const hh = WORLD_HEIGHT / 2;

  if (typeof window.matchMedia === 'function') {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Band boundaries derived from layout constants:
  // Sky: top of world to SHIP_SPAWN_Y (thin strip above ships)
  // Sea: SHIP_SPAWN_Y down to WALL_Y (where ships travel)
  // Ground: WALL_Y down to bottom of world (city, mirrors, player area)
  const skyTop = hh;
  const skyBot = SHIP_SPAWN_Y + 2;
  const seaTop = skyBot;
  const seaBot = WALL_Y;
  const groundTop = WALL_Y;
  const groundBot = -hh;

  // --- 1. Sky strip (very top, above ships) ---
  const skyH = skyTop - skyBot;
  if (skyH > 0) {
    const skyGeo = new THREE.PlaneGeometry(ww + 2, skyH);
    const skyMat = new THREE.MeshBasicMaterial({ color: COL_SKY, depthWrite: false });
    const skyMeshObj = new THREE.Mesh(skyGeo, skyMat);
    skyMeshObj.position.set(0, skyBot + skyH / 2, -10);
    scene.add(skyMeshObj);
  }

  // --- 2. Sea (from ship spawn down to wall — where ships sail) ---
  const seaH = seaTop - seaBot;
  const seaGeo = new THREE.PlaneGeometry(ww + 2, seaH);
  const seaMat = new THREE.MeshBasicMaterial({ color: COL_DEEP_SEA, depthWrite: false });
  const seaBgMesh = new THREE.Mesh(seaGeo, seaMat);
  seaBgMesh.position.set(0, seaBot + seaH / 2, -10);
  scene.add(seaBgMesh);

  // Sea wave texture overlay
  const seaCanvas = document.createElement('canvas');
  seaCanvas.width = 32;
  seaCanvas.height = 256;
  const ctx = seaCanvas.getContext('2d');
  drawSeaTexture(ctx, 32, 256);
  seaTexture = new THREE.CanvasTexture(seaCanvas);
  seaTexture.wrapS = THREE.RepeatWrapping;
  seaTexture.wrapT = THREE.RepeatWrapping;
  seaTexture.minFilter = THREE.LinearFilter;
  const seaOverGeo = new THREE.PlaneGeometry(ww + 2, seaH);
  const seaOverMat = new THREE.MeshBasicMaterial({ map: seaTexture, transparent: true, opacity: 0.4, depthWrite: false });
  seaMesh = new THREE.Mesh(seaOverGeo, seaOverMat);
  seaMesh.position.set(0, seaBot + seaH / 2, -9.5);
  scene.add(seaMesh);

  // --- 3. City ground (bottom — wall, mirrors, player area) ---
  const groundH = groundTop - groundBot;
  const groundGeo = new THREE.PlaneGeometry(ww + 2, groundH);
  const groundMat = new THREE.MeshBasicMaterial({ color: COL_GROUND, depthWrite: false });
  const groundMeshObj = new THREE.Mesh(groundGeo, groundMat);
  groundMeshObj.position.set(0, groundBot + groundH / 2, -10);
  scene.add(groundMeshObj);

  // Wall line (visible breach boundary)
  const wallGeo = new THREE.PlaneGeometry(ww + 2, 0.8);
  const wallMat = new THREE.MeshBasicMaterial({ color: 0xcc3333, transparent: true, opacity: 0.6, depthWrite: false });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.set(0, WALL_Y, -9.2);
  scene.add(wallMesh);
}

export function updateBackground(dt) {
  if (seaTexture && !reduceMotion) {
    seaTexture.offset.y += dt * 0.015;
  }
}

function drawSeaTexture(ctx, w, h) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#1A4257');
  gradient.addColorStop(1, '#12303F');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(30, 60, 80, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = 40 + i * 55;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      ctx.lineTo(x, y + Math.sin(x * 0.5 + i * 2) * 2);
    }
    ctx.stroke();
  }
}
