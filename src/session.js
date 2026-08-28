// ============================================================
// src/session.js — Timer, breach counter, win/lose state, reset
//
// Win: Recombination >= 100% at 15:00, OR Devourer killed.
// Lose: 3 breaches, OR 15:00 with Devourer alive + Recombination < 100%.
// ============================================================

import { SESSION_DURATION, VICTORY_TIME, VICTORY_KILLS, WORLD_HEIGHT, WALL_Y, DEV, WALL_MAX_HP } from './config.js';
import { getScene, getWorldWidth, getOverlayScene } from './renderer.js';
import { resetEnemies, getEnemyPool, deactivateEnemy } from './enemy.js';
import { resetSpawner } from './enemy-spawner.js';
import { resetDamage, getKillCount } from './damage.js';
import { markDirty } from './beam.js';
import { getResources, resetFoundries, getFaith } from './foundry.js';
import { resetCrafting } from './crafting.js';
import { resetMirrors } from './mirror.js';
import { resetPrisms, resetTier } from './prism.js';
import { resetEffects, spawnDestruction } from './effects.js';
import { resetAudio, silenceBattleAudio, playVictoryFanfare } from './audio.js';
import { resetZeus } from './zeus.js';
import { resetPoseidon } from './poseidon.js';
import { resetHelios } from './helios.js';
import { resetInput } from './input.js';
import { resetTutorial } from './tutorial.js';
import { MSG_LOSE, RES_SLAG_SHORT, RES_INSIGHT_SHORT, RES_RECOMBO_SHORT } from './strings.js';

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
let wallFlashMesh = null; // full-screen red flash on wall damage

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

  // --- Primary victory: survive to VICTORY_TIME (3:00) with the wall intact,
  // or the VICTORY_KILLS fleet-clear fallback (set far above what spawns in the
  // window, so surviving the timer is the real win path). Checked first so it
  // wins the frame over the long-form session-end logic.
  if (wallIntegrity > 0 && (elapsed >= VICTORY_TIME || getKillCount() >= VICTORY_KILLS)) {
    triggerWin();
    return;
  }

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
  // Keep a gentle red screen flash topped up while damage drips in. Camera
  // shake / sound / bar-notch are driven (throttled) from the main loop so the
  // continuous drip doesn't shake the screen every frame.
  wallHitFlash = Math.max(wallHitFlash, 0.18);
  if (wallIntegrity <= 0) {
    triggerLose();
  }
}

// --- Camera shake on wall damage ---
let wallShakeTimer = 0;
let wallShakeIntensity = 0;
const WALL_SHAKE_DURATION = 0.35;
export function getWallShake() {
  if (wallShakeTimer <= 0) return { x: 0, y: 0 };
  const t = wallShakeTimer / WALL_SHAKE_DURATION; // 1 -> 0 envelope
  return {
    x: (Math.random() - 0.5) * wallShakeIntensity * t,
    y: (Math.random() - 0.5) * wallShakeIntensity * 0.6 * t,
  };
}
export function tickWallShake(dt) { if (wallShakeTimer > 0) wallShakeTimer -= dt; }
// Trigger a camera shake pulse (called throttled from the main loop on wall
// impact). Intensity is cut ~70% from the old value for a subtle thud; it only
// grows toward the old feel when the wall is critical (<25%).
export function triggerWallShake() {
  wallShakeTimer = WALL_SHAKE_DURATION;
  const critical = (wallIntegrity / WALL_MAX_HP) < 0.25;
  wallShakeIntensity = critical ? 0.9 : 0.48; // was 1.6 (subtle thud, stronger only when critical)
}

// Quick notch flash on the wall bar when the wall takes a hit.
let wallBarNotch = 0;
export function flashWallBarNotch() { wallBarNotch = 0.35; }

let wallHitFlash = 0;
export function getWallHitFlash() { return wallHitFlash; }
export function decayWallFlash(dt) {
  if (wallHitFlash > 0) wallHitFlash -= dt;
  if (wallBarNotch > 0) wallBarNotch -= dt;
  // Drive the red screen flash: subtle, peaks ~0.32 and fades with wallHitFlash.
  if (wallFlashMesh) {
    const a = Math.max(0, wallHitFlash) / 0.3; // 0..1 over the flash life
    wallFlashMesh.material.opacity = a * 0.32;
    wallFlashMesh.visible = a > 0.001;
  }
}

