// ============================================================
// src/foundry.js — Foundries with visible absorption feedback
//
// When fed: glow at contact, body brightens, rate shown, ghost
// path shows the defence the player gave up.
// ============================================================

import {
  FOUNDRY_Y, COLOUR_AMBER, COLOUR_CYAN, COLOUR_GOLD, COLOUR_WHITE,
  FORGE_SLAG_PER_SEC, LENS_INSIGHT_PER_SEC, CHORUS_RECOMBO_PER_SEC,
  FOUNDRY_POSITIONS, FOUNDRY_HW, FOUNDRY_HH, WORLD_HEIGHT
} from './config.js';
import { getScene, getWorldWidth } from './renderer.js';
import { getSegments } from './beam.js';

let slag = 0;
let insight = 0;
let recombination = 0;

const insightLog = [];
function logInsight(delta, reason) {
  insightLog.push({
    t: typeof getElapsed === 'function' ? getElapsed().toFixed(2) : '?',
    delta: delta.toFixed(3),
    total: insight.toFixed(3),
    reason
  });
  if (insightLog.length > 200) insightLog.shift();
}
export function getInsightLog() { return insightLog; }

const foundries = [];

export function getSlag() { return slag; }
export function getInsight() { return insight; }
export function getRecombination() { return recombination; }
export function spendSlag(amount) { if (amount > 0) slag -= amount; }
export function spendInsight(amount) {
  if (amount > 0) {
    insight -= amount;
    logInsight(-amount, 'craft:' + amount);
  }
  if (insight < 0) { console.warn('[BUG] insight negative:', insight); insight = 0; }
}
export function addSlagDirect(amount) { slag += amount; }

export function resetFoundries() {
  slag = 0; insight = 0; recombination = 0;
  logInsight(0, 'RESET');
  for (const fnd of foundries) {
    fnd.ghostMesh.visible = false;
    fnd.glowMesh.visible = false;
    fnd.rateMesh.visible = false;
  }
}

export function getFoundryColliders() {
  return foundries.map(f => ({ x: f.x, y: f.y, type: f.type, colour: f.colour }));
}

export function initFoundries() {
  const scene = getScene();
  slag = 0; insight = 0; recombination = 0;
  foundries.length = 0;

  for (let i = 0; i < FOUNDRY_POSITIONS.length; i++) {
    const def = FOUNDRY_POSITIONS[i];
    const x = def.x;
    const y = FOUNDRY_Y;

    // Body
    const geo = new THREE.PlaneGeometry(FOUNDRY_HW * 2 - 1, FOUNDRY_HH * 2 - 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: def.colour, transparent: true, opacity: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, -0.1);
    scene.add(mesh);

    // Border
    const bGeo = new THREE.RingGeometry(FOUNDRY_HW - 0.3, FOUNDRY_HW + 0.1, 4);
    const bMat = new THREE.MeshBasicMaterial({ color: def.colour, transparent: true, opacity: 0.5 });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.set(x, y, -0.05);
    bMesh.rotation.z = Math.PI / 4;
    scene.add(bMesh);

    // Glow (visible when fed, at contact point)
    const glowGeo = new THREE.PlaneGeometry(4, 4);
    const glowMat = new THREE.MeshBasicMaterial({
      color: def.colour, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(x, y + FOUNDRY_HH, -0.02);
    glowMesh.visible = false;
    scene.add(glowMesh);

    // Rate label (canvas texture, shown when fed)
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 64; rCanvas.height = 20;
    const rCtx = rCanvas.getContext('2d');
    const rTex = new THREE.CanvasTexture(rCanvas);
    rTex.minFilter = THREE.LinearFilter;
    const rGeo = new THREE.PlaneGeometry(7, 2.2);
    const rMat = new THREE.MeshBasicMaterial({ map: rTex, transparent: true, depthWrite: false });
    const rateMesh = new THREE.Mesh(rGeo, rMat);
    rateMesh.position.set(x, y - FOUNDRY_HH - 1.5, 0.3);
    rateMesh.visible = false;
    scene.add(rateMesh);

    // Ghost path (shows where the band WOULD go if not absorbed)
    // A faint dashed line from the foundry bottom edge to the screen bottom
    const ghostGeo = new THREE.PlaneGeometry(0.8, WORLD_HEIGHT / 2 - Math.abs(y) - FOUNDRY_HH);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: def.colour, transparent: true, opacity: 0.0, depthWrite: false
    });
    const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    const ghostLen = WORLD_HEIGHT / 2 - Math.abs(y) - FOUNDRY_HH;
    ghostMesh.position.set(x, y - FOUNDRY_HH - ghostLen / 2, -0.6);
    ghostMesh.visible = false;
    scene.add(ghostMesh);

    // Label
    const labels = { forge: 'FORGE', lensworks: 'LENS', chorus: 'CHORUS' };
    const lCanvas = document.createElement('canvas');
    lCanvas.width = 64; lCanvas.height = 24;
    const lCtx = lCanvas.getContext('2d');
    lCtx.fillStyle = '#ffffff';
    lCtx.font = 'bold 14px monospace';
    lCtx.textAlign = 'center';
    lCtx.fillText(labels[def.type], 32, 16);
    const lTex = new THREE.CanvasTexture(lCanvas);
    lTex.minFilter = THREE.LinearFilter;
    const lGeo = new THREE.PlaneGeometry(8, 3);
    const lMat = new THREE.MeshBasicMaterial({ map: lTex, transparent: true, depthWrite: false });
    const labelMesh = new THREE.Mesh(lGeo, lMat);
    labelMesh.position.set(x, y + FOUNDRY_HH + 2, 0.3);
    scene.add(labelMesh);

    foundries.push({
      type: def.type, colour: def.colour, x, y,
      mesh, glowMesh, rateMesh, ghostMesh,
      rCanvas, rCtx, rTex,
      active: false, ghostFade: 0
    });
  }
}

