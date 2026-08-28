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
    { id: 'mirror', label: 'Mirror', getCost: () => ({ bronze: SHOP.mirror.bronze + mirrorsBought * SHOP.mirror.scaling }) },
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

    // ---- Ready-state pulse glow --------------------------------------------
    // When a button is affordable AND actionable, wrap it in a continuously
    // pulsing bright border so the player can't miss that the ability is ready.
    // This is the in-canvas equivalent of a CSS keyframe border-glow. Zeus keeps
    // its dedicated gold treatment; every other ready button pulses green so it
    // reads as "go". The pulse is a slow sine (kept subtle so it never fights
    // the playfield) that drives both the border brightness and an outer
    // shadowBlur halo.
    const readyPulse = affordable && !zeusGlow;
    if (readyPulse) {
      // 0..1 slow sine (~1.4 Hz). Phase-offset per button so the row shimmers
      // rather than strobing in unison.
      const phase = Math.sin(Date.now() * 0.009 + i * 0.7) * 0.5 + 0.5;
      const glowCol = '#4EFE82';             // bright "ready" green
      trayCtx.save();
      trayCtx.strokeStyle = glowCol;
      trayCtx.shadowColor = glowCol;
      trayCtx.shadowBlur = 4 + phase * 8;    // breathing outer halo
      trayCtx.lineWidth = 2 + phase * 1.5;   // 2..3.5px breathing border
      trayCtx.globalAlpha = 0.65 + phase * 0.35;
      trayCtx.strokeRect(x + 2, 2, btnW - 4, 36);
      trayCtx.restore();
    }

    // Base border (drawn on top so the crisp edge stays sharp over the glow)
    trayCtx.strokeStyle = borderCol;
    trayCtx.lineWidth = zeusGlow ? 3 : (pulsing ? 2.5 : (affordable ? 1.5 : 0.5));
    trayCtx.strokeRect(x + 1, 1, btnW - 2, 38);

    // Clip text to this button cell so labels can never bleed into neighbours
    trayCtx.save();
    trayCtx.beginPath();
    trayCtx.rect(x + 1, 1, btnW - 2, 38);
    trayCtx.clip();

    const cxc = x + btnW / 2;
    const iconTint = (affordable || zeusGlow) ? '#ffffff' : '#888888';
    const hasIcon = (item.id === 'zeus' || item.id === 'helios' || item.id === 'poseidon');
    // God abilities get a vector icon at the top, then name, then cost — so the
    // three rows are: icon (y~8), name (y~20), cost (y~31). Non-ability items
    // keep the classic name (y~13) + cost (y~27) layout.
    if (hasIcon) {
      drawAbilityIcon(item.id, cxc, 8, 8, iconTint);
    }

    // Kill any inherited shadow before drawing text. The ready-pulse glow above
    // sets shadowBlur inside a save/restore, but we belt-and-suspenders clear it
    // here so glyphs never pick up a green halo that reads as a ghost/double.
    trayCtx.shadowBlur = 0;
    trayCtx.shadowColor = 'transparent';

    // Wipe the name band back to the flat button background before drawing it,
    // matching the cost-band wipe below, so no sub-label can ever ghost/stack.
    const nameY = hasIcon ? 20 : 13;
    trayCtx.fillStyle = bgColour;
    trayCtx.fillRect(x + 1, nameY - 8, btnW - 2, 11);

    trayCtx.fillStyle = (affordable || zeusGlow) ? '#ffffff' : '#777777';
    trayCtx.font = 'bold 8px monospace';
    trayCtx.textAlign = 'center';
    trayCtx.fillText(item.label, cxc, nameY);

    // Cost line — but ONLY when the button is NOT on cooldown. During cooldown
    // the radial timer draws its own "Ns" in the same spot; showing both stacks
    // the two strings, so we show one or the other, never both.
    if (!onCooldown) {
      // Wipe the cost-text band back to the flat button background first, so a
      // multi-token cost (e.g. Helios "15Si 20Bz") can never leave a ghosted /
      // stacked remnant from a wider previous string or the glow halo. We're
      // already clipped to this button cell, so this only repaints its own row.
      const costY = hasIcon ? 31 : 27;
      trayCtx.fillStyle = bgColour;
      trayCtx.fillRect(x + 1, costY - 8, btnW - 2, 12);
      drawCostTokens(cost, res, faith, cxc, costY, btnW);
    }

    trayCtx.restore();

    // Radial cooldown overlay for god powers
    let cooldownFrac = 0;
    let cooldownTotal = 0;
    if (item.id === 'zeus' && zeusCooldown > 0) { cooldownFrac = zeusCooldown / ZEUS_COOLDOWN_TIME; cooldownTotal = ZEUS_COOLDOWN_TIME; }
    if (item.id === 'poseidon' && poseidonCooldown > 0) { cooldownFrac = poseidonCooldown / POSEIDON_COOLDOWN_TIME; cooldownTotal = POSEIDON_COOLDOWN_TIME; }
    if (item.id === 'helios' && heliosCooldown > 0) { cooldownFrac = heliosCooldown / HELIOS_COOLDOWN_TIME; cooldownTotal = HELIOS_COOLDOWN_TIME; }
    if (cooldownFrac > 0) {
      // Dark radial wipe (pie slice from top, clockwise), CLIPPED to this
      // button cell and sized so it never spills past the button into the bar
      // below the battlement. Radius kept within the button half-height.
      const cx = x + btnW / 2;
      const cy = 20;
      const r = 15; // < half the 38px button height, stays inside the cell
      trayCtx.save();
      // Clip strictly to the button rect so the arc can never bleed outside it.
      trayCtx.beginPath();
      trayCtx.rect(x + 1, 1, btnW - 2, 38);
      trayCtx.clip();
      trayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      trayCtx.beginPath();
      trayCtx.moveTo(cx, cy);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + cooldownFrac * Math.PI * 2;
      trayCtx.arc(cx, cy, r, startAngle, endAngle);
      trayCtx.closePath();
      trayCtx.fill();
      // Cooldown seconds text, centred on the button (no cost shown while cooling).
      trayCtx.fillStyle = '#ffffff';
      trayCtx.font = 'bold 11px monospace';
      trayCtx.textAlign = 'center';
      trayCtx.textBaseline = 'middle';
      trayCtx.fillText(Math.ceil(cooldownFrac * cooldownTotal) + 's', cx, 22);
      trayCtx.textBaseline = 'alphabetic';
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
  const labels = { bronze: 'Bz', silver: 'Si', gold: 'Au', faith: 'Fa' };
  const parts = [];
  for (const k in cost) {
    parts.push(cost[k] + (labels[k] || k[0]));
  }
  return parts.join(' ');
}