// Draw the Wall Integrity health bar centred at the top of the HUD strip.
// Green >50%, amber 25-50%, pulsing red <25%.
function drawWallBar() {
  const frac = Math.max(0, Math.min(1, wallIntegrity / WALL_MAX_HP));
  // Bar geometry within the 512x64 HUD canvas (top-centre).
  const barW = 230, barH = 16;
  const bx = 256 - barW / 2;  // centred horizontally
  const by = 6;

  // Colour state
  let fill, glow;
  if (frac > 0.5) { fill = '#3ad14a'; glow = null; }              // green
  else if (frac > 0.25) { fill = '#e0a92a'; glow = null; }        // amber
  else {
    // Pulsing red under 25%
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.012);
    const r = Math.floor(200 + 55 * pulse);
    fill = `rgb(${r},40,40)`;
    glow = `rgba(255,60,60,${0.4 * pulse})`;
  }

  // Track (dark rounded rect)
  hudCtx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(hudCtx, bx - 2, by - 2, barW + 4, barH + 4, 4);
  hudCtx.fill();

  // Optional glow behind a critical bar
  if (glow) {
    hudCtx.save();
    hudCtx.shadowColor = glow;
    hudCtx.shadowBlur = 12;
    hudCtx.fillStyle = fill;
    roundRect(hudCtx, bx, by, Math.max(0, barW * frac), barH, 3);
    hudCtx.fill();
    hudCtx.restore();
  } else {
    hudCtx.fillStyle = fill;
    roundRect(hudCtx, bx, by, Math.max(0, barW * frac), barH, 3);
    hudCtx.fill();
  }

  // Quick notch flash across the bar when the wall was just hit
  if (wallBarNotch > 0) {
    const a = (wallBarNotch / 0.35) * 0.6;
    hudCtx.fillStyle = `rgba(255,255,255,${a})`;
    roundRect(hudCtx, bx, by, barW * frac, barH, 3);
    hudCtx.fill();
  }

  // Border
  hudCtx.strokeStyle = 'rgba(255,255,255,0.5)';
  hudCtx.lineWidth = 1.5;
  roundRect(hudCtx, bx, by, barW, barH, 3);
  hudCtx.stroke();

  // "WALL" label just left of the bar
  hudCtx.fillStyle = '#cfd8e0';
  hudCtx.font = 'bold 11px monospace';
  hudCtx.textAlign = 'right';
  hudCtx.textBaseline = 'middle';
  hudCtx.fillText('WALL', bx - 8, by + barH / 2 + 1);

  // Percentage text centred on the bar
  hudCtx.fillStyle = '#ffffff';
  hudCtx.font = 'bold 12px monospace';
  hudCtx.textAlign = 'center';
  hudCtx.fillText(Math.ceil(wallIntegrity) + '%', 256, by + barH / 2 + 1);
  hudCtx.textBaseline = 'alphabetic';
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

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

  // --- Wall Integrity: primary health bar (top-centre) ---
  drawWallBar();

  // Resource row (bottom): 3 metals + Faith, as one clean, evenly balanced
  // row — Bz / Si / Gd / Fa — each centred in its quarter of the 512px bar.
  // Gaming abbreviations (Gd for gold, not the chemical "Au"). No debug hint
  // text: ability cost recipes live exclusively on the shop buttons now.
  const faithVal = Math.floor(getFaith());
  const cells = [
    { label: 'Bz:', val: Math.floor(res.bronze), col: '#cc8833' },
    { label: 'Si:', val: Math.floor(res.silver), col: '#cccccc' },
    { label: 'Gd:', val: Math.floor(res.gold),   col: '#ffdd00' },
    { label: 'Fa:', val: faithVal,               col: '#aa88ff' },
  ];
  hudCtx.font = 'bold 14px monospace';
  hudCtx.textAlign = 'center';
  const cellW = 512 / cells.length;
  for (let c = 0; c < cells.length; c++) {
    const cx = cellW * (c + 0.5);
    const isFaith = c === 3;
    hudCtx.fillStyle = cells[c].col;
    // Faith gets a soft purple glow when the player actually has some, to hint
    // (without words) that it's a special resource worth spending on the gods.
    if (isFaith && faithVal > 0) {
      hudCtx.save();
      hudCtx.shadowColor = '#aa88ff';
      hudCtx.shadowBlur = 6;
      hudCtx.fillText(cells[c].label + cells[c].val, cx, 48);
      hudCtx.restore();
    } else {
      hudCtx.fillText(cells[c].label + cells[c].val, cx, 48);
    }
  }

  hudTexture.needsUpdate = true;
}