export function updateFoundries(dt) {
  const segments = getSegments();

  for (let f = 0; f < foundries.length; f++) {
    const fnd = foundries[f];
    const wasFed = fnd.active;
    fnd.active = false;

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const ex = seg.end.x;
      const ey = seg.end.y;
      if (ex >= fnd.x - FOUNDRY_HW && ex <= fnd.x + FOUNDRY_HW &&
          ey >= fnd.y - FOUNDRY_HH && ey <= fnd.y + FOUNDRY_HH) {
        if (seg.colour === fnd.colour || seg.colour === COLOUR_WHITE) {
          fnd.active = true;
          // Position glow at contact point
          fnd.glowMesh.position.x = ex;
          fnd.glowMesh.position.y = ey + 1;
          break;
        }
      }
    }

    if (fnd.active) {
      // Brighten body
      fnd.mesh.material.opacity = 0.65;
      // Show glow
      fnd.glowMesh.visible = true;
      fnd.glowMesh.material.opacity = 0.5 + 0.3 * Math.sin(performance.now() * 0.005);
      // Show rate label
      fnd.rateMesh.visible = true;
      updateRateLabel(fnd);
      // Show ghost path (the defence cost)
      fnd.ghostMesh.visible = true;
      fnd.ghostMesh.material.opacity = 0.15;
      fnd.ghostFade = 1.0;

      // Accumulate resources
      if (fnd.type === 'forge') {
        slag += FORGE_SLAG_PER_SEC * dt;
      } else if (fnd.type === 'lensworks') {
        const gain = LENS_INSIGHT_PER_SEC * dt;
        insight += gain;
        if (Math.floor(insight) !== Math.floor(insight - gain)) {
          logInsight(gain, 'lens:tick');
        }
      } else if (fnd.type === 'chorus') {
        recombination = Math.min(100, recombination + CHORUS_RECOMBO_PER_SEC * dt);
      }
    } else {
      fnd.mesh.material.opacity = 0.25;
      fnd.glowMesh.visible = false;
      fnd.rateMesh.visible = false;
      // Fade ghost path over 1 second after band leaves
      if (fnd.ghostFade > 0) {
        fnd.ghostFade -= dt;
        fnd.ghostMesh.material.opacity = Math.max(0, fnd.ghostFade * 0.15);
        if (fnd.ghostFade <= 0) fnd.ghostMesh.visible = false;
      }
    }
  }
}

function updateRateLabel(fnd) {
  const rates = { forge: '+4/s', lensworks: '+3/s', chorus: '+1.5%/s' };
  fnd.rCtx.clearRect(0, 0, 64, 20);
  fnd.rCtx.fillStyle = '#ffffff';
  fnd.rCtx.font = 'bold 12px monospace';
  fnd.rCtx.textAlign = 'center';
  fnd.rCtx.fillText(rates[fnd.type], 32, 14);
  fnd.rTex.needsUpdate = true;
}
