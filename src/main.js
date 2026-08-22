// ============================================================
// src/main.js — Entry point: init scene, start game loop
// ============================================================

import { APERTURE_Y } from './config.js';
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

// --- Source state ---
let sourceX = 0;
let sourceY = APERTURE_Y;

// --- Clock ---
let lastTime = 0;
const MAX_DT = 1 / 30;

export function init() {
  console.log('[Solar Siege] init starting');
  initRenderer();
  initSockets();
  initMirrors();
  updateAllMirrorGeometries();
  initPrisms();
  initBeamRenderer();
  initEnemies();
  initFoundries();
  initCrafting();
  initSession();
  resetSpawner();

  const canvas = getRenderer().domElement;
  initInput(canvas);

  markDirty();

  lastTime = performance.now();
  requestAnimationFrame(loop);
  console.log('[Solar Siege] init complete, loop running');
}

function loop(now) {
  requestAnimationFrame(loop);

  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > MAX_DT) dt = MAX_DT;

  if (isGameOver()) {
    render();
    return;
  }

  // --- Update ---
  updateSession(dt);
  const sessionTime = getElapsed();

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

  // Foundries (resource accumulation)
  updateFoundries(dt);

  // HUD + crafting tray
  updateHud();
  updateCraftingTray();
  tickDebug();

  // --- Render ---
  render();
}

// Boot
init();
