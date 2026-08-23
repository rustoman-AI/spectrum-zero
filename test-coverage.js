// ============================================================
// test-coverage.js — Compute true mirror coverage at proposed heights
//
// For a mirror at a given (x, y), sweep the mirror angle in 1-degree
// steps. For each angle, trace the beam from the prism exit point
// (the beam that would reach this mirror) and check:
// 1. Does the incoming beam intersect the 8-unit mirror face?
// 2. If so, where does the reflected beam land at the breach line?
//
// Reports: reachable X range at the breach line, as fraction of spawn width.
// ============================================================

const MIRROR_LENGTH = 8;
const PRISM_Y = 22; // prism exit point (approx)
const PRISM_X = 0;
const BREACH_Y = -24;
const ENEMY_SPAWN_WIDTH = 45; // ±22.5 from centre
const HALF_SPAWN = 22.5;

// Beam from prism: cyan goes straight down (0, -1).
// For a mirror at (mx, my), the beam arrives from above at (mx, prismY) going (0,-1).
// Actually — the beam from the prism might not be vertical at the mirror's X.
// The three bands exit at angles: amber -10deg, cyan 0deg, gold +10deg.
// A mirror at arbitrary X might only be reached by a redirected beam, not a direct one.
//
// Simplification: assume the player routes ONE beam to this mirror.
// The beam arrives approximately vertically (within ±15deg of vertical)
// from whatever prism band or prior reflection.
// We test with a VERTICAL incoming beam (worst case for coverage, since
// a tilted beam would give wider coverage).

function computeCoverage(mirrorY) {
  const distToBreachFromMirror = mirrorY - BREACH_Y; // positive (mirror above breach)
  const halfLen = MIRROR_LENGTH / 2;

  let minX = Infinity, maxX = -Infinity;
  let usableAngles = 0;

  // Sweep angle from 0 to 179 degrees (180 = full rotation, but symmetric)
  for (let deg = 1; deg < 180; deg++) {
    const angle = deg * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Mirror endpoints
    const p1x = -halfLen * cos;
    const p1y = -halfLen * sin;
    const p2x = halfLen * cos;
    const p2y = halfLen * sin;

    // Incoming beam: vertical, direction (0, -1), arriving at x=0 relative to mirror centre
    // Does it intersect the mirror segment [p1, p2]?
    // Ray: origin (0, +10) (from above), dir (0, -1)
    // Parametric: point = (0, 10 - t)
    // Segment: p1 to p2
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    // Ray dir = (0, -1), segment dir = (dx, dy)
    const denom = 0 * dy - (-1) * dx; // = dx
    if (Math.abs(denom) < 1e-8) continue; // parallel (horizontal mirror)

    const ox = p1x - 0;
    const oy = p1y - 10;
    const t = (ox * dy - oy * dx) / denom;
    const u = (ox * (-1) - oy * 0) / denom;

    if (t <= 0 || u < 0 || u > 1) continue; // no intersection or behind

    // Intersection point on the mirror
    const hitX = p1x + u * dx;
    const hitY = p1y + u * dy;

    // Check incidence angle — if too shallow, beam barely grazes
    // Normal to mirror: (-sin, cos)
    const nx = -sin, ny = cos;
    const dotIncidence = Math.abs(0 * nx + (-1) * ny); // |cos(angle between beam dir and normal)|
    if (dotIncidence < 0.15) continue; // less than ~8.5 degrees from surface = unusable

    // Reflect: r = d - 2*(d·n)*n where d=(0,-1)
    const dot = 0 * nx + (-1) * ny;
    let rx = 0 - 2 * dot * nx;
    let ry = -1 - 2 * dot * ny;
    const rlen = Math.sqrt(rx * rx + ry * ry);
    rx /= rlen; ry /= rlen;

    // Where does reflected beam hit y = BREACH_Y (relative to mirror)?
    // From hitPoint, travel in direction (rx, ry) until y offset = -distToBreachFromMirror
    if (Math.abs(ry) < 1e-8) continue; // horizontal reflection, never reaches breach
    const tBreach = (-distToBreachFromMirror - hitY) / ry;
    if (tBreach < 0) continue; // goes upward, doesn't reach breach

    const landX = hitX + rx * tBreach;

    // Clamp to playfield width (±28 units = half world width at 9:16)
    const clampedX = Math.max(-28, Math.min(28, landX));
    if (clampedX < minX) minX = clampedX;
    if (clampedX > maxX) maxX = clampedX;
    usableAngles++;
  }

  const reachableRange = maxX - minX;
  const coverage = reachableRange / ENEMY_SPAWN_WIDTH;

  return { mirrorY, minX: minX.toFixed(1), maxX: maxX.toFixed(1), range: reachableRange.toFixed(1), coverage: (coverage * 100).toFixed(1), usableAngles };
}

console.log('=== Mirror Coverage Analysis ===');
console.log('Mirror length: ' + MIRROR_LENGTH + ' units');
console.log('Spawn width: ' + ENEMY_SPAWN_WIDTH + ' units (±' + HALF_SPAWN + ')');
console.log('Breach line: y=' + BREACH_Y);
console.log('Incoming beam: vertical (0, -1)');
console.log('Min incidence angle: ~8.5 degrees from surface');
console.log('');
console.log('mirrorY | dist-to-breach | reachable X range | coverage');
console.log('--------|----------------|-------------------|----------');

for (let my = -5; my >= -25; my -= 3) {
  const r = computeCoverage(my);
  console.log(`  y=${my.toString().padStart(3)}  |     ${(my - BREACH_Y).toString().padStart(3)} units    |  ${r.minX.padStart(6)} to ${r.maxX.padStart(5)}  |  ${r.coverage.padStart(5)}%`);
}

console.log('');
console.log('Note: Coverage = fraction of the 45-unit spawn width reachable by');
console.log('one mirror from that height, via rotation alone, with a vertical');
console.log('incoming beam and a minimum usable incidence angle.');
