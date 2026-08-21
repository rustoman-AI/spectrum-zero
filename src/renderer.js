// ============================================================
// src/renderer.js — Three.js scene, orthographic camera, resize
// Fixed 9:16 portrait render target with letterboxing.
// Two-pass rendering: main scene + overlay scene (always on top).
// ============================================================

import { WORLD_HEIGHT, COLOUR_GREY } from './config.js';

const TARGET_ASPECT = 9 / 16;

let scene, camera, renderer, worldWidth;
// Overlay scene renders on top of main scene (second pass, no depth issues)
let overlayScene, overlayCamera;

export function initRenderer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  worldWidth = WORLD_HEIGHT * TARGET_ASPECT;
  const hw = worldWidth / 2;
  const hh = WORLD_HEIGHT / 2;

  camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
  camera.position.z = 50;

  // Overlay scene (no background, renders on top)
  overlayScene = new THREE.Scene();
  overlayCamera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
  overlayCamera.position.z = 50;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false; // we manage clearing manually for two-pass
  document.body.appendChild(renderer.domElement);

  applyLetterbox();
  window.addEventListener('resize', applyLetterbox);
}

function applyLetterbox() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const winAspect = winW / winH;

  let canvasW, canvasH;
  if (winAspect > TARGET_ASPECT) {
    canvasH = winH;
    canvasW = Math.floor(winH * TARGET_ASPECT);
  } else {
    canvasW = winW;
    canvasH = Math.floor(winW / TARGET_ASPECT);
  }

  renderer.setSize(canvasW, canvasH);

  const el = renderer.domElement;
  el.style.position = 'absolute';
  el.style.left = Math.floor((winW - canvasW) / 2) + 'px';
  el.style.top = Math.floor((winH - canvasH) / 2) + 'px';
}

export function getScene() { return scene; }
export function getOverlayScene() { return overlayScene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getWorldWidth() { return worldWidth; }

export function render() {
  renderer.clear();
  renderer.render(scene, camera);
  // Second pass: overlay scene renders on top without clearing
  renderer.clearDepth();
  renderer.render(overlayScene, overlayCamera);
}

export function screenToWorld(sx, sy) {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((sx - rect.left) / rect.width) * 2 - 1;
  const ny = -((sy - rect.top) / rect.height) * 2 + 1;
  const hw = worldWidth / 2;
  const hh = WORLD_HEIGHT / 2;
  return { x: nx * hw, y: ny * hh };
}