export function resetSession() {
  // Hide overlay FIRST — before any reset that could throw and abort the chain
  hideOverlay();
  elapsed = 0;
  wallIntegrity = WALL_MAX_HP;
  gameOver = false;
  gameWon = false;
  devourerKilled = false;
  wallHitFlash = 0;
  wallShakeTimer = 0;
  wallBarNotch = 0;
  defeatActive = false;
  defeatT = 0;
  victoryActive = false;
  victoryT = 0;
  if (dimMesh) dimMesh.material.color.setHex(0x000000); // restore neutral dim
  if (wallFlashMesh) { wallFlashMesh.material.opacity = 0; wallFlashMesh.visible = false; }
  // Each reset wrapped so one failure can't leave the overlay stuck
  try { resetEnemies(); } catch (e) { console.error('resetEnemies', e); }
  try { resetSpawner(); } catch (e) { console.error('resetSpawner', e); }
  try { resetDamage(); } catch (e) { console.error('resetDamage', e); }
  try { resetFoundries(); } catch (e) { console.error('resetFoundries', e); }
  try { resetCrafting(); } catch (e) { console.error('resetCrafting', e); }
  try { resetMirrors(); } catch (e) { console.error('resetMirrors', e); }
  try { resetPrisms(); } catch (e) { console.error('resetPrisms', e); }
  try { resetTier(); } catch (e) { console.error('resetTier', e); }
  try { resetEffects(); } catch (e) { console.error('resetEffects', e); }
  try { resetAudio(); } catch (e) { console.error('resetAudio', e); }
  try { resetZeus(); } catch (e) { console.error('resetZeus', e); }
  try { resetPoseidon(); } catch (e) { console.error('resetPoseidon', e); }
  try { resetHelios(); } catch (e) { console.error('resetHelios', e); }
  try { resetInput(); } catch (e) { console.error('resetInput', e); }
  try { resetTutorial(); } catch (e) { console.error('resetTutorial', e); }
  markDirty();
  // Restore visibility + opacity faded out on the end screen
  if (typeof setBeamsVisible === 'function') setBeamsVisible(true);
  if (trayMesh) { trayMesh.visible = true; trayMesh.material.opacity = 1; }
  if (hudMesh) { hudMesh.visible = true; hudMesh.material.opacity = 1; }
}

function triggerWin() {
  gameOver = true;
  gameWon = true;
  onEndState();
  // Concluding fleet wipe: any ship still on the water at the moment of victory
  // is burst with a bright flash + debris, so the board reads "cleared/defended"
  // rather than leaving stray hulls sitting under the gold card.
  try {
    const pool = getEnemyPool();
    for (const e of pool) {
      if (!e.active) continue;
      const heavy = !!(e.type && (e.type === 'quadrireme' || e.type === 'flagship' || e.type === 'shieldbearer'));
      spawnDestruction(e.mesh.position.x, e.mesh.position.y, heavy);
      deactivateEnemy(e);
    }
  } catch (err) { console.error('victory fleet wipe', err); }
  // Fully in-engine victory: no video. Extinguish beams (onEndState), tint the
  // board gold, sound the fanfare, then fade in the gold stats card — mirroring
  // the defeat sequence layout so both end states feel consistent.
  try { playVictoryFanfare(); } catch (e) { console.error('playVictoryFanfare', e); }
  startVictorySequence();
}

function triggerLose() {
  gameOver = true;
  gameWon = false;
  onEndState();
  // Fully in-engine defeat: NO video. Extinguish beams (onEndState), dim the
  // board to dark red, throw stone debris, then fade in the stats overlay.
  startDefeatSequence();
}

// --- In-engine defeat sequence ---
let defeatT = 0;          // animation clock
let defeatActive = false;
export function isDefeatSequenceActive() { return defeatActive; }

