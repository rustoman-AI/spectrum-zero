// ============================================================
// src/session.js — Timer, breach counter, win/lose state, reset
//
// Win: Recombination >= 100% at 15:00, OR Devourer killed.
// Lose: 3 breaches, OR 15:00 with Devourer alive + Recombination < 100%.
// ============================================================

import { SESSION_DURATION, WORLD_HEIGHT, WALL_Y, DEV, WALL_MAX_HP } from './config.js';
import { getScene, getWorldWidth, getOverlayScene } from './renderer.js';
import { resetEnemies } from './enemy.js';
import { resetSpawner } from './enemy-spawner.js';
import { resetDamage } from './damage.js';
import { markDirty } from './beam.js';
import { getResources, resetFoundries, getFaith } from './foundry.js';
import { resetCrafting } from './crafting.js';
import { resetMirrors } from './mirror.js';
import { resetPrisms, resetTier } from './prism.js';
import { MSG_LOSE, MSG_WIN, RES_SLAG_SHORT, RES_INSIGHT_SHORT, RES_RECOMBO_SHORT } from './strings.js';

let elapsed = 0;
let wallIntegrity = 100; // wall HP, starts at 100
let gameOver = false;
let gameWon = false;
let devourerKilled = false;


// HUD
let hudCanvas = null;
let hudCtx = null;
let hudTexture = null;
let hudMesh = null;

// Overlay
let overlayMesh = null;
let overlayCanvas = null;
let overlayCtx = null;
let overlayTexture = null;
let dimMesh = null;

export function initSession() {
  elapsed = 0;
  wallIntegrity = WALL_MAX_HP;
  gameOver = false;
  gameWon = false;
  devourerKilled = false;
  createHud();
  createOverlay();
}

export function getElapsed() { return elapsed; }
export function getBreaches() { return Math.floor(WALL_MAX_HP - wallIntegrity); }
export function getWallIntegrity() { return wallIntegrity; }
export function isGameOver() { return gameOver; }
export function isGameWon() { return gameWon; }
export function notifyDevourerKilled() { devourerKilled = true; }

export function updateSession(dt) {
  if (gameOver) return;
  elapsed += dt;

  // Check win/lose at session end
  if (elapsed >= SESSION_DURATION) {
    const recombo = getRecombination();
    if (recombo >= 100 || devourerKilled) {
      triggerWin();
    } else {
      triggerLose();
    }
  }

  // Devourer killed mid-session is also a win
  if (devourerKilled && !gameOver) {
    triggerWin();
  }
}

export function addBreaches(damage) {
  if (damage <= 0 || gameOver) return;
  if (DEV.INVINCIBLE) return;
  wallIntegrity = Math.max(0, wallIntegrity - damage);
  // Wall hit feedback: red edge flash
  wallHitFlash = 0.3;
  if (wallIntegrity <= 0) {
    triggerLose();
  }
}

let wallHitFlash = 0;
export function getWallHitFlash() { return wallHitFlash; }
export function decayWallFlash(dt) { if (wallHitFlash > 0) wallHitFlash -= dt; }

export function updateHud() {
  if (!hudCtx) return;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const res = getResources();

  hudCtx.clearRect(0, 0, 512, 64);
  // Timer (top-left)
  hudCtx.fillStyle = elapsed >= 480 ? '#ff4444' : '#ffffff';
  hudCtx.font = 'bold 24px monospace';
  hudCtx.textAlign = 'left';
  hudCtx.fillText(timeStr, 8, 20);
  // Wall (top-right)
  hudCtx.textAlign = 'right';
  hudCtx.fillStyle = wallIntegrity > 30 ? '#ffffff' : '#ff4444';
  hudCtx.font = '18px monospace';
  hudCtx.fillText('Wall:' + Math.ceil(wallIntegrity) + '%', 504, 20);
  // Resources (bottom row)
  hudCtx.font = '13px monospace';
  hudCtx.textAlign = 'left';
  hudCtx.fillStyle = '#ccaa44';
  hudCtx.fillText('Br:' + Math.floor(res.brass), 8, 48);
  hudCtx.fillStyle = '#cc8833';
  hudCtx.fillText('Bz:' + Math.floor(res.bronze), 100, 48);
  hudCtx.fillStyle = '#cccccc';
  hudCtx.fillText('Si:' + Math.floor(res.silver), 195, 48);
  hudCtx.fillStyle = '#ffdd00';
  hudCtx.fillText('Au:' + Math.floor(res.gold), 285, 48);
  hudCtx.fillStyle = '#aa88ff';
  hudCtx.fillText('F:' + Math.floor(getFaith()), 370, 48);

  hudTexture.needsUpdate = true;
}

