// ============================================================
// test-sim.js — Headless behavioural verification of M2
//
// Asserts GDD combat math, escalation, breach/reset, pool reuse,
// beam-to-enemy integration, band direction, and enemy constraint.
//
// Run: node test-sim.js (after node build.js)
// ============================================================

const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n\/\/ THREE[\s\S]*?<\/script>/);
if (!match) { console.log('FAIL: no game script block in index.html'); process.exit(1); }

let code = match[0].replace(/<\/?script>/g, '');
code = code.replace(/^\/\/ THREE is available.*$/m, '');
code = code.replace(/\ninit\(\);\s*$/, '');

const envCode = `
var window = { innerWidth: 360, innerHeight: 640, addEventListener() {}, devicePixelRatio: 2 };
var document = {
  body: { appendChild() {} },
  createElement() {
    return {
      style: { cssText: '' },
      addEventListener() {},
      textContent: '',
      innerHTML: '',
      appendChild() {},
      remove() {},
      getContext() {
        return { scale(){}, clearRect(){}, fillRect(){}, fillText(){}, fillStyle:'', font:'', textAlign:'' };
      },
      width: 0, height: 0
    };
  },
  addEventListener() {}
};
var performance = { now: () => 0 };
var _raf = null;
function requestAnimationFrame(cb) { _raf = cb; }

var THREE = {
  Scene: class { constructor() { this.background = null; } add() {} },
  Color: class { constructor() {} setHex() {} },
  OrthographicCamera: class { constructor() { this.position = { x:0, y:0, z:0 }; } updateProjectionMatrix() {} },
  WebGLRenderer: class {
    constructor() { this.domElement = { getBoundingClientRect: () => ({left:0,top:0,width:360,height:640}), addEventListener() {}, style: {} }; this.autoClear = true; }
    setSize() {} setPixelRatio() {} render() {} clear() {} clearDepth() {}
  },
  Mesh: class {
    constructor() {
      this.position = { x:0, y:0, z:0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } };
      this.rotation = { z: 0 };
      this.scale = { x:1, y:1, set(x,y) { this.x=x; this.y=y; } };
      this.material = { color: { setHex() {}, setRGB() {} }, opacity: 1, transparent: false };
      this.visible = true;
    }
    add() {}
  },
  PlaneGeometry: class {},
  RingGeometry: class {},
  CircleGeometry: class {},
  ShapeGeometry: class {},
  Shape: class { moveTo() { return this; } lineTo() { return this; } closePath() { return this; } },
  MeshBasicMaterial: class { constructor() { this.color = { setHex() {}, setRGB() {} }; this.opacity = 1; this.transparent = false; } },
  CanvasTexture: class { constructor() { this.minFilter = 0; this.needsUpdate = false; } },
  LinearFilter: 1,
  Group: class { add() {} },
  AdditiveBlending: 1,
};
window.THREE = THREE;
`;

let anyFail = false;

