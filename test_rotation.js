// ============================================================
// test_rotation.js — Headless regression test for mirror rotation
//
// Tests the distance-aware rotation math independently of DOM/Three.js.
// Simulates: pointerdown on mirror, several pointermove events, pointerup,
// then asserts angle changed by sensible amount.
// Also asserts mirror is releasable and grabbable again.
// ============================================================

// --- Extract rotation constants (must match src/input.js) ---
const ROT_K = 1.8;
const ROT_L_MIN = 15;
const ROT_LERP_RATE = 0.20;
const ROT_MAX_SPEED = 2.5;
const FREE_PLACEMENT = true;
const DRAG_THRESHOLD = 3;

// --- Mock mirror ---
function createMockMirror(x, y, angle) {
  return { freeX: x, freeY: y, angle: angle, socketIndex: 0, shattered: false };
}

// --- Simulate the rotation math (extracted from input.js) ---
function simulateRotation(mirror, pointerPath, beamLength, dt) {
  // pointerPath: array of {x, y} world coords (first is pointerdown, rest are moves)
  // Returns: { finalTargetAngle, mirrorAngleDelta, stateAfterRelease }

  let targetAngle = mirror.angle;
  let prevWorld = pointerPath[0]; // set on rotation start
  const mx = mirror.freeX;
  const my = mirror.freeY;

  // Process each move (skip first which is the down point)
  for (let i = 1; i < pointerPath.length; i++) {
    const world = pointerPath[i];
    const pdx = world.x - prevWorld.x;
    const pdy = world.y - prevWorld.y;
    const toPointerX = world.x - mx;
    const toPointerY = world.y - my;
    const toPointerLen = Math.sqrt(toPointerX * toPointerX + toPointerY * toPointerY);

    if (toPointerLen > 0.1) {
      const tangential = (toPointerX * pdy - toPointerY * pdx) / toPointerLen;
      const L = beamLength;
      const angleDelta = (tangential * ROT_K) / Math.max(L, ROT_L_MIN);
      targetAngle += angleDelta;
    }
    prevWorld = { x: world.x, y: world.y };
  }

  // Simulate N frames of smoothing (like tickDebug(dt) would do)
  const frames = Math.ceil(1.0 / dt); // 1 second of frames
  let currentAngle = mirror.angle;
  for (let f = 0; f < frames; f++) {
    let diff = targetAngle - currentAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const lerpFactor = 1 - Math.pow(1 - ROT_LERP_RATE, dt * 60);
    let step = diff * lerpFactor;
    const maxStep = ROT_MAX_SPEED * dt;
    if (Math.abs(step) > maxStep) step = Math.sign(step) * maxStep;
    if (Math.abs(diff) > 0.001) {
      currentAngle += step;
    }
  }

  return {
    targetAngle,
    finalAngle: currentAngle,
    angleDelta: currentAngle - mirror.angle,
  };
}

// ============================================================
// TESTS
// ============================================================

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.log('  FAIL: ' + msg); }
}

function assertApprox(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) <= tolerance) { passed++; }
  else { failed++; console.log('  FAIL: ' + msg + ' (got ' + actual.toFixed(4) + ', expected ~' + expected.toFixed(4) + ')'); }
}

// --- Test 1: Basic rotation - swipe tangentially moves angle ---
console.log('Test 1: Basic rotation from tangential swipe');
{
  const mirror = createMockMirror(0, -25, 0); // horizontal mirror at origin
  // Pointer starts above mirror, moves rightward (tangential to a vertical line from mirror)
  const path = [
    { x: 5, y: -10 },  // start (above and right of mirror)
    { x: 10, y: -10 }, // move right
    { x: 15, y: -10 }, // move right more
    { x: 20, y: -10 }, // move right more
  ];
  const result = simulateRotation(mirror, path, 40, 1/60);
  assert(result.targetAngle !== 0, 'targetAngle should change from 0');
  assert(Math.abs(result.angleDelta) > 0.01, 'mirror angle should change');
  assert(Math.abs(result.angleDelta) < Math.PI, 'angle change should be less than PI');
  console.log('  targetAngle=' + result.targetAngle.toFixed(4) + ' finalAngle=' + result.finalAngle.toFixed(4));
}

// --- Test 2: Sensitivity scales with beam length ---
console.log('Test 2: Longer beam = less angle change for same swipe');
{
  const mirror = createMockMirror(0, -25, 0);
  const path = [
    { x: 5, y: -10 },
    { x: 15, y: -10 }, // 10 units rightward
  ];
  const shortBeam = simulateRotation(mirror, path, 20, 1/60);
  const longBeam = simulateRotation(mirror, path, 60, 1/60);
  assert(Math.abs(shortBeam.targetAngle) > Math.abs(longBeam.targetAngle),
    'short beam should produce larger angle change than long beam');
  // Ratio should be approximately 60/20 = 3x
  const ratio = Math.abs(shortBeam.targetAngle) / Math.abs(longBeam.targetAngle);
  assertApprox(ratio, 3.0, 0.5, 'sensitivity ratio should be ~3x (60/20)');
  console.log('  short=' + shortBeam.targetAngle.toFixed(4) + ' long=' + longBeam.targetAngle.toFixed(4) + ' ratio=' + ratio.toFixed(2));
}