// Draw the cost as separate tokens, centred at (centreX, y). Tokens the player
// can afford render light; tokens they can't afford render red so it's obvious
// which currency is short.
// Draw a small vector icon for a god ability, centred at (cx, cy) on the tray
// canvas. `s` is the icon half-extent (px). `col` is the stroke/fill colour.
function drawAbilityIcon(id, cx, cy, s, col) {
  trayCtx.save();
  trayCtx.strokeStyle = col;
  trayCtx.fillStyle = col;
  trayCtx.lineJoin = 'round';
  trayCtx.lineCap = 'round';
  if (id === 'zeus') {
    // Lightning bolt: a filled zig-zag.
    trayCtx.beginPath();
    trayCtx.moveTo(cx + s * 0.35, cy - s);
    trayCtx.lineTo(cx - s * 0.5, cy + s * 0.15);
    trayCtx.lineTo(cx - s * 0.02, cy + s * 0.15);
    trayCtx.lineTo(cx - s * 0.35, cy + s);
    trayCtx.lineTo(cx + s * 0.55, cy - s * 0.2);
    trayCtx.lineTo(cx + s * 0.05, cy - s * 0.2);
    trayCtx.closePath();
    trayCtx.fill();
  } else if (id === 'helios') {
    // Radiant sun: filled disc + 8 rays.
    trayCtx.lineWidth = 1.3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      trayCtx.beginPath();
      trayCtx.moveTo(cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.7);
      trayCtx.lineTo(cx + Math.cos(a) * s * 1.15, cy + Math.sin(a) * s * 1.15);
      trayCtx.stroke();
    }
    trayCtx.beginPath();
    trayCtx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
    trayCtx.fill();
  } else if (id === 'poseidon') {
    // Classic Greek trident: three pointed tines curving UP from a central
    // staff. Coordinates are measured from the button top so the tine tips keep
    // ~6px padding below the border (button top is y≈1 → tips at ~y7).
    trayCtx.lineWidth = 1.3;
    const tipY = 7;                 // outer tine tips (≈6px below the border)
    const crossY = tipY + s * 0.7;  // where the outer tines curve back to
    const midTipY = 6;              // centre tine tip (kept ≥6px from border)
    const baseY = 17;               // staff ends above the name row (y≈20)
    const spread = s * 0.8;         // half-distance between outer tines
    // Central staff + centre tine
    trayCtx.beginPath();
    trayCtx.moveTo(cx, midTipY);
    trayCtx.lineTo(cx, baseY);
    // Left tine: curves outward then up to a point
    trayCtx.moveTo(cx, crossY);
    trayCtx.quadraticCurveTo(cx - spread, crossY, cx - spread, tipY);
    // Right tine
    trayCtx.moveTo(cx, crossY);
    trayCtx.quadraticCurveTo(cx + spread, crossY, cx + spread, tipY);
    trayCtx.stroke();
    // Small pointed barbs at each tine tip for the "spear" read.
    trayCtx.beginPath();
    for (const tx of [cx - spread, cx, cx + spread]) {
      const ty = (tx === cx) ? midTipY : tipY;
      trayCtx.moveTo(tx - 1, ty + 1.5);
      trayCtx.lineTo(tx, ty - 0.5);
      trayCtx.lineTo(tx + 1, ty + 1.5);
    }
    trayCtx.stroke();
  }
  trayCtx.restore();
}

