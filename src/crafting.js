// ============================================================
// src/crafting.js — Craft tray UI, purchase logic
//
// Rendered as a canvas-texture mesh INSIDE the 9:16 playfield,
// at the very bottom of the screen (below enemy zone).
// ============================================================

import {
  CRAFT_PRISM, CRAFT_REPAIR, CRAFT_REINFORCED, CRAFT_IGNITION,
  CRAFT_FOCUS, CRAFT_ANCHOR, FOCUS_DAMAGE_MULT, WORLD_HEIGHT
} from './config.js';
import { getScene, getWorldWidth, screenToWorld, getOverlayScene } from './renderer.js';
import { getSlag, getInsight, spendSlag, spendInsight } from './foundry.js';
import { placePrism } from './prism.js';
import { getMirrors, repairMirror, getSockets } from './mirror.js';
import { markDirty } from './beam.js';

const CRAFTS = [
  { id: 'prism',      label: 'Prism',   slag: CRAFT_PRISM.slag,      insight: CRAFT_PRISM.insight },
  { id: 'repair',     label: 'Repair',  slag: CRAFT_REPAIR.slag,     insight: CRAFT_REPAIR.insight },
  { id: 'reinforced', label: 'Reinf.',  slag: CRAFT_REINFORCED.slag, insight: CRAFT_REINFORCED.insight },
  { id: 'ignition',   label: 'Ignite',  slag: CRAFT_IGNITION.slag,   insight: CRAFT_IGNITION.insight },
  { id: 'focus',      label: 'Focus',   slag: CRAFT_FOCUS.slag,      insight: CRAFT_FOCUS.insight },
  { id: 'anchor',     label: 'Anchor',  slag: CRAFT_ANCHOR.slag,     insight: CRAFT_ANCHOR.insight },
];

let trayMesh = null;
let trayCanvas = null;
let trayCtx = null;
let trayTexture = null;
let trayY = 0;
let trayWidth = 0;
let trayHeight = 4;
let focusCount = 0;

export function initCrafting() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  focusCount = 0;

  trayWidth = worldWidth * 0.95;
  trayY = -WORLD_HEIGHT / 2 + 3;

  trayCanvas = document.createElement('canvas');
  trayCanvas.width = 512;
  trayCanvas.height = 40;
  trayCtx = trayCanvas.getContext('2d');

  trayTexture = new THREE.CanvasTexture(trayCanvas);
  trayTexture.minFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(trayWidth, trayHeight);
  const mat = new THREE.MeshBasicMaterial({
    map: trayTexture,
    transparent: true,
    depthWrite: false
  });
  trayMesh = new THREE.Mesh(geo, mat);
  trayMesh.position.set(0, trayY, 0);
  oScene.add(trayMesh);
}

export function updateCraftingTray() {
  if (!trayCtx) return;
  const currentSlag = getSlag();
  const currentInsight = getInsight();

  trayCtx.clearRect(0, 0, 512, 40);
  trayCtx.fillStyle = 'rgba(0,0,0,0.7)';
  trayCtx.fillRect(0, 0, 512, 40);

  const btnW = 512 / CRAFTS.length;
  for (let i = 0; i < CRAFTS.length; i++) {
    const c = CRAFTS[i];
    const affordable = currentSlag >= c.slag && currentInsight >= c.insight;
    const x = i * btnW;

    trayCtx.fillStyle = affordable ? 'rgba(80,80,120,0.9)' : 'rgba(30,30,30,0.7)';
    trayCtx.fillRect(x + 1, 1, btnW - 2, 38);

    trayCtx.fillStyle = affordable ? '#ffffff' : '#555555';
    trayCtx.font = 'bold 10px monospace';
    trayCtx.textAlign = 'center';
    trayCtx.fillText(c.label, x + btnW / 2, 15);

    trayCtx.font = '8px monospace';
    trayCtx.fillStyle = affordable ? '#aaaaaa' : '#333333';
    let costStr = '';
    if (c.slag > 0) costStr += c.slag + 'S';
    if (c.insight > 0) costStr += (costStr ? ' ' : '') + c.insight + 'I';
    trayCtx.fillText(costStr, x + btnW / 2, 30);
  }

  trayTexture.needsUpdate = true;
}

// Called from input.js on tap — checks if tap is in the tray area
export function handleCraftTap(worldX, worldY) {
  const halfW = trayWidth / 2;
  const halfH = trayHeight / 2;
  if (worldY < trayY - halfH || worldY > trayY + halfH) return false;
  if (worldX < -halfW || worldX > halfW) return false;

  const normX = (worldX + halfW) / trayWidth;
  const btnIndex = Math.floor(normX * CRAFTS.length);
  if (btnIndex < 0 || btnIndex >= CRAFTS.length) return false;

  return attemptPurchase(CRAFTS[btnIndex]);
}

export function getFocusMultiplier() {
  return 1 + focusCount * FOCUS_DAMAGE_MULT;
}

export function resetCrafting() {
  focusCount = 0;
}

function attemptPurchase(craft) {
  const currentSlag = getSlag();
  const currentInsight = getInsight();
  if (currentSlag < craft.slag || currentInsight < craft.insight) return false;

  spendSlag(craft.slag);
  spendInsight(craft.insight);

  switch (craft.id) {
    case 'prism':
      autoPlacePrism();
      break;
    case 'repair':
      repairCrackedMirror();
      break;
    case 'reinforced':
      reinforceMirror();
      break;
    case 'ignition':
      break;
    case 'focus':
      focusCount++;
      markDirty();
      break;
    case 'anchor':
      anchorMirror();
      break;
  }
  return true;
}

function autoPlacePrism() {
  const sockets = getSockets();
  for (let i = 0; i < sockets.length; i++) {
    if (sockets[i].type === null) {
      placePrism(i);
      return;
    }
  }
}

function repairCrackedMirror() {
  const mirrors = getMirrors();
  for (const m of mirrors) {
    if (m.hits > 0 && !m.shattered) { repairMirror(m); return; }
  }
  for (const m of mirrors) {
    if (m.shattered) { repairMirror(m); return; }
  }
}

function reinforceMirror() {
  const mirrors = getMirrors();
  for (const m of mirrors) {
    if (!m.reinforced) {
      m.reinforced = true;
      m.mesh.material.color.setHex(0xaaaaee);
      return;
    }
  }
}

function anchorMirror() {
  const mirrors = getMirrors();
  for (const m of mirrors) {
    if (!m.anchored) { m.anchored = true; return; }
  }
}