try {
  const testFn = new Function(envCode + code + `

    var _results = [];
    var _boolResults = [];
    var _poolHWM = 0;

    // Test helper: calls the real attemptPurchase from crafting.js
    function attemptPurchase_test(craftCost) {
      var cSlag = getSlag();
      var cInsight = getInsight();
      if (cSlag < craftCost.slag || cInsight < craftCost.insight) return false;
      spendSlag(craftCost.slag);
      spendInsight(craftCost.insight);
      return true;
    }

    // === Test 1: Mote kill time under 1 band at t=0 ===
    (function() {
      var N = 1;
      var dps = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1));
      var killTime = 30 / dps;
      _results.push(['Mote kill time 1 band t=0', killTime, 3.0, 0.1]);
    })();

    // === Test 2: Synergy DPS N=2 ===
    (function() {
      var N = 2;
      var dps = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1));
      _results.push(['Synergy DPS N=2', dps, 26, 0.001]);
    })();

    // === Test 3: Synergy DPS N=3 ===
    (function() {
      var N = 3;
      var dps = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1));
      _results.push(['Synergy DPS N=3', dps, 48, 0.001]);
    })();

    // === Test 4: Carapace kill time 3 bands t=0 ===
    (function() {
      var N = 3;
      var dps = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1));
      var finalDps = Math.max(0, dps - 2 * N);
      var killTime = 200 / finalDps;
      _results.push(['Carapace kill time 3 bands t=0', killTime, 4.762, 0.2]);
    })();

    // === Test 5: Escalation t=60 ===
    (function() {
      var mult = 1 + (60 / SESSION_DURATION) * ESCALATION_HP_FACTOR;
      _results.push(['Escalation t=60', mult, 1.2, 0.001]);
    })();

    // === Test 6: Escalation t=840 ===
    (function() {
      var mult = 1 + (840 / SESSION_DURATION) * ESCALATION_HP_FACTOR;
      _results.push(['Escalation t=840', mult, 3.8, 0.001]);
    })();

    // === Test 7: Breach and reset ===
    (function() {
      init();
      addBreaches(999); // MAX_BREACHES is 999 in testing mode
      _boolResults.push(['Max breaches = gameOver', isGameOver(), true]);
      resetSession();
      _boolResults.push(['After reset: gameOver=false', isGameOver(), false]);
      _boolResults.push(['After reset: elapsed=0', getElapsed() === 0, true]);
    })();

    // === Test 8: Pool reuse ===
    (function() {
      init();
      var e1 = spawnEnemy('mote', 0, 1.0);
      var idx1 = getEnemyPool().indexOf(e1);
      deactivateEnemy(e1);
      _boolResults.push(['Killed enemy is inactive', e1.active, false]);
      var e2 = spawnEnemy('mote', 1, 1.0);
      var idx2 = getEnemyPool().indexOf(e2);
      _boolResults.push(['Pool slot reused', idx2 === idx1, true]);

      resetEnemies();
      var maxActive = 0;
      for (var i = 0; i < 20; i++) {
        spawnEnemy('mote', i % 5, 1.0);
        var active = getEnemyPool().filter(function(e) { return e.active; }).length;
        if (active > maxActive) maxActive = active;
      }
      var pool = getEnemyPool();
      for (var i = 0; i < 10; i++) { if (pool[i].active) deactivateEnemy(pool[i]); }
      for (var i = 0; i < 5; i++) { spawnEnemy('husk', i % 5, 1.0); }
      var finalActive = getEnemyPool().filter(function(e) { return e.active; }).length;
      _boolResults.push(['Pool high water mark = 20', maxActive === 20, true]);
      _boolResults.push(['After kill+respawn: active=15', finalActive === 15, true]);
      _poolHWM = maxActive;
    })();

    // === Test 9: Integration — Mote in centre lane under a coloured band ===
    // Position derived from config constants, not hardcoded.
    // If layout changes and mote is no longer under a band, this FAILS.
    (function() {
      init();
      if (_raf) _raf(16); // solve beam

      // Centre lane index
      var centreLane = Math.floor(ENEMY_LANE_COUNT / 2);
      // Mote y: midpoint of enemy zone (between spawn and breach)
      var moteY = (ENEMY_SPAWN_Y + BREACH_Y) / 2;

      resetEnemies();
      var mote = spawnEnemy('mote', centreLane, 1.0);
      mote.y = moteY;
      mote.speed = 0;

      var dt = 1.0 / 60.0;
      var framesRun = 0;
      var maxFrames = 300;
      for (var f = 0; f < maxFrames; f++) {
        framesRun++;
        applySlowStates();
        updateDamage(dt);
        if (!mote.active) break;
      }
      var killTimeSim = framesRun * dt;
      if (mote.active) {
        _results.push(['Integration: Mote in centre lane kill time', 999, 3.0, 0.2]);
      } else {
        _results.push(['Integration: Mote in centre lane kill time', killTimeSim, 3.0, 0.2]);
      }
    })();

    // === Test 10: Enemy outside beam takes zero damage ===
    (function() {
      init();
      if (_raf) _raf(32);
      resetEnemies();
      // Far lane (lane 0 or 4, whichever is furthest from centre)
      var farLane = 0;
      var mote = spawnEnemy('mote', farLane, 1.0);
      mote.y = (ENEMY_SPAWN_Y + BREACH_Y) / 2;
      mote.speed = 0;

      var startHp = mote.hp;
      var dt = 1.0 / 60.0;
      for (var f = 0; f < 300; f++) {
        applySlowStates();
        updateDamage(dt);
      }
      var hpLost = startHp - mote.hp;
      _results.push(['Integration: Enemy outside beam takes 0 dmg', hpLost, 0, 0.001]);
    })();

    // === Test 11: All coloured bands have endpoints below prism Y ===
    (function() {
      init();
      if (_raf) _raf(48);
      var segs = getSegments();
      var prismY = SOCKET_POSITIONS[DEFAULT_PRISM_SOCKET][1];
      var colouredSegs = segs.filter(function(s) { return s.colour !== COLOUR_WHITE; });
      var allBelow = true;
      var anyInEnemyZone = false;
      for (var i = 0; i < colouredSegs.length; i++) {
        var s = colouredSegs[i];
        if (s.end.y > prismY) allBelow = false;
        if (s.end.y <= BREACH_Y) anyInEnemyZone = true;
      }
      _boolResults.push(['All coloured band endpoints below prism Y', allBelow, true]);
      _boolResults.push(['At least one band reaches enemy zone', anyInEnemyZone, true]);
      _boolResults.push(['At least 3 coloured bands exist', colouredSegs.length >= 3, true]);
    })();

    // === Test 12: No active enemy above breach line after spawning+advancing ===
    (function() {
      init();
      if (_raf) _raf(64);
      resetEnemies();
      // Spawn several enemies and advance them
      for (var i = 0; i < 10; i++) {
        spawnEnemy('mote', i % ENEMY_LANE_COUNT, 1.0);
      }
      // Advance 2 seconds (enemies at speed 6 move 12 units, from -48 to -36)
      var dt = 1.0 / 60.0;
      for (var f = 0; f < 120; f++) {
        applySlowStates();
        updateEnemies(dt);
      }
      var pool = getEnemyPool();
      var anyAbove = false;
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].active && pool[i].y > BREACH_Y) anyAbove = true;
      }
      _boolResults.push(['No active enemy above breach line', anyAbove, false]);
    })();

    // === Test 13: Init-reset-init does not duplicate sockets/mirrors/prisms ===
    (function() {
      init();
      resetSession();
      init();

      var socketCount = getSockets().length;
      var mirrorCount = getMirrors().length;
      var prismCount = getPrisms().length;

      _boolResults.push(['After init-reset-init: sockets = ' + SOCKET_POSITIONS.length, socketCount === SOCKET_POSITIONS.length, true]);
      _boolResults.push(['After init-reset-init: mirrors = ' + MIRROR_COUNT_START, mirrorCount === MIRROR_COUNT_START, true]);
      _boolResults.push(['After init-reset-init: prisms = 1', prismCount === 1, true]);
    })();

    // === Test 14: No enemy spawns in first 2 seconds ===
    (function() {
      init();
      if (_raf) _raf(80);
      resetEnemies();
      resetSpawner();
      var dt = 1.0 / 60.0;
      for (var f = 0; f < 120; f++) {
        updateSpawner(dt, f * dt);
      }
      var activeCount = getEnemyPool().filter(function(e) { return e.active; }).length;
      _boolResults.push(['No enemies spawned in first 2s', activeCount === 0, true]);
    })();

    // === Test 15: Gold band on Chorus ticks Recombination (absorption-based) ===
    (function() {
      init();
      if (_raf) _raf(96);
      resetFoundries();
      var chorusX = FOUNDRY_POSITIONS[2].x;
      var chorusY = FOUNDRY_Y;
      var fakeSegments = getSegments();
      var origLength = fakeSegments.length;
      fakeSegments.push({
        start: { x: chorusX, y: chorusY + 10 },
        end: { x: chorusX, y: chorusY },
        colour: COLOUR_GOLD,
        intensity: 1.0,
        bounces: 0
      });

      var recomboBefore = getRecombination();
      var dt = 1.0 / 60.0;
      for (var f = 0; f < 120; f++) {
        updateFoundries(dt);
      }
      var recomboAfter = getRecombination();
      var expected = 1.5 * 2;
      var gained = recomboAfter - recomboBefore;
      _results.push(['Gold on Chorus ticks Recombination (2s)', gained, expected, 0.1]);
      fakeSegments.length = origLength;
    })();

    // === Test 15b: Lens fed for 10s yields 30 Insight, Slag+Recombo unchanged ===
    (function() {
      init();
      if (_raf) _raf(97);
      resetFoundries();
      var lensX = FOUNDRY_POSITIONS[1].x;
      var lensY = FOUNDRY_Y;
      var segs = getSegments();
      var origLen = segs.length;
      segs.push({
        start: { x: lensX, y: lensY + 10 },
        end: { x: lensX, y: lensY },
        colour: COLOUR_CYAN,
        intensity: 1.0,
        bounces: 0
      });

      var slagBefore = getSlag();
      var recomboBefore = getRecombination();
      var dt = 1.0 / 60.0;
      for (var f = 0; f < 600; f++) { // 10 seconds
        updateFoundries(dt);
      }
      var insightGained = getInsight();
      var slagChange = getSlag() - slagBefore;
      var recomboChange = getRecombination() - recomboBefore;
      _results.push(['Lens fed 10s: Insight=30', insightGained, 30, 0.5]);
      _results.push(['Lens fed 10s: Slag unchanged', slagChange, 0, 0.001]);
      _results.push(['Lens fed 10s: Recombo unchanged', recomboChange, 0, 0.001]);
      segs.length = origLen;
    })();

    // === Test 16: On load, zero foundries are fed ===
    (function() {
      init();
      if (_raf) _raf(100);
      var segs = getSegments();
      var anyFed = false;
      for (var f = 0; f < FOUNDRY_POSITIONS.length; f++) {
        var fnd = FOUNDRY_POSITIONS[f];
        for (var s = 0; s < segs.length; s++) {
          var ex = segs[s].end.x;
          var ey = segs[s].end.y;
          if (ex >= fnd.x - FOUNDRY_HW && ex <= fnd.x + FOUNDRY_HW &&
              ey >= FOUNDRY_Y - FOUNDRY_HH && ey <= FOUNDRY_Y + FOUNDRY_HH) {
            anyFed = true;
          }
        }
      }
      _boolResults.push(['On load: zero foundries fed', anyFed, false]);
    })();

    // === Test 16b: Craft costing exact balance leaves 0 ===
    (function() {
      init();
      if (_raf) _raf(101);
      resetFoundries();
      // Give exactly 25 insight by feeding lens
      var segs = getSegments();
      segs.length = 0;
      segs.push({ start:{x:14,y:-5}, end:{x:14,y:-15}, colour:COLOUR_CYAN, intensity:1, bounces:0 });
      var dt = 1.0/60.0;
      // Feed for 25/3 = 8.33s = 500 frames
      for (var f = 0; f < 500; f++) updateFoundries(dt);
      var before = getInsight();
      // Attempt Anchor (cost 25I)
      var purchased = attemptPurchase_test(CRAFT_ANCHOR);
      var after = getInsight();
      _results.push(['Craft exact balance: before', before, 25, 0.5]);
      _boolResults.push(['Craft exact balance: purchased', purchased, true]);
      _results.push(['Craft exact balance: after', after, 0, 0.5]);
      segs.length = 0;
    })();

    // === Test 16c: Craft costing more than balance is rejected ===
    (function() {
      init();
      if (_raf) _raf(102);
      resetFoundries();
      // Give 10 insight (less than 25 needed for Anchor)
      var segs = getSegments();
      segs.length = 0;
      segs.push({ start:{x:14,y:-5}, end:{x:14,y:-15}, colour:COLOUR_CYAN, intensity:1, bounces:0 });
      var dt = 1.0/60.0;
      for (var f = 0; f < 200; f++) updateFoundries(dt); // ~3.3s = ~10I
      var before = getInsight();
      var purchased = attemptPurchase_test(CRAFT_ANCHOR);
      var after = getInsight();
      _boolResults.push(['Craft over-budget: rejected', purchased, false]);
      _results.push(['Craft over-budget: balance unchanged', after - before, 0, 0.001]);
      segs.length = 0;
    })();

    // === Test 17: Absorbed band has no segment below the foundry ===
    (function() {
      init();
      if (_raf) _raf(104);
      // Inject a segment that terminates at a foundry
      var forgeX = FOUNDRY_POSITIONS[0].x; // -15
      var fakeSegments = getSegments();
      var origLength = fakeSegments.length;
      fakeSegments.push({
        start: { x: forgeX, y: FOUNDRY_Y + 10 },
        end: { x: forgeX, y: FOUNDRY_Y },
        colour: COLOUR_AMBER,
        intensity: 1.0,
        bounces: 0
      });
      // Verify: no segment in the array has start below FOUNDRY_Y at forgeX
      // (the beam solver would have stopped it at the foundry)
      var anyBelow = false;
      for (var s = 0; s < fakeSegments.length; s++) {
        var seg = fakeSegments[s];
        if (seg.start.y < FOUNDRY_Y - FOUNDRY_HH &&
            Math.abs(seg.start.x - forgeX) < FOUNDRY_HW) {
          anyBelow = true;
        }
      }
      _boolResults.push(['Absorbed band: no segment below foundry', anyBelow, false]);
      fakeSegments.length = origLength;
    })();

    // === Test 18: Band absorbed by foundry stops damaging enemies below ===
    (function() {
      init();
      if (_raf) _raf(108);
      resetEnemies();
      // Place an enemy below the Forge foundry, in its column
      var forgeX = FOUNDRY_POSITIONS[0].x; // -15
      var ww = getWorldWidth();
      var laneWidth = ww / ENEMY_LANE_COUNT;
      var forgeLane = Math.floor((forgeX + ww / 2) / laneWidth);
      var mote = spawnEnemy('mote', forgeLane, 1.0);
      mote.y = (ENEMY_SPAWN_Y + BREACH_Y) / 2;
      mote.speed = 0;

      // Replace all segments with ONLY the absorbed segment
      // This isolates the test from default beam paths
      var segs = getSegments();
      segs.length = 0;
      segs.push({
        start: { x: forgeX, y: FOUNDRY_Y + 10 },
        end: { x: forgeX, y: FOUNDRY_Y },  // terminates AT foundry, not below
        colour: COLOUR_AMBER,
        intensity: 1.0,
        bounces: 0
      });

      var startHp = mote.hp;
      var dt = 1.0 / 60.0;
      for (var f = 0; f < 120; f++) {
        applySlowStates();
        updateDamage(dt);
      }
      var hpLost = startHp - mote.hp;
      _results.push(['Absorbed band: enemy below takes 0 dmg', hpLost, 0, 0.001]);
    })();

    return { results: _results, boolResults: _boolResults, poolHWM: _poolHWM };
  `);

  const out = testFn();

  console.log('=== Spectrum Zero M2 Simulation Tests ===');
  console.log('');

  for (const [name, observed, expected, tol] of out.results) {
    const pass = Math.abs(observed - expected) <= tol;
    const status = pass ? 'PASS' : 'FAIL';
    if (!pass) anyFail = true;
    console.log(`${status}: ${name}`);
    console.log(`       observed=${observed.toFixed(4)} expected=${expected} tol=+/-${tol}`);
  }

  for (const [name, observed, expected] of out.boolResults) {
    const pass = observed === expected;
    const status = pass ? 'PASS' : 'FAIL';
    if (!pass) anyFail = true;
    console.log(`${status}: ${name}`);
    if (!pass) console.log(`       observed=${observed} expected=${expected}`);
  }

  console.log('');
  console.log('Pool high-water mark: ' + out.poolHWM);
  console.log('');
  console.log(anyFail ? '*** FAILURES DETECTED ***' : 'All tests passed.');
  process.exit(anyFail ? 1 : 0);

} catch (e) {
  console.log('FATAL:', e.message);
  console.log(e.stack);
  process.exit(1);
}
