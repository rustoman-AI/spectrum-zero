// ============================================================
// src/beam.js — Iterative raycast beam solver with resonance detection
// ============================================================
import {
  MAX_BOUNCES, MAX_SEGMENTS, PRISM_SPLIT_ANGLE,
  APERTURE_Y, WORLD_HEIGHT, COLOUR_WHITE,
  COLOUR_AMBER, COLOUR_CYAN, COLOUR_GOLD,
  FOUNDRY_HW, FOUNDRY_HH, RESONANCE_MIN_BOUNCES
} from './config.js';
// Segment: { start, end, colour, intensity, bounces }
let segments = [];
let dirty = true;
// Diagnostics — read by debug overlay
let maxBouncesUsed = 0;
let hitBounceCap = false;
export function markDirty() { dirty = true; }
export function isDirty() { return dirty; }
export function getSegments() { return segments; }
export function getBeamDiag() { return { maxBouncesUsed, hitBounceCap }; }
// Resonance: detected when 3+ bounces occur between the same mirror pair
let resonanceActive = false;
let resonanceMirrors = null; // [mirrorA, mirrorB] if resonance detected
export function getResonanceActive() { return resonanceActive; }
export function getResonanceMirrors() { return resonanceMirrors; }
// Called by main loop when dirty
export function solve(sourceX, sourceY, mirrors, prisms, worldWidth, foundryColliders) {
  segments = [];
  maxBouncesUsed = 0;
  hitBounceCap = false;
  resonanceActive = false;
  resonanceMirrors = null;
  mirrorHitSequence = [];
  const dir = { x: 0, y: -1 };
  traceBeam(
    { x: sourceX, y: sourceY },
    dir,
    COLOUR_WHITE,
    1.0,
    mirrors,
    prisms,
    [], // foundries are pass-through, not colliders
    worldWidth,
    MAX_BOUNCES,
    null,
    0
  );
  dirty = false;
  // Post-solve: detect resonance (3+ bounces between same mirror pair)
  detectResonance();
}
let mirrorHitSequence = [];
function detectResonance() {
  if (mirrorHitSequence.length < RESONANCE_MIN_BOUNCES) return;
  for (let i = 0; i <= mirrorHitSequence.length - RESONANCE_MIN_BOUNCES; i++) {
    const a = mirrorHitSequence[i], b = mirrorHitSequence[i + 1];
    if (!a || !b || a === b) continue;
    let count = 2;
    for (let j = i + 2; j < mirrorHitSequence.length; j++) {
      if (mirrorHitSequence[j] === ((j - i) % 2 === 0 ? a : b)) count++; else break;
    }
    if (count >= RESONANCE_MIN_BOUNCES) { resonanceActive = true; resonanceMirrors = [a, b]; return; }
  }
}
function traceBeam(origin, direction, colour, intensity, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft, excludePrism, bouncesUsed) {
  if (segments.length >= MAX_SEGMENTS) return;
  if (bouncesLeft < 0) {
    hitBounceCap = true;
    return;
  }
  const hit = castRay(origin, direction, mirrors, prisms, foundryColliders, worldWidth, excludePrism);
  segments.push({
    start: { x: origin.x, y: origin.y },
    end: { x: hit.point.x, y: hit.point.y },
    colour,
    intensity,
    bounces: bouncesUsed
  });
  if (hit.type === 'mirror' && bouncesLeft > 0) {
    // Record for resonance detection
    mirrorHitSequence.push(hit.object);
    // -------------------------------------------------------
    // Reflection math (double-sided):
    // Given incident direction d and surface normal n,
    // reflected direction r = d - 2*(d·n)*n
    //
    // If d·n > 0, beam is hitting from behind — flip n so
    // reflection works correctly from either side.
    // -------------------------------------------------------
    let n = { x: hit.normal.x, y: hit.normal.y };
    const dot = direction.x * n.x + direction.y * n.y;
    // Flip normal if beam approaches from behind
    if (dot > 0) {
      n.x = -n.x;
      n.y = -n.y;
    }
    const dotFixed = direction.x * n.x + direction.y * n.y;
    const reflected = {
      x: direction.x - 2 * dotFixed * n.x,
      y: direction.y - 2 * dotFixed * n.y
    };
    // Normalise to avoid drift
    const len = Math.sqrt(reflected.x * reflected.x + reflected.y * reflected.y);
    reflected.x /= len;
    reflected.y /= len;
    const newBounces = bouncesUsed + 1;
    if (newBounces > maxBouncesUsed) maxBouncesUsed = newBounces;
    traceBeam(hit.point, reflected, colour, intensity, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft - 1, null, newBounces);
  } else if (hit.type === 'prism') {
    if (colour === COLOUR_WHITE) {
      const bands = [
        { colour: COLOUR_AMBER, angleOffset: -PRISM_SPLIT_ANGLE },
        { colour: COLOUR_CYAN,  angleOffset: 0 },
        { colour: COLOUR_GOLD,  angleOffset: PRISM_SPLIT_ANGLE },
      ];
      for (const band of bands) {
        if (segments.length >= MAX_SEGMENTS) break;
        const newDir = rotateVec(direction, band.angleOffset);
        traceBeam(hit.point, newDir, band.colour, intensity, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft - 1, hit.object, bouncesUsed);
      }
    } else {
      // Second prism on a coloured band: split into two weaker sub-rays
      const subRays = [
        { angleOffset: -PRISM_SPLIT_ANGLE * 0.5 },
        { angleOffset: PRISM_SPLIT_ANGLE * 0.5 },
      ];
      for (const sub of subRays) {
        if (segments.length >= MAX_SEGMENTS) break;
        const newDir = rotateVec(direction, sub.angleOffset);
        traceBeam(hit.point, newDir, colour, intensity * 0.5, mirrors, prisms, foundryColliders, worldWidth, bouncesLeft - 1, hit.object, bouncesUsed);
      }
    }
  }
  // else: beam terminates (edge, foundry, enemy)
}
// Cast a ray and find the nearest intersection
function castRay(origin, direction, mirrors, prisms, foundryColliders, worldWidth, excludePrism) {
  let nearest = null;
  let nearestDist = Infinity;
  // Test mirrors
  for (const mirror of mirrors) {
    if (mirror.shattered) continue;
    const result = raySegmentIntersect(origin, direction, mirror.p1, mirror.p2);
    if (result && result.dist > 0.1 && result.dist < nearestDist) {
      nearestDist = result.dist;
      nearest = { type: 'mirror', point: result.point, normal: mirror.normal, object: mirror };
    }
  }
  // Test prisms
  for (const prism of prisms) {
    if (prism === excludePrism) continue;
    const result = rayCircleIntersect(origin, direction, prism.position, prism.radius);
    if (result && result.dist > 0.1 && result.dist < nearestDist) {
      nearestDist = result.dist;
      nearest = { type: 'prism', point: result.point, normal: null, object: prism };
    }
  }
  // Test foundries (absorbing — beam terminates here)
  for (const fnd of foundryColliders) {
    const result = rayAABBIntersect(origin, direction, fnd.x, fnd.y, FOUNDRY_HW, FOUNDRY_HH);
    if (result && result.dist > 0.1 && result.dist < nearestDist) {
      nearestDist = result.dist;
      nearest = { type: 'foundry', point: result.point, normal: null, object: fnd };
    }
  }
  // Test world bounds
  const edgeHit = rayBoundsIntersect(origin, direction, worldWidth);
  if (edgeHit && edgeHit.dist > 0.1 && edgeHit.dist < nearestDist) {
    nearestDist = edgeHit.dist;
    nearest = { type: 'edge', point: edgeHit.point, normal: null, object: null };
  }
  if (!nearest) {
    nearest = {
      type: 'edge',
      point: { x: origin.x + direction.x * 200, y: origin.y + direction.y * 200 },
      normal: null,
      object: null
    };
  }
  return nearest;
}
// Ray vs AABB intersection (for foundries)
// Returns first intersection point with the box boundary
function rayAABBIntersect(origin, dir, cx, cy, hw, hh) {
  const xmin = cx - hw, xmax = cx + hw;
  const ymin = cy - hh, ymax = cy + hh;
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dir.x) < 1e-8) {
    if (origin.x < xmin || origin.x > xmax) return null;
  } else {
    let t1 = (xmin - origin.x) / dir.x;
    let t2 = (xmax - origin.x) / dir.x;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dir.y) < 1e-8) {
    if (origin.y < ymin || origin.y > ymax) return null;
  } else {
    let t1 = (ymin - origin.y) / dir.y;
    let t2 = (ymax - origin.y) / dir.y;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  // tmin is the entry point
  if (tmin < 0.1) tmin = tmax; // if inside the box, use exit
  if (tmin < 0.1) return null;
  return {
    dist: tmin,
    point: { x: origin.x + dir.x * tmin, y: origin.y + dir.y * tmin }
  };
}
// Ray vs line segment intersection (for mirrors)
// Ray: P = origin + t * direction, t > 0
// Segment: from A to B
function raySegmentIntersect(origin, dir, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const denom = dir.x * dy - dir.y * dx;
  if (Math.abs(denom) < 1e-8) return null; // parallel
  const ox = A.x - origin.x;
  const oy = A.y - origin.y;
  const t = (ox * dy - oy * dx) / denom;
  const u = (ox * dir.y - oy * dir.x) / denom;
  if (t > 0 && u >= 0 && u <= 1) {
    return {
      dist: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t }
    };
  }
  return null;
}
// Ray vs circle intersection (for prisms)
function rayCircleIntersect(origin, dir, centre, radius) {
  const ocx = origin.x - centre.x;
  const ocy = origin.y - centre.y;
  const a = dir.x * dir.x + dir.y * dir.y;
  const b = 2 * (ocx * dir.x + ocy * dir.y);
  const c = ocx * ocx + ocy * ocy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  let t = (-b - sqrtDisc) / (2 * a);
  if (t < 0.1) t = (-b + sqrtDisc) / (2 * a);
  if (t < 0.1) return null;
  return {
    dist: t,
    point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t }
  };
}
// Ray vs world bounds (rectangle from -hw to hw, -hh to hh)
function rayBoundsIntersect(origin, dir, worldWidth) {
  const hw = worldWidth / 2;
  const hh = WORLD_HEIGHT / 2;
  let tMin = Infinity;
  let hitPoint = null;
  const edges = [
    { axis: 'x', val: -hw },
    { axis: 'x', val: hw },
    { axis: 'y', val: -hh },
    { axis: 'y', val: hh },
  ];
  for (const edge of edges) {
    let t;
    if (edge.axis === 'x') {
      if (Math.abs(dir.x) < 1e-8) continue;
      t = (edge.val - origin.x) / dir.x;
      if (t > 0.1 && t < tMin) {
        const y = origin.y + dir.y * t;
        if (y >= -hh && y <= hh) {
          tMin = t;
          hitPoint = { x: edge.val, y };
        }
      }
    } else {
      if (Math.abs(dir.y) < 1e-8) continue;
      t = (edge.val - origin.y) / dir.y;
      if (t > 0.1 && t < tMin) {
        const x = origin.x + dir.x * t;
        if (x >= -hw && x <= hw) {
          tMin = t;
          hitPoint = { x, y: edge.val };
        }
      }
    }
  }
  if (hitPoint) return { dist: tMin, point: hitPoint };
  return null;
}
// Rotate a 2D vector by angle (radians)
function rotateVec(v, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos
  };
}
