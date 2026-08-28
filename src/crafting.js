// ============================================================
// src/crafting.js — Shop UI: mirrors, prisms, god abilities (Helios/Zeus/Poseidon)
// Rendered as in-scene canvas texture at bottom of playfield.
// ============================================================

import { SHOP, GOD_ABILITIES, WORLD_HEIGHT, PRISM_TIERS } from './config.js';
import { getScene, getWorldWidth, getOverlayScene } from './renderer.js';
import { getResources, canAfford, spend, getFaith, spendFaith } from './foundry.js';
import { markDirty } from './beam.js';
import { setTier, getActiveTier } from './prism.js';
import { addMirror } from './mirror.js';
import { triggerZeusStrike, isZeusReady } from './zeus.js';
import { triggerPoseidonStrike } from './poseidon.js';
import { triggerHelios } from './helios.js';

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
let heliosCount = 0;
let zeusCooldown = 0;       // seconds remaining (drawn as radial wipe)
let poseidonCooldown = 0;
let heliosCooldown = 0;
const ZEUS_COOLDOWN_TIME = 8;     // seconds
const POSEIDON_COOLDOWN_TIME = 10;
const HELIOS_COOLDOWN_TIME = 7;
const prevAffordable = [];  // track per-button affordability for pulse
const pulseTimes = [];      // countdown for 300ms pulse animation

// The prism upgrade is a single slot that advances 4 -> 5 -> 6 and then
// disappears once tier 6 is owned. Owned tiers can never be repurchased.
const PRISM_UPGRADES = {
  3: { id: 'prism4', label: '4-Prism', tier: 4, getCost: () => SHOP.prism4 },
  4: { id: 'prism5', label: '5-Prism', tier: 5, getCost: () => SHOP.prism5 },
  5: { id: 'prism6', label: '6-Prism', tier: 6, getCost: () => SHOP.prism6 },
};

// Build the visible shop list for the current frame. The prism slot reflects
// the next tier the player can buy (or is omitted entirely at max tier), so the
// layout stays a fixed, non-overlapping grid that shrinks as tiers max out.
function buildShopItems() {
  const items = [
    { id: 'mirror', label: 'Mirror', getCost: () => ({ brass: SHOP.mirror.brass + mirrorsBought * SHOP.mirror.scaling }) },
  ];
  const upgrade = PRISM_UPGRADES[getActiveTier()];
  if (upgrade) items.push(upgrade);
  items.push(
    { id: 'helios', label: 'Helios', getCost: () => {
      const costs = GOD_ABILITIES.helios.costs;
      return costs[Math.min(heliosCount, costs.length - 1)];
    } },
    { id: 'zeus', label: 'Zeus', getCost: () => {
      const costs = GOD_ABILITIES.zeus.costs;
      return costs[Math.min(zeusCount, costs.length - 1)];
    } },
    { id: 'poseidon', label: 'Poseidon', getCost: () => {
      const costs = GOD_ABILITIES.poseidon.costs;
      return costs[Math.min(poseidonCount, costs.length - 1)];
    } },
  );
  return items;
}

export function getFocusMultiplier() { return 1 + focusCount * 0.15; }

