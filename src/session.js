// ============================================================
// src/session.js — Timer, breach counter, win/lose state, reset
//
// Win: Recombination >= 100% at 15:00, OR Devourer killed.
// Lose: 3 breaches, OR 15:00 with Devourer alive + Recombination < 100%.
// ============================================================

import { SESSION_DURATION, WORLD_HEIGHT, BREACH_Y, DEV } from './config.js';
import { getScene, getWorldWidth, getOverlayScene } from './renderer.js';
import { resetEnemies } from './enemy.js';
import { resetSpawner } from './enemy-spawner.js';
import { resetDamage } from './damage.js';
import { markDirty } from './beam.js';
import { getRecombination, resetFoundries, getSlag, getInsight } from './foundry.js';
import { resetCrafting } from './crafting.js';
import { resetMirrors } from './mirror.js';
import { resetPrisms } from './prism.js';
import { MSG_LOSE, MSG_WIN, RES_SLAG_SHORT, RES_INSIGHT_SHORT, RES_RECOMBO_SHORT } from './strings.js';

let elapsed = 0;
let breaches = 0;
let gameOver = false;
let gameWon = false;
let devourerKilled = false;

const MAX_BREACHES = 3;
const WALL_DISPLAY = 3;

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
  breaches = 0;
  gameOver = false;
  gameWon = false;
  devourerKilled = false;
  createHud();
  createOverlay();
}

export function getElapsed() { return elapsed; }
export function getBreaches() { return breaches; }
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

export function addBreaches(count) {
  if (count <= 0 || gameOver) return;
  if (DEV.INVINCIBLE) return; // dev mode: wall never breaks
  breaches += count;
  if (breaches >= MAX_BREACHES) {
    triggerLose();
  }
}

export function updateHud() {
  if (!hudCtx) return;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const breachStr = '\u2665'.repeat(Math.max(0, MAX_BREACHES - breaches)) + '\u2661'.repeat(Math.min(breaches, MAX_BREACHES));
  const recombo = Math.floor(getRecombination());
  const slagVal = Math.floor(getSlag());
  const insightVal = Math.floor(getInsight());

  hudCtx.clearRect(0, 0, 512, 64);
  // Timer (top-left)
  hudCtx.fillStyle = elapsed >= 720 ? '#ff4444' : '#ffffff';
  hudCtx.font = 'bold 26px monospace';
  hudCtx.textAlign = 'left';
  hudCtx.fillText(timeStr, 8, 22);
  // Hearts (top-right)
  hudCtx.textAlign = 'right';
  hudCtx.fillStyle = '#ff4444';
  hudCtx.font = '22px monospace';
  hudCtx.fillText(breachStr, 504, 22);
  // Resources (bottom row)
  hudCtx.font = '16px monospace';
  hudCtx.textAlign = 'left';
  hudCtx.fillStyle = '#ff8c1a';
  hudCtx.fillText(`${RES_SLAG_SHORT}:${slagVal}`, 8, 52);
  hudCtx.fillStyle = '#00ddff';
  hudCtx.fillText(`${RES_INSIGHT_SHORT}:${insightVal}`, 110, 52);
  hudCtx.fillStyle = '#ffe9a0';
  hudCtx.fillText(`${RES_RECOMBO_SHORT}:${recombo}%`, 210, 52);

  hudTexture.needsUpdate = true;
}

export function resetSession() {
  elapsed = 0;
  breaches = 0;
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
  showOverlay(MSG_WIN);
}

function triggerLose() {
  gameOver = true;
  gameWon = false;
  onEndState();
  showOverlay(MSG_LOSE);
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
