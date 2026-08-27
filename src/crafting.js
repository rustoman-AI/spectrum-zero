// ============================================================
// src/crafting.js — Shop UI: mirrors, prisms, priests, god abilities
// Rendered as in-scene canvas texture at bottom of playfield.
// ============================================================

import { SHOP, GOD_ABILITIES, WORLD_HEIGHT, PRISM_TIERS } from './config.js';
import { getScene, getWorldWidth, getOverlayScene } from './renderer.js';
import { getResources, canAfford, spend, getFaith, spendFaith, addPriest } from './foundry.js';
import { markDirty } from './beam.js';
import { setTier } from './prism.js';
import { addMirror } from './mirror.js';
import { triggerZeusStrike, isZeusReady } from './zeus.js';
import { triggerPoseidonStrike } from './poseidon.js';

let trayMesh = null;
let trayCanvas = null;
let trayCtx = null;
let trayTexture = null;
let trayY = 0;
let trayWidth = 0;
const trayHeight = 5;
let mirrorsBought = 0;
let focusCount = 0;
let zeusCount = 0;
let poseidonCount = 0;
let zeusCooldown = 0;       // seconds remaining (drawn as radial wipe)
let poseidonCooldown = 0;
const ZEUS_COOLDOWN_TIME = 8;     // seconds
const POSEIDON_COOLDOWN_TIME = 10;
const prevAffordable = [];  // track per-button affordability for pulse
const pulseTimes = [];      // countdown for 300ms pulse animation

// Shop items displayed in the tray
const SHOP_ITEMS = [
  { id: 'mirror', label: 'Mirror', getCost: () => ({ brass: SHOP.mirror.brass + mirrorsBought * SHOP.mirror.scaling }) },
  { id: 'prism4', label: '4-Prism', getCost: () => SHOP.prism4 },
  { id: 'prism5', label: '5-Prism', getCost: () => SHOP.prism5 },
  { id: 'prism6', label: '6-Prism', getCost: () => SHOP.prism6 },
  { id: 'priest', label: 'Priest', getCost: () => SHOP.priest },
  { id: 'zeus',   label: 'Zeus', getCost: () => {
    const costs = GOD_ABILITIES.zeus.costs;
    return costs[Math.min(zeusCount, costs.length - 1)];
  } },
  { id: 'poseidon', label: 'Poseidon', getCost: () => {
    const costs = GOD_ABILITIES.poseidon.costs;
    return costs[Math.min(poseidonCount, costs.length - 1)];
  } },
];

export function getFocusMultiplier() { return 1 + focusCount * 0.15; }

export function initCrafting() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  mirrorsBought = 0;
  activeTier = 3;
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
  const mat = new THREE.MeshBasicMaterial({ map: trayTexture, transparent: true, depthWrite: false });
  trayMesh = new THREE.Mesh(geo, mat);
  trayMesh.position.set(0, trayY, 0);
  oScene.add(trayMesh);
}

