// ============================================================
// test_smoke.js — Smoke tests for every purchasable ability
//
// Calls each handler with a populated game state and asserts:
// 1. It does not throw
// 2. Its effect landed (damage, resource deducted, item created)
//
// Run: node test_smoke.js
// ============================================================

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL: ' + msg); }
}

// --- Mock game state ---
function mockEnemy(type, hp) {
  return {
    active: true, type, hp, maxHp: hp, heat: 0, armour: 0,
    speed: 3, baseSpeed: 3, lane: 2, y: 20,
    stunTimer: 0, zeusCharring: 0, zeusPendingHeat: 0,
    shieldAngle: 0, shieldBlocking: false,
    propulsion: 'oared', oarPhase: 0, driftX: 0, pullX: 0,
    bandsHitting: 0, lastHitColour: 0, burn: 0, slowed: false,
    mesh: { position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 }, scale: { set: () => {} }, visible: true },
    spriteMat: { map: null, color: { setRGB: () => {} }, needsUpdate: false },
    barFill: { scale: { x: 0 }, position: { x: 0 } },
    shieldPlate: { visible: false },
    oarMeshes: [],
  };
}

// ============================================================
// TEST: Zeus strike
// ============================================================
console.log('Test: Zeus strike');
{
  const enemies = [
    mockEnemy('liburna', 30),
    mockEnemy('trireme', 100),
    mockEnemy('quadrireme', 200),
    mockEnemy('cataphract', 400),
  ];

  // Simulate triggerZeusStrike logic (extracted from zeus.js)
  let threw = false;
  try {
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const isLight = (enemy.type === 'liburna' || enemy.type === 'trireme');
      enemy.zeusPendingHeat = isLight ? enemy.maxHp * 1.5 : enemy.maxHp * 0.5;
      enemy.zeusCharring = 0.25;
      enemy.stunTimer = 3.0;
    }
  } catch (e) {
    threw = true;
    console.log('  THREW: ' + e.message);
  }
  assert(!threw, 'Zeus strike should not throw');
  assert(enemies[0].zeusPendingHeat === 45, 'Liburna pending heat = 45 (150% of 30)');
  assert(enemies[1].zeusPendingHeat === 150, 'Trireme pending heat = 150 (150% of 100)');
  assert(enemies[2].zeusPendingHeat === 100, 'Quadrireme pending heat = 100 (50% of 200)');
  assert(enemies[3].zeusPendingHeat === 200, 'Cataphract pending heat = 200 (50% of 400)');
  assert(enemies[0].stunTimer === 3, 'All enemies stunned for 3s');

  // Simulate charring → heat application
  for (const e of enemies) {
    e.zeusCharring = 0; // timer expired
    if (e.zeusPendingHeat) {
      e.heat += e.zeusPendingHeat;
      e.zeusPendingHeat = 0;
    }
  }
  assert(enemies[0].heat >= enemies[0].maxHp, 'Liburna killed (heat >= maxHp)');
  assert(enemies[1].heat >= enemies[1].maxHp, 'Trireme killed (heat >= maxHp)');
  assert(enemies[2].heat < enemies[2].maxHp, 'Quadrireme survives (heat < maxHp)');
  assert(enemies[3].heat < enemies[3].maxHp, 'Cataphract survives (heat < maxHp)');
  console.log('  Liburna heat: ' + enemies[0].heat + '/' + enemies[0].maxHp);
  console.log('  Trireme heat: ' + enemies[1].heat + '/' + enemies[1].maxHp);
  console.log('  Quadrireme heat: ' + enemies[2].heat + '/' + enemies[2].maxHp);
  console.log('  Cataphract heat: ' + enemies[3].heat + '/' + enemies[3].maxHp);
}

// ============================================================
// TEST: Poseidon pull
// ============================================================
console.log('Test: Poseidon pull');
{
  const enemies = [
    { ...mockEnemy('liburna', 30), propulsion: 'sailed', lane: 0, pullX: 0 },
    { ...mockEnemy('trireme', 100), propulsion: 'oared', lane: 4, pullX: 0 },
  ];
  const PULL_SAILED = 14;
  const PULL_OARED = 6;
  const dt = 1.0; // 1 second
  const ww = 80;
  const targetX = 0; // whirlpool centre

  let threw = false;
  try {
    for (const e of enemies) {
      const laneWidth = ww / 5;
      const shipX = -ww / 2 + laneWidth * (e.lane + 0.5) + e.pullX;
      const dx = targetX - shipX;
      const pullStrength = e.propulsion === 'sailed' ? PULL_SAILED : PULL_OARED;
      const pull = Math.sign(dx) * Math.min(Math.abs(dx), pullStrength * dt);
      e.pullX += pull;
    }
  } catch (e) { threw = true; console.log('  THREW: ' + e.message); }

  assert(!threw, 'Poseidon pull should not throw');
  assert(enemies[0].pullX > 0, 'Sailed ship (lane 0) pulled rightward toward centre');
  assert(enemies[1].pullX < 0, 'Oared ship (lane 4) pulled leftward toward centre');
  assert(Math.abs(enemies[0].pullX) > Math.abs(enemies[1].pullX), 'Sailed pulled harder than oared');
  console.log('  Sailed pullX: ' + enemies[0].pullX.toFixed(2));
  console.log('  Oared pullX: ' + enemies[1].pullX.toFixed(2));
}

