// ============================================================
// src/main.js — Entry point: init scene, start game loop
// ============================================================

import { APERTURE_Y, DEV, SUN_Y } from './config.js';
import { initRenderer, render, getWorldWidth, getRenderer } from './renderer.js';
import { initBeamRenderer, rebuildBeams, updateBeamPulse } from './beam-render.js';
import { solve, isDirty, getSegments, markDirty } from './beam.js';
import { initSockets, initMirrors, updateAllMirrorGeometries, getMirrors, updateMirrorTweens, sanitizeMirrors } from './mirror.js';
import { initPrisms, getPrisms, updatePrismGlow } from './prism.js';
import { initInput, tickDebug } from './input.js';
import { initEnemies, updateEnemies, applySlowStates, getEnemyPool, getLastBreaches } from './enemy.js';
import { updateSpawner, resetSpawner } from './enemy-spawner.js';
import { updateDamage, getKillCount, updateBlockedLabels } from './damage.js';
import { initSession, updateSession, addBreaches, isGameOver, isGameWon, getElapsed, updateHud, handleRestartTap, decayWallFlash, getWallHitFlash, getWallShake, tickWallShake, flashWallBarNotch, triggerWallShake, updateDefeatSequence, updateVictorySequence } from './session.js';
import { initFoundries, updateFoundries, getFoundryColliders, getAltarAudioState } from './foundry.js';
import { initFortress, updateFortress, triggerBreachShake, triggerImpactFlash } from './fortress.js';
import { initCrafting, updateCraftingTray, isZeusAffordable } from './crafting.js';
import { initBackground, updateBackground } from './background.js';
import { initEffects, updateEffects } from './effects.js';
import { initAudio, updateHum, updateBurnHiss, updateAltarTone, updateCrackle, playWallHit, playSinkGlug, resetAudio, updateSeaAmbience } from './audio.js';
import { initZeus, updateZeus, getZeusFlash, getZeusShake, isZeusReady } from './zeus.js';
import { initPoseidon, updatePoseidon } from './poseidon.js';
import { initHelios, updateHelios } from './helios.js';

// --- Source state ---
let sourceX = 0;
let sourceY = SUN_Y;

// --- Clock ---
let lastTime = 0;
const MAX_DT = 1 / 30;

// Throttle for heavy breach feedback (shake/sound/bar-notch) during the drip.
let breachFxTimer = 0;
// One-shot guard so the defeat debris burst fires only on the first over-frame.
let defeatDebrisFired = false;

export function init() {
  console.log('[Burning Glass] init starting');
  initRenderer();
  initBackground();
  initFortress();
  initZeus();
  initPoseidon();
  initHelios();
  initSockets();
  initMirrors();
  updateAllMirrorGeometries();
  initPrisms();
  initBeamRenderer();
  initEnemies();
  initFoundries();
  initCrafting();
  initEffects();
  initAudio();
  initSession();
  resetSpawner();

  const canvas = getRenderer().domElement;
  initInput(canvas);

  markDirty();

  lastTime = performance.now();
  requestAnimationFrame(loop);
  console.log('[Burning Glass] init complete, loop running');

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
    // In-engine defeat: fade in the dark-red dim + stats, keep debris/effects
    // animating, and fire a one-time stone-debris burst on the first frame.
    if (!isGameWon() && !defeatDebrisFired) {
      defeatDebrisFired = true;
      triggerBreachShake(3); // dust/debris + shake
    }
    updateDefeatSequence(dt);
    updateVictorySequence(dt); // gold win fade (no-op unless a victory triggered)
    updateEffects(dt);
    updateFortress(dt);
    updateHud(); // keep HUD visible on end screen
    render(getWallShake());
    return;
  }
  defeatDebrisFired = false;

  // --- Update ---
  updateSession(dt);
  const sessionTime = getElapsed();

  updateBackground(dt);
  updateBeamPulse(dt);
  updateMirrorTweens(dt);
  sanitizeMirrors(); // safety net: recover any out-of-bounds mirror to its slot

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
  updatePrismGlow(getSegments());

  // Spawner + enemies
  updateSpawner(dt, sessionTime);
  applySlowStates();
  const dripDamage = updateEnemies(dt);
  const contacts = getLastBreaches(); // ships currently pressed on the wall
  if (dripDamage > 0) {
    addBreaches(dripDamage); // apply the per-second drip (silent)
    // Continuous localized battlement stone flash under each contacting lane.
    for (const b of contacts) triggerImpactFlash(b.x);
    // Throttle the loud/heavy feedback (shake, sound, bar notch) so the
    // continuous drip doesn't spam a nauseating shake or audio every frame.
    breachFxTimer -= dt;
    if (breachFxTimer <= 0) {
      breachFxTimer = 0.5;
      triggerBreachShake(1); // fortress dust + mesh shake
      triggerWallShake();    // camera shake pulse
      playWallHit();
      flashWallBarNotch();
    }
  }

  // Damage
  updateDamage(dt);
  updateBlockedLabels(dt);

  // Effects (glows, sparks, debris)
  updateEffects(dt);
  decayWallFlash(dt);

  // Fortress visual update (damage stages, shake, dust)
  updateFortress(dt);

  // Audio updates
  const activeEnemyCount = getEnemyPool().filter(e => e.active && e.bandsHitting > 0).length;
  updateBurnHiss(activeEnemyCount / 10);
  updateHum(getSegments().length * 3);

  // Wood crackle: pass burning ships with heat > 0 (exclude shield-blocked)
  const burningShips = getEnemyPool()
    .filter(e => e.active && e.heat > 0 && !e.shieldBlocking)
    .map(e => ({ id: e.mesh.id, heat: e.heat / e.maxHp }));
  updateCrackle(burningShips);

  // Foundries (resource accumulation)
  updateFoundries(dt);

  // Altar audio (tone + overheat pitch drop)
  const altarAudio = getAltarAudioState();
  updateAltarTone(altarAudio.litCount, altarAudio.anyOverheated);

  // Ambient sea breeze + rhythmic wave-wash
  updateSeaAmbience(dt);

  // Zeus ultimate (ready state + strike animation)
  updateZeus(dt, isZeusAffordable());

  // Poseidon whirlpool (lateral pull + slow)
  updatePoseidon(dt);

  // Helios solar overcharge (bloom + faith drip + stun/shield-disable window)
  updateHelios(dt);

  // HUD + crafting tray
  updateHud();
  updateCraftingTray();
  tickDebug(dt);

  // Camera shake from wall damage
  tickWallShake(dt);

  // --- Render ---
  render(getWallShake());
}

// Boot — called by intro layer after video ends (or skip)
// init();