export function initCrafting() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  mirrorsBought = 0;
  activeTier = 3;
  focusCount = 0;

  trayWidth = worldWidth * 0.95;
  trayY = -WORLD_HEIGHT / 2 + 3;

  // 2x-resolution backing canvas (1024x80) drawn in a 512x40 logical space so
  // the small cost text stays crisp when the tray plane is upscaled on a phone.
  trayCanvas = document.createElement('canvas');
  trayCanvas.width = 1024;
  trayCanvas.height = 80;
  trayCtx = trayCanvas.getContext('2d');
  trayCtx.scale(2, 2); // logical coordinates remain 512x40

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
  if (heliosCooldown > 0) heliosCooldown -= cdt;
  const res = getResources();
  const faith = getFaith();

  trayCtx.clearRect(0, 0, 512, 40);
  trayCtx.fillStyle = 'rgba(0,0,0,0.7)';
  trayCtx.fillRect(0, 0, 512, 40);

  const shopItems = buildShopItems();
  const btnW = 512 / shopItems.length;
  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    const cost = item.getCost();
    // A god power on cooldown cannot be bought yet, so it should not read as
    // "ready" even if the player can afford it. The instant the cooldown hits
    // 0 (recomputed every frame) the button lights up with its real state.
    const onCooldown =
      (item.id === 'zeus' && zeusCooldown > 0) ||
      (item.id === 'poseidon' && poseidonCooldown > 0) ||
      (item.id === 'helios' && heliosCooldown > 0);
    const canAfford = canAffordCombined(cost, res, faith);
    const affordable = canAfford && !onCooldown;
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

    // Clip text to this button cell so labels can never bleed into neighbours
    trayCtx.save();
    trayCtx.beginPath();
    trayCtx.rect(x + 1, 1, btnW - 2, 38);
    trayCtx.clip();

    trayCtx.fillStyle = (affordable || zeusGlow) ? '#ffffff' : '#777777';
    trayCtx.font = 'bold 8px monospace';
    trayCtx.textAlign = 'center';
    trayCtx.fillText(item.label, x + btnW / 2, 13);

    // Cost: draw each currency token separately so the ones the player can't
    // afford show in red (immediate "why can't I buy this" feedback).
    drawCostTokens(cost, res, faith, x + btnW / 2, 27, btnW);

    trayCtx.restore();

    // Radial cooldown overlay for god powers
    let cooldownFrac = 0;
    let cooldownTotal = 0;
    if (item.id === 'zeus' && zeusCooldown > 0) { cooldownFrac = zeusCooldown / ZEUS_COOLDOWN_TIME; cooldownTotal = ZEUS_COOLDOWN_TIME; }
    if (item.id === 'poseidon' && poseidonCooldown > 0) { cooldownFrac = poseidonCooldown / POSEIDON_COOLDOWN_TIME; cooldownTotal = POSEIDON_COOLDOWN_TIME; }
    if (item.id === 'helios' && heliosCooldown > 0) { cooldownFrac = heliosCooldown / HELIOS_COOLDOWN_TIME; cooldownTotal = HELIOS_COOLDOWN_TIME; }
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
      trayCtx.fillText(Math.ceil(cooldownFrac * cooldownTotal) + 's', cx, 23);
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

  const shopItems = buildShopItems();
  const normX = (worldX + halfW) / trayWidth;
  const btnIndex = Math.floor(normX * shopItems.length);
  if (btnIndex < 0 || btnIndex >= shopItems.length) return false;

  return attemptPurchase(shopItems[btnIndex]);
}

export function resetCrafting() {
  mirrorsBought = 0;
  focusCount = 0;
  zeusCount = 0;
  poseidonCount = 0;
  heliosCount = 0;
  zeusCooldown = 0;
  poseidonCooldown = 0;
  heliosCooldown = 0;
  if (typeof resetTier === 'function') resetTier();
}

function attemptPurchase(item) {
  // Block god powers during cooldown
  if (item.id === 'zeus' && zeusCooldown > 0) return false;
  if (item.id === 'poseidon' && poseidonCooldown > 0) return false;
  if (item.id === 'helios' && heliosCooldown > 0) return false;
  // Guard: never allow buying a prism tier at or below the one already owned.
  if (item.tier && getActiveTier() >= item.tier) return false;
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
    case 'helios': heliosCount++; heliosCooldown = HELIOS_COOLDOWN_TIME; triggerHelios(); break;
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

// Draw the cost as separate tokens, centred at (centreX, y). Tokens the player
// can afford render light; tokens they can't afford render red so it's obvious
// which currency is short.
const COST_LABELS = { brass: 'Br', bronze: 'Bz', silver: 'Si', gold: 'Au', faith: 'Fa' };
// Draw the cost as clean, spaced tokens on a single line, e.g. "15 Si + 20 Bz".
// Each currency is measured/positioned individually so tokens never run into
// each other, and unaffordable ones render red. A "+" joins multiple currencies.
function drawCostTokens(cost, res, faith, centreX, y, btnW) {
  trayCtx.font = 'bold 8px monospace';
  // Build renderable pieces: [amount+label] tokens joined by " + " separators.
  const tokens = [];
  for (const k in cost) {
    const have = (k === 'faith') ? faith : (res[k] || 0);
    tokens.push({ text: cost[k] + ' ' + (COST_LABELS[k] || k[0]), ok: have >= cost[k] });
  }
  if (tokens.length === 0) return;

  const sep = ' + ';
  const sepW = trayCtx.measureText(sep).width;
  let totalW = 0;
  for (let t = 0; t < tokens.length; t++) {
    totalW += trayCtx.measureText(tokens[t].text).width;
    if (t < tokens.length - 1) totalW += sepW;
  }

  trayCtx.textAlign = 'left';
  let cx = centreX - totalW / 2;
  for (let t = 0; t < tokens.length; t++) {
    trayCtx.fillStyle = tokens[t].ok ? '#dddddd' : '#ff5555';
    trayCtx.fillText(tokens[t].text, cx, y);
    cx += trayCtx.measureText(tokens[t].text).width;
    if (t < tokens.length - 1) {
      trayCtx.fillStyle = '#888888'; // neutral separator
      trayCtx.fillText(sep, cx, y);
      cx += sepW;
    }
  }
  trayCtx.textAlign = 'center'; // restore for subsequent draws
}