// --- In-engine victory sequence (gold sibling of the defeat fade) ---
let victoryT = 0;
let victoryActive = false;
export function isVictorySequenceActive() { return victoryActive; }

function startVictorySequence() {
  victoryActive = true;
  victoryT = 0;
  // Warm gold board tint fades in (dimMesh recoloured for victory).
  if (dimMesh) {
    dimMesh.material.color.setHex(0x2a1d02); // deep warm gold-brown
    dimMesh.material.opacity = 0;
    dimMesh.visible = true;
    if (dimMesh.parent == null) getOverlayScene().add(dimMesh);
  }
  // Prepare the overlay text but keep it transparent for the fade-in.
  prepareVictoryOverlay();
}

// Advance the victory fade-in each frame (called from the main loop while over).
export function updateVictorySequence(dt) {
  if (!victoryActive) return;
  victoryT += dt;
  // Gold dim fades in over ~0.8s to a moderate tint (lighter than defeat so the
  // burning fleet stays visible and celebratory rather than funereal).
  const dimProgress = Math.min(1, victoryT / 0.8);
  if (dimMesh) {
    dimMesh.material.opacity = dimProgress * 0.78;
  }
  // Smoothly fade the HUD + shop tray out in step with the dim.
  fadeEndUi(dimProgress);
  // Stats overlay fades in after a short beat (0.5s), over ~0.7s.
  if (overlayMesh) {
    const a = Math.max(0, Math.min(1, (victoryT - 0.5) / 0.7));
    overlayMesh.material.opacity = a;
    overlayMesh.visible = a > 0.001;
  }
}

function startDefeatSequence() {
  defeatActive = true;
  defeatT = 0;
  // Dark-red board dim fades in (dimMesh recoloured for defeat).
  if (dimMesh) {
    dimMesh.material.color.setHex(0x330505);
    dimMesh.material.opacity = 0;
    dimMesh.visible = true;
    if (dimMesh.parent == null) getOverlayScene().add(dimMesh);
  }
  // (Stone debris burst is fired from the main loop, which owns fortress.)
  // Prepare the overlay text but keep it transparent for the fade-in.
  prepareDefeatOverlay();
}

// Advance the defeat fade-in each frame (called from the main loop while over).
export function updateDefeatSequence(dt) {
  if (!defeatActive) return;
  defeatT += dt;
  // Dark-red dim fades in over ~0.8s to a heavy tint.
  const dimProgress = Math.min(1, defeatT / 0.8);
  if (dimMesh) {
    dimMesh.material.opacity = dimProgress * 0.88;
  }
  // Smoothly fade the HUD + shop tray out in step with the dim.
  fadeEndUi(dimProgress);
  // Stats overlay fades in after a short beat (0.5s), over ~0.7s.
  if (overlayMesh) {
    const a = Math.max(0, Math.min(1, (defeatT - 0.5) / 0.7));
    overlayMesh.material.opacity = a;
    overlayMesh.visible = a > 0.001;
  }
}

// Called when game ends — extinguish beams, cut battle audio loops. The HUD and
// shop tray are NOT hard-hidden here anymore: they stay on screen and are faded
// out smoothly (see fadeEndUi) as the dim tint rises, so the board darkens over
// live gameplay instead of the UI blinking off a frame before the fade starts.
function onEndState() {
  if (typeof setBeamsVisible === 'function') setBeamsVisible(false);
  // Immediately silence beam hum / burn hiss / altar tone / crackle so only
  // the defeat (or win) sound is heard the instant the wall falls.
  try { silenceBattleAudio(); } catch (e) { console.error('silenceBattleAudio', e); }
}