const COST_LABELS = { bronze: 'Bz', silver: 'Si', gold: 'Au', faith: 'Fa' };
const COST_SEP = ' + '; // explicit separator, e.g. "15Si + 20Bz"
// Draw the cost as clean colour-coded tokens on ONE line joined by " + ", e.g.
// "15Si + 20Bz". Affordable currencies render light; short ones render red so
// it's obvious which is missing. The separator is a dim neutral glyph drawn as
// its own segment so spacing stays exact. The whole line is auto-shrunk to fit
// the button width so it never overflows, wraps, or leaves fragments from a
// previous state (the caller also wipes the cost band each frame).
function drawCostTokens(cost, res, faith, centreX, y, btnW) {
  // Build tokens (compact "15Si" form).
  const tokens = [];
  for (const k in cost) {
    const have = (k === 'faith') ? faith : (res[k] || 0);
    tokens.push({ text: cost[k] + (COST_LABELS[k] || k[0]), ok: have >= cost[k] });
  }
  if (tokens.length === 0) return;

  const maxW = btnW - 10; // keep a clear margin from the button edges

  // Find the largest font (<=8px) at which the whole "A + B" line fits maxW.
  let fontPx = 8;
  const measureTotal = () => {
    trayCtx.font = 'bold ' + fontPx + 'px monospace';
    let w = 0;
    for (let t = 0; t < tokens.length; t++) {
      w += trayCtx.measureText(tokens[t].text).width;
      if (t < tokens.length - 1) w += trayCtx.measureText(COST_SEP).width;
    }
    return w;
  };
  let totalW = measureTotal();
  while (totalW > maxW && fontPx > 5.5) { fontPx -= 0.5; totalW = measureTotal(); }

  trayCtx.textAlign = 'left';
  let cx = centreX - totalW / 2;
  for (let t = 0; t < tokens.length; t++) {
    trayCtx.fillStyle = tokens[t].ok ? '#dddddd' : '#ff5555';
    trayCtx.fillText(tokens[t].text, cx, y);
    cx += trayCtx.measureText(tokens[t].text).width;
    if (t < tokens.length - 1) {
      // Dim neutral "+" separator between currencies.
      trayCtx.fillStyle = '#999999';
      trayCtx.fillText(COST_SEP, cx, y);
      cx += trayCtx.measureText(COST_SEP).width;
    }
  }
  trayCtx.textAlign = 'center'; // restore for subsequent draws
}