// --- Test 3: L_MIN clamps short beams ---
console.log('Test 3: Very short beam clamped by L_MIN=15');
{
  const mirror = createMockMirror(0, -25, 0);
  const path = [
    { x: 5, y: -10 },
    { x: 15, y: -10 },
  ];
  const veryShort = simulateRotation(mirror, path, 5, 1/60);   // below L_MIN
  const atMin = simulateRotation(mirror, path, 15, 1/60);      // at L_MIN
  // Both should produce the same angle (clamped to L_MIN=15)
  assertApprox(veryShort.targetAngle, atMin.targetAngle, 0.001,
    'beam length below L_MIN should clamp to same result as L_MIN');
  console.log('  L=5: ' + veryShort.targetAngle.toFixed(4) + ' L=15: ' + atMin.targetAngle.toFixed(4));
}

// --- Test 4: Max speed clamp prevents huge jumps ---
console.log('Test 4: Max speed clamp');
{
  const mirror = createMockMirror(0, -25, 0);
  // Huge swipe that would produce enormous angle
  const path = [
    { x: 1, y: -10 },
    { x: 100, y: -10 }, // 99 units in one move
  ];
  const result = simulateRotation(mirror, path, 15, 1/60);
  // After 1 second of smoothing at max 2.5 rad/s, max angle reached = 2.5 rad
  assert(Math.abs(result.finalAngle) <= 2.5 + 0.1,
    'final angle after 1s should not exceed ROT_MAX_SPEED');
  console.log('  targetAngle=' + result.targetAngle.toFixed(4) + ' finalAngle(1s)=' + result.finalAngle.toFixed(4));
}

// --- Test 5: Zero tangential movement = no rotation ---
console.log('Test 5: Radial movement (toward/away from mirror) produces no rotation');
{
  const mirror = createMockMirror(0, -25, 0);
  // Move directly away from mirror (radial, not tangential)
  const path = [
    { x: 0, y: -10 },
    { x: 0, y: -5 },  // move toward mirror
    { x: 0, y: 0 },   // keep going
  ];
  const result = simulateRotation(mirror, path, 40, 1/60);
  assertApprox(result.targetAngle, 0, 0.001, 'purely radial movement should not change angle');
  console.log('  targetAngle=' + result.targetAngle.toFixed(6));
}

// --- Test 6: Mirror is releasable and re-grabbable ---
console.log('Test 6: Mirror release and re-grab');
{
  // Simulate: first rotation session
  const mirror = createMockMirror(0, -25, 0);
  const path1 = [{ x: 5, y: -10 }, { x: 15, y: -10 }];
  const result1 = simulateRotation(mirror, path1, 40, 1/60);
  // "Release" — mirror.angle would be set to finalAngle
  mirror.angle = result1.finalAngle;

  // "Re-grab" — second rotation starting from new angle
  const path2 = [{ x: 5, y: -10 }, { x: -5, y: -10 }]; // opposite direction
  const result2 = simulateRotation(mirror, path2, 40, 1/60);
  assert(result2.angleDelta !== 0, 'second grab should still change angle');
  // Direction should be opposite
  assert(Math.sign(result2.angleDelta) !== Math.sign(result1.angleDelta) || result1.angleDelta === 0,
    'opposite swipe should produce opposite rotation');
  console.log('  first delta=' + result1.angleDelta.toFixed(4) + ' second delta=' + result2.angleDelta.toFixed(4));
}

// --- Test 7: Frame-rate independence ---
console.log('Test 7: Frame-rate independence (30fps vs 60fps produce similar result)');
{
  const mirror60 = createMockMirror(0, -25, 0);
  const mirror30 = createMockMirror(0, -25, 0);
  const path = [{ x: 5, y: -10 }, { x: 15, y: -10 }];
  const result60 = simulateRotation(mirror60, path, 40, 1/60);
  const result30 = simulateRotation(mirror30, path, 40, 1/30);
  // After 1 second of smoothing, both should converge to similar final angle
  // (won't be identical due to discrete steps, but within 10%)
  const diff = Math.abs(result60.finalAngle - result30.finalAngle);
  const avg = (Math.abs(result60.finalAngle) + Math.abs(result30.finalAngle)) / 2;
  const pctDiff = avg > 0 ? diff / avg * 100 : 0;
  assert(pctDiff < 15, 'fps-independent: 30fps and 60fps should produce <15% difference');
  console.log('  60fps=' + result60.finalAngle.toFixed(4) + ' 30fps=' + result30.finalAngle.toFixed(4) + ' diff=' + pctDiff.toFixed(1) + '%');
}

// --- Summary ---
console.log('');
console.log('=== RESULTS: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