// Fade the HUD + shop tray opacity down in step with the end-screen dim (0..1
// progress). Shared by the victory and defeat sequences so both darken smoothly.
function fadeEndUi(progress) {
  const a = Math.max(0, 1 - progress);
  if (hudMesh) {
    hudMesh.material.opacity = a;
    hudMesh.visible = a > 0.001;
  }
  if (trayMesh) {
    trayMesh.material.opacity = a;
    trayMesh.visible = a > 0.001;
  }
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

  // Full-screen red flash on wall damage (opacity driven by wallHitFlash)
  const flashGeo = new THREE.PlaneGeometry(worldWidth * 1.3, WORLD_HEIGHT * 1.3);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff2222, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  wallFlashMesh = new THREE.Mesh(flashGeo, flashMat);
  wallFlashMesh.position.set(0, 0, 15);
  wallFlashMesh.visible = false;
  oScene.add(wallFlashMesh);

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

function drawOverlayText() {
  const w = overlayCanvas.width;  // 256
  const h = overlayCanvas.height; // 128
  overlayCtx.clearRect(0, 0, w, h);

  // Time string (shared by the victory subtext + the stats block below).
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;

  // Title — gold survival banner for the win; red for the fall.
  overlayCtx.textAlign = 'center';
  if (gameWon) {
    // Bright gold with a soft glow to sell the victory. Two-line survival
    // banner: "SYRACUSE DEFENDED" + "SURVIVED <time>" so the win reads as an
    // endurance win, not a fleet wipe.
    overlayCtx.save();
    overlayCtx.shadowColor = 'rgba(255,215,0,0.7)';
    overlayCtx.shadowBlur = 8;
    overlayCtx.fillStyle = '#FFD700';
    overlayCtx.font = 'bold 17px monospace';
    overlayCtx.fillText('SYRACUSE DEFENDED', w / 2, 22);
    overlayCtx.font = 'bold 12px monospace';
    overlayCtx.fillText('SURVIVED ' + timeStr, w / 2, 38);
    overlayCtx.restore();
  } else {
    overlayCtx.fillStyle = '#ff5533';
    overlayCtx.font = 'bold 18px monospace';
    overlayCtx.fillText('SYRACUSE HAS FALLEN', w / 2, 24);
  }

  // Stats
  const kills = getKillCount();
  const res = getResources();
  const goldEarned = Math.floor(res.gold);

  overlayCtx.fillStyle = gameWon ? '#ffe9a8' : '#cccccc';
  overlayCtx.font = '11px monospace';
  // On a win the survival time is already in the banner, so lead with the kills.
  if (gameWon) {
    overlayCtx.fillText('Ships Sunk: ' + kills, w / 2, 56);
    overlayCtx.fillText('Gold Earned: ' + goldEarned, w / 2, 71);
  } else {
    overlayCtx.fillText('Time: ' + timeStr, w / 2, 48);
    overlayCtx.fillText('Ships Sunk: ' + kills, w / 2, 63);
    overlayCtx.fillText('Gold Earned: ' + goldEarned, w / 2, 78);
  }

  // Prompt: "Play Again" on a win, "try again" on a loss. Both reset cleanly.
  overlayCtx.fillStyle = gameWon ? '#FFD700' : '#ffffff';
  overlayCtx.font = 'bold 13px monospace';
  overlayCtx.fillText(gameWon ? 'Tap to Play Again' : 'Tap to try again', w / 2, 105);

  overlayTexture.needsUpdate = true;
}

// Defeat path: draw the text but keep it transparent; updateDefeatSequence
// fades the dark-red dim and then the stats in.
function prepareDefeatOverlay() {
  drawOverlayText();
  const oScene = getOverlayScene();
  if (overlayMesh.parent !== oScene) oScene.add(overlayMesh);
  overlayMesh.material.opacity = 0;
  overlayMesh.visible = false; // revealed by the fade-in
}

// Victory path: identical prep to defeat (draw hidden, fade in), but the gold
// tint + fanfare are set up by startVictorySequence.
function prepareVictoryOverlay() {
  drawOverlayText();
  const oScene = getOverlayScene();
  if (overlayMesh.parent !== oScene) oScene.add(overlayMesh);
  overlayMesh.material.opacity = 0;
  overlayMesh.visible = false; // revealed by the fade-in
}

function hideOverlay() {
  if (overlayMesh) {
    overlayMesh.visible = false;
    overlayMesh.removeFromParent();
  }
  if (dimMesh) {
    dimMesh.visible = false;
    dimMesh.removeFromParent();
  }
  if (overlayCtx && overlayCanvas) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (overlayTexture) overlayTexture.needsUpdate = true;
  }
}

export function handleRestartTap() {
  if (gameOver) {
    resetSession();
  }
}