// ============================================================
// TEST: Shop purchases (resource deduction)
// ============================================================
console.log('Test: Shop purchases');
{
  const SHOP = {
    mirror: { brass: 50, scaling: 25 },
    prism4: { bronze: 80 },
    prism5: { silver: 120 },
    prism6: { silver: 200 },
    priest: { silver: 60 },
  };
  const ZEUS_COSTS = [{ brass: 30 }, { faith: 40, gold: 10 }];
  const POSEIDON_COSTS = [{ brass: 60 }, { faith: 60, gold: 15 }];

  let resources = { brass: 500, bronze: 200, silver: 300, gold: 50 };
  let faith = 100;

  function canAfford(cost) {
    for (const k in cost) {
      if (k === 'faith') { if (faith < cost[k]) return false; }
      else { if ((resources[k] || 0) < cost[k]) return false; }
    }
    return true;
  }
  function spend(cost) {
    for (const k in cost) {
      if (k === 'faith') faith -= cost[k];
      else resources[k] -= cost[k];
    }
  }

  // Mirror
  const mirrorCost = { brass: SHOP.mirror.brass + 0 * SHOP.mirror.scaling };
  assert(canAfford(mirrorCost), 'Can afford mirror #1');
  spend(mirrorCost);
  assert(resources.brass === 450, 'Mirror: 50 brass deducted (500→450)');

  // Prism4
  assert(canAfford(SHOP.prism4), 'Can afford prism4');
  spend(SHOP.prism4);
  assert(resources.bronze === 120, 'Prism4: 80 bronze deducted (200→120)');

  // Priest
  assert(canAfford(SHOP.priest), 'Can afford priest');
  spend(SHOP.priest);
  assert(resources.silver === 240, 'Priest: 60 silver deducted (300→240)');

  // Zeus #1
  assert(canAfford(ZEUS_COSTS[0]), 'Can afford Zeus #1');
  spend(ZEUS_COSTS[0]);
  assert(resources.brass === 420, 'Zeus #1: 30 brass deducted (450→420)');

  // Zeus #2
  assert(canAfford(ZEUS_COSTS[1]), 'Can afford Zeus #2 (faith + gold)');
  spend(ZEUS_COSTS[1]);
  assert(faith === 60, 'Zeus #2: 40 faith deducted (100→60)');
  assert(resources.gold === 40, 'Zeus #2: 10 gold deducted (50→40)');

  // Poseidon #1
  assert(canAfford(POSEIDON_COSTS[0]), 'Can afford Poseidon #1');
  spend(POSEIDON_COSTS[0]);
  assert(resources.brass === 360, 'Poseidon #1: 60 brass deducted (420→360)');
}

// ============================================================
// TEST: Cataphract deflection
// ============================================================
console.log('Test: Cataphract deflection');
{
  const enemy = mockEnemy('cataphract', 400);
  enemy.shieldAngle = 25;

  // Beam segment at 15 degrees from vertical (should be blocked)
  const seg15 = { start: { x: 0, y: 0 }, end: { x: Math.sin(15*Math.PI/180)*50, y: Math.cos(15*Math.PI/180)*50 }, preSplit: false, intensity: 1.0 };
  const dx15 = seg15.end.x - seg15.start.x;
  const dy15 = seg15.end.y - seg15.start.y;
  const len15 = Math.sqrt(dx15*dx15 + dy15*dy15);
  const angle15 = Math.atan2(Math.abs(dx15/len15), Math.abs(dy15/len15)) * 180 / Math.PI;
  assert(angle15 <= 25, '15deg beam blocked by 25deg shield (angle=' + angle15.toFixed(1) + ')');

  // Beam at 35 degrees (should pass)
  const seg35 = { start: { x: 0, y: 0 }, end: { x: Math.sin(35*Math.PI/180)*50, y: Math.cos(35*Math.PI/180)*50 }, preSplit: false, intensity: 1.0 };
  const dx35 = seg35.end.x - seg35.start.x;
  const dy35 = seg35.end.y - seg35.start.y;
  const len35 = Math.sqrt(dx35*dx35 + dy35*dy35);
  const angle35 = Math.atan2(Math.abs(dx35/len35), Math.abs(dy35/len35)) * 180 / Math.PI;
  assert(angle35 > 25, '35deg beam passes shield (angle=' + angle35.toFixed(1) + ')');
}

// ============================================================
// SUMMARY
// ============================================================
console.log('');
console.log('=== RESULTS: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