export function updateCraftingTray() {
  if (!trayCtx) return;
  // Tick cooldowns (approx 1 frame at 60fps)
  const cdt = 0.016;
  if (zeusCooldown > 0) zeusCooldown -= cdt;
  if (poseidonCooldown > 0) poseidonCooldown -= cdt;
  const res = getResources();
  const faith = getFaith();

  trayCtx.clearRect(0, 0, 512, 40);
  trayCtx.fillStyle = 'rgba(0,0,0,0.7)';
  trayCtx.fillRect(0, 0, 512, 40);

  const btnW = 512 / SHOP_ITEMS.length;
  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const item = SHOP_ITEMS[i];
    const cost = item.getCost();
    const affordable = canAffordCombined(cost, res, faith);
    const x = i * btnW;

    // Detect affordability crossing → trigger 300ms pulse
    if (prevAffordable[i] === false && affordable) {
      pulseTimes[i] = 0.3;
    }
    prevAffordable[i] = affordable;
    if (pulseTimes[i] > 0) pulseTimes[i] -= 0.016; // approx 1 frame

    const pulsing = pulseTimes[i] > 0;

    // Zeus button: extra-loud pulsing when ready
    const isZeusBtn = item.id === 'zeus';
    const zeusGlow = isZeusBtn && isZeusReady();
    const zeusPhase = zeusGlow ? (Math.sin(Date.now() * 0.008) * 0.5 + 0.5) : 0;

    let bgColour, borderCol;
    if (zeusGlow) {
      // Zeus ready: bright gold pulsing
      const glow = 0.6 + zeusPhase * 0.4;
      bgColour = `rgba(${Math.floor(180*glow)},${Math.floor(140*glow)},${Math.floor(40*glow)},1)`;
      borderCol = '#FFDD44';
    } else {
      bgColour = affordable ? (pulsing ? 'rgba(130,130,200,1)' : 'rgba(70,70,120,0.9)') : 'rgba(40,40,50,0.6)';
      borderCol = affordable ? (pulsing ? '#ffffff' : '#9999cc') : 'rgba(60,60,80,0.4)';
    }

    trayCtx.fillStyle = bgColour;
    trayCtx.fillRect(x + 1, 1, btnW - 2, 38);
    // Border
    trayCtx.strokeStyle = borderCol;
    trayCtx.lineWidth = zeusGlow ? 3 : (pulsing ? 2.5 : (affordable ? 1.5 : 0.5));
    trayCtx.strokeRect(x + 1, 1, btnW - 2, 38);

    trayCtx.fillStyle = (affordable || zeusGlow) ? '#ffffff' : '#777777';
    trayCtx.font = 'bold 9px monospace';
    trayCtx.textAlign = 'center';
    trayCtx.fillText(item.label, x + btnW / 2, 14);

    trayCtx.font = '7px monospace';
    trayCtx.fillStyle = (affordable || zeusGlow) ? '#cccccc' : '#555555';
    trayCtx.fillText(costStr(cost), x + btnW / 2, 28);

    // Radial cooldown overlay for god powers
    let cooldownFrac = 0;
    if (item.id === 'zeus' && zeusCooldown > 0) cooldownFrac = zeusCooldown / ZEUS_COOLDOWN_TIME;
    if (item.id === 'poseidon' && poseidonCooldown > 0) cooldownFrac = poseidonCooldown / POSEIDON_COOLDOWN_TIME;
    if (cooldownFrac > 0) {
      // Dark radial wipe (pie slice from top, clockwise)
      const cx = x + btnW / 2;
      const cy = 20;
      const r = 18;
      trayCtx.save();
      trayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      trayCtx.beginPath();
      trayCtx.moveTo(cx, cy);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + cooldownFrac * Math.PI * 2;
      trayCtx.arc(cx, cy, r, startAngle, endAngle);
      trayCtx.closePath();
      trayCtx.fill();
      // Cooldown seconds text
      trayCtx.fillStyle = '#ffffff';
      trayCtx.font = 'bold 10px monospace';
      trayCtx.textAlign = 'center';
      trayCtx.fillText(Math.ceil(cooldownFrac * (item.id === 'zeus' ? ZEUS_COOLDOWN_TIME : POSEIDON_COOLDOWN_TIME)) + 's', cx, 23);
      trayCtx.restore();
    }
  }
  trayTexture.needsUpdate = true;
}

export function handleCraftTap(worldX, worldY) {
  const halfW = trayWidth / 2;
  const halfH = trayHeight / 2;
  if (worldY < trayY - halfH || worldY > trayY + halfH) return false;
  if (worldX < -halfW || worldX > halfW) return false;

  const normX = (worldX + halfW) / trayWidth;
  const btnIndex = Math.floor(normX * SHOP_ITEMS.length);
  if (btnIndex < 0 || btnIndex >= SHOP_ITEMS.length) return false;

  return attemptPurchase(SHOP_ITEMS[btnIndex]);
}

export function resetCrafting() {
  mirrorsBought = 0;
  focusCount = 0;
  zeusCount = 0;
  poseidonCount = 0;
  if (typeof resetTier === 'function') resetTier();
}

function attemptPurchase(item) {
  // Block god powers during cooldown
  if (item.id === 'zeus' && zeusCooldown > 0) return false;
  if (item.id === 'poseidon' && poseidonCooldown > 0) return false;
  const res = getResources();
  const faith = getFaith();
  const cost = item.getCost();
  if (!canAffordCombined(cost, res, faith)) return false;

  // Spend resources
  const resCost = {};
  for (const k in cost) {
    if (k === 'faith') { spendFaith(cost[k]); }
    else { resCost[k] = cost[k]; }
  }
  if (Object.keys(resCost).length > 0) spend(resCost);

  switch (item.id) {
    case 'mirror': mirrorsBought++; addMirror(); break;
    case 'prism4': setTier(4); markDirty(); break;
    case 'prism5': setTier(5); markDirty(); break;
    case 'prism6': setTier(6); markDirty(); break;
    case 'priest': addPriest(); break;
    case 'zeus': zeusCount++; zeusCooldown = ZEUS_COOLDOWN_TIME; triggerZeusStrike(); break;
    case 'poseidon': poseidonCount++; poseidonCooldown = POSEIDON_COOLDOWN_TIME; triggerPoseidonStrike(); break;
  }
  return true;
}

function canAffordCombined(cost, res, faith) {
  for (const k in cost) {
    if (k === 'faith') { if (faith < cost[k]) return false; }
    else { if ((res[k] || 0) < cost[k]) return false; }
  }
  return true;
}

export function isZeusAffordable() {
  const res = getResources();
  const faith = getFaith();
  const costs = GOD_ABILITIES.zeus.costs;
  const cost = costs[Math.min(zeusCount, costs.length - 1)];
  return canAffordCombined(cost, res, faith);
}

function costStr(cost) {
  const labels = { brass: 'Br', bronze: 'Bz', silver: 'Si', gold: 'Au', faith: 'Fa' };
  const parts = [];
  for (const k in cost) {
    parts.push(cost[k] + (labels[k] || k[0]));
  }
  return parts.join(' ');
}