export function resetSession() {
  elapsed = 0;
  wallIntegrity = WALL_MAX_HP;
  gameOver = false;
  gameWon = false;
  devourerKilled = false;
  resetEnemies();
  resetSpawner();
  resetDamage();
  resetFoundries();
  resetCrafting();
  resetMirrors();
  resetPrisms();
  resetTier();
  markDirty();
  hideOverlay();
  // Restore visibility hidden on end state
  if (typeof setBeamsVisible === 'function') setBeamsVisible(true);
  if (trayMesh) trayMesh.visible = true;
  if (hudMesh) hudMesh.visible = true;
}

function triggerWin() {
  gameOver = true;
  gameWon = true;
  onEndState();
  // Play win cinematic, then show overlay
  if (typeof window !== 'undefined' && window.playWinCinematic) {
    window.playWinCinematic(function() { showOverlay(MSG_WIN); });
  } else {
    showOverlay(MSG_WIN);
  }
}

function triggerLose() {
  gameOver = true;
  gameWon = false;
  onEndState();
  // Play defeat cinematic (once per session), then show overlay
  if (typeof window !== 'undefined' && window.playDefeatCinematic) {
    window.playDefeatCinematic(function() { showOverlay(MSG_LOSE); });
  } else {
    showOverlay(MSG_LOSE);
  }
}

// Called when game ends — hide beams, craft tray
function onEndState() {
  if (typeof setBeamsVisible === 'function') setBeamsVisible(false);
  if (trayMesh) trayMesh.visible = false;
  if (hudMesh) hudMesh.visible = false;
}

// --- HUD ---

function createHud() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 512 * dpr;
  hudCanvas.height = 64 * dpr;
  hudCtx = hudCanvas.getContext('2d');
  hudCtx.scale(dpr, dpr);

  hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.minFilter = THREE.LinearFilter;

  const hudGeo = new THREE.PlaneGeometry(worldWidth * 0.95, 7);
  const hudMat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    depthWrite: false
  });
  hudMesh = new THREE.Mesh(hudGeo, hudMat);
  hudMesh.position.set(0, WORLD_HEIGHT / 2 - 5, 0);
  oScene.add(hudMesh);
}

// --- Overlay ---

function createOverlay() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();

  const dimGeo = new THREE.PlaneGeometry(worldWidth * 1.2, WORLD_HEIGHT * 1.2);
  const dimMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  dimMesh = new THREE.Mesh(dimGeo, dimMat);
  dimMesh.position.set(0, 0, 0);
  dimMesh.visible = false;
  oScene.add(dimMesh);

  overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = 256;
  overlayCanvas.height = 128;
  overlayCtx = overlayCanvas.getContext('2d');

  overlayTexture = new THREE.CanvasTexture(overlayCanvas);
  overlayTexture.minFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(worldWidth * 0.8, 30);
  const mat = new THREE.MeshBasicMaterial({
    map: overlayTexture,
    transparent: true,
    depthWrite: false
  });
  overlayMesh = new THREE.Mesh(geo, mat);
  overlayMesh.position.set(0, 5, 1);
  overlayMesh.visible = false;
  oScene.add(overlayMesh);
}

function showOverlay(text) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.fillStyle = gameWon ? '#00ff88' : '#ff4444';
  overlayCtx.font = 'bold 22px monospace';
  overlayCtx.textAlign = 'center';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    overlayCtx.fillText(lines[i], 128, 40 + i * 28);
  }
  overlayTexture.needsUpdate = true;
  overlayMesh.visible = true;
  dimMesh.visible = true;
}

function hideOverlay() {
  if (overlayMesh) overlayMesh.visible = false;
  if (dimMesh) dimMesh.visible = false;
}

export function handleRestartTap() {
  if (gameOver) {
    resetSession();
  }
}
