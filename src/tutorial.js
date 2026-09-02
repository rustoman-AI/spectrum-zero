// ============================================================
// src/tutorial.js — Onboarding micro-tutorial overlay (match start).
//
// A brief, elegant semi-transparent banner shown from 0:00 that teaches the
// three core controls. It fades in, holds, then fades out automatically after
// ~6s OR the instant the player sinks their first ship (whichever comes first).
//
// Rendered as an in-scene canvas texture on a plane in the OVERLAY scene, so it
// is inherently non-blocking: all pointer handling lives on the WebGL canvas
// element and these meshes never intercept input (canvas overlay == the
// pointer-events:none equivalent for our WebGL UI).
// ============================================================

import { getOverlayScene, getWorldWidth } from './renderer.js';
import { WORLD_HEIGHT } from './config.js';

let bannerMesh = null;
let bannerCanvas = null;
let bannerCtx = null;
let bannerTexture = null;

let tutElapsed = 0;      // seconds since the tutorial started
let dismissed = false;   // hard-off (fade-out complete)
let opacity = 0;
let fadingOut = false;   // latched once a fade-out trigger fires
let fadeOutT = 0;        // fade-out clock (seconds since fade-out began)
let opacityAtFadeStart = 1; // opacity captured the instant fade-out began
let fadeOutDur = 0.6;    // active fade-out duration (short when dismissed by input)

const HOLD_TIME = 6;     // seconds fully visible before auto fade-out
const FADE_IN = 0.4;     // fade-in duration
const FADE_OUT = 0.6;    // default fade-out duration (timer / first-kill)
const FADE_OUT_INPUT = 0.22; // snappier fade when the player interacts

// The three control hints. Emoji render on a 2x canvas so they stay crisp.
const HINTS = [
  { icon: '\u{1F7E2}', text: 'TAP MIRROR: Aim & Rotate Beam' },      // 🟢
  { icon: '\u{270B}',  text: 'DRAG MIRROR: Reposition across Harbor' }, // ✋
  { icon: '\u2600\uFE0F', text: 'DEFEND: Focus sunlight to burn ships!' }, // ☀️
];

export function initTutorial() {
  const oScene = getOverlayScene();
  const worldWidth = getWorldWidth();

  // 2x-resolution backing canvas (1024x256 -> logical 512x128) so the text and
  // emoji stay sharp when the banner plane is upscaled on a phone.
  bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 1024;
  bannerCanvas.height = 256;
  bannerCtx = bannerCanvas.getContext('2d');
  bannerCtx.scale(2, 2); // logical coordinates remain 512x128

  bannerTexture = new THREE.CanvasTexture(bannerCanvas);
  bannerTexture.colorSpace = THREE.SRGBColorSpace; // canvas holds sRGB pixels
  bannerTexture.minFilter = THREE.LinearFilter;

  // Plane sized to a comfortable card in world units. Aspect 512:128 = 4:1.
  const cardW = worldWidth * 0.72;
  const cardH = cardW * (128 / 512);
  const geo = new THREE.PlaneGeometry(cardW, cardH);
  const mat = new THREE.MeshBasicMaterial({
    map: bannerTexture, transparent: true, opacity: 0, depthWrite: false,
  });
  bannerMesh = new THREE.Mesh(geo, mat);
  // Upper-middle of the playfield: clear of the top HUD (~y45) and of the
  // mirror row / shop bar at the bottom, so it never sits over the controls.
  bannerMesh.position.set(0, WORLD_HEIGHT * 0.12, 2);
  bannerMesh.visible = false;
  oScene.add(bannerMesh);

  drawBanner();
}

function drawBanner() {
  if (!bannerCtx) return;
  const W = 512, H = 128;
  bannerCtx.clearRect(0, 0, W, H);

  // Rounded semi-transparent card background with a soft border.
  tutRoundRect(bannerCtx, 6, 6, W - 12, H - 12, 10);
  bannerCtx.fillStyle = 'rgba(10, 16, 26, 0.62)';
  bannerCtx.fill();
  bannerCtx.lineWidth = 1.5;
  bannerCtx.strokeStyle = 'rgba(120, 190, 255, 0.45)';
  bannerCtx.stroke();

  // Title
  bannerCtx.textAlign = 'center';
  bannerCtx.textBaseline = 'alphabetic';
  bannerCtx.fillStyle = '#cfe3ff';
  bannerCtx.font = 'bold 15px monospace';
  bannerCtx.fillText('HOW TO DEFEND SYRACUSE', W / 2, 26);

  // Three hint rows, left-aligned icon + text, evenly spaced.
  const rows = [46, 74, 102];
  const iconX = 26;
  const textX = 50;
  for (let i = 0; i < HINTS.length; i++) {
    const y = rows[i];
    bannerCtx.textAlign = 'left';
    bannerCtx.font = '16px monospace';
    bannerCtx.fillText(HINTS[i].icon, iconX, y);
    bannerCtx.fillStyle = '#eaf2ff';
    bannerCtx.font = 'bold 13px monospace';
    bannerCtx.fillText(HINTS[i].text, textX, y);
    bannerCtx.fillStyle = '#eaf2ff';
  }

  bannerTexture.needsUpdate = true;
}

function tutRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Advance the tutorial. `killCount` is the running ships-sunk total; the first
// kill dismisses the banner early. Called every frame from the main loop.
export function updateTutorial(dt, killCount) {
  if (dismissed || !bannerMesh) return;

  tutElapsed += dt;

  // Latch the fade-out on either trigger: the first ship sunk, or the hold
  // window elapsing. We capture the current opacity so an early kill fades
  // smoothly from wherever the fade-in had reached.
  if (!fadingOut && ((killCount > 0) || tutElapsed >= (FADE_IN + HOLD_TIME))) {
    fadingOut = true;
    fadeOutT = 0;
    fadeOutDur = FADE_OUT;
    opacityAtFadeStart = opacity;
  }

  if (!fadingOut) {
    // Fade in, then hold at full.
    opacity = Math.min(1, tutElapsed / FADE_IN);
  } else {
    fadeOutT += dt;
    opacity = Math.max(0, opacityAtFadeStart * (1 - fadeOutT / fadeOutDur));
  }

  bannerMesh.material.opacity = opacity;
  bannerMesh.visible = opacity > 0.001;

  if (fadingOut && opacity <= 0.001) {
    dismissed = true;
    bannerMesh.visible = false;
  }
}

// Begin the fade-out immediately, e.g. on the player's very first interaction.
// Idempotent: once the banner is fading or gone this is a no-op. We fade rather
// than hard-cut so the dismissal still reads as smooth, but a short fade means
// the crystal + first target ship are unobstructed almost instantly.
export function dismissTutorial() {
  if (dismissed || fadingOut || !bannerMesh) return;
  fadingOut = true;
  fadeOutT = 0;
  fadeOutDur = FADE_OUT_INPUT; // snappy so the playfield clears at once
  opacityAtFadeStart = opacity;
}

export function resetTutorial() {
  tutElapsed = 0;
  dismissed = false;
  opacity = 0;
  fadingOut = false;
  fadeOutT = 0;
  fadeOutDur = FADE_OUT;
  opacityAtFadeStart = 1;
  if (bannerMesh) {
    bannerMesh.material.opacity = 0;
    bannerMesh.visible = false;
  }
}
