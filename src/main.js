// ============================================================
// src/main.js — Entry point: init scene, start game loop
// ============================================================

import { APERTURE_Y, DEV } from './config.js';
import { initRenderer, render, getWorldWidth, getRenderer } from './renderer.js';
import { initBeamRenderer, rebuildBeams, updateBeamPulse } from './beam-render.js';
import { solve, isDirty, getSegments, markDirty } from './beam.js';
import { initSockets, initMirrors, updateAllMirrorGeometries, getMirrors, updateMirrorTweens } from './mirror.js';
import { initPrisms, getPrisms } from './prism.js';
import { initInput, tickDebug } from './input.js';
import { initEnemies, updateEnemies, applySlowStates } from './enemy.js';
import { updateSpawner, resetSpawner } from './enemy-spawner.js';
import { updateDamage } from './damage.js';
import { initSession, updateSession, addBreaches, isGameOver, getElapsed, updateHud, handleRestartTap } from './session.js';
import { initFoundries, updateFoundries, getFoundryColliders } from './foundry.js';
import { initCrafting, updateCraftingTray } from './crafting.js';
import { initBackground, updateBackground } from './background.js';
import { initEffects, updateEffects } from './effects.js';

// --- Source state ---
let sourceX = 0;
let sourceY = APERTURE_Y;

// --- Clock ---
let lastTime = 0;
const MAX_DT = 1 / 30;

export function init() {
  console.log('[Solar Siege] init starting');
  initRenderer();
  initBackground();
  initSockets();
  initMirrors();
  updateAllMirrorGeometries();
  initPrisms();
  initBeamRenderer();
  initEnemies();
  initFoundries();
  initCrafting();
  initEffects();
  initSession();
  resetSpawner();

  const canvas = getRenderer().domElement;
  initInput(canvas);

  markDirty();

  lastTime = performance.now();
  requestAnimationFrame(loop);
  console.log('[Solar Siege] init complete, loop running');

  // DEV marker: visible red label if any dev flag is on
  if (Object.values(DEV).some(v => v)) {
    const devLabel = document.createElement('div');
    devLabel.textContent = 'DEV';
    devLabel.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);color:#ff0000;font:bold 14px monospace;z-index:99999;pointer-events:none;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:3px;';
    document.body.appendChild(devLabel);
  }
}

function loop(now) {
  requestAnimationFrame(loop);

  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > MAX_DT) dt = MAX_DT;

  if (isGameOver()) {
    updateHud(); // keep HUD visible on end screen
    render();
    return;
  }

  // --- Update ---
  updateSession(dt);
  const sessionTime = getElapsed();

  updateBackground(dt);
  updateBeamPulse(dt);
  updateMirrorTweens(dt);

  // Beam solve (only on dirty)
  if (isDirty()) {
    const mirrors = getMirrors().filter(m => !m.shattered);
    const prisms = getPrisms();
    const worldWidth = getWorldWidth();
    const fndColliders = getFoundryColliders();
    solve(sourceX, sourceY, mirrors, prisms, worldWidth, fndColliders);
    rebuildBeams(getSegments());
  } else {
    rebuildBeams(getSegments());
  }

  // Spawner + enemies
  updateSpawner(dt, sessionTime);
  applySlowStates();
  const newBreaches = updateEnemies(dt);
  if (newBreaches > 0) {
    addBreaches(newBreaches);
  }

  // Damage
  updateDamage(dt);

  // Effects (glows, sparks, debris)
  updateEffects(dt);

  // Foundries (resource accumulation)
  updateFoundries(dt);

  // HUD + crafting tray
  updateHud();
  updateCraftingTray();
  tickDebug();

  // --- Render ---
  render();
}

// Boot — called by intro layer after video ends (or skip)
// init();
