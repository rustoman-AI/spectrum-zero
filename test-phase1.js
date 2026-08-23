// ============================================================
// test-phase1.js — Simulate 60s of phase 1 with zero input.
// Reports: spawns/min, kills/min, breaches/min, spawn interval.
// Answers: is phase 1 survivable with a single band?
// ============================================================

const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n\/\/ THREE[\s\S]*?<\/script>/);
if (!match) { console.log('FAIL: no script block'); process.exit(1); }

let code = match[0].replace(/<\/?script>/g, '').replace(/^\/\/ THREE is available.*$/m, '');
code = code.replace(/\ninit\(\);\s*$/, '');

const env = `
var window = { innerWidth: 360, innerHeight: 640, addEventListener() {}, getElementById() { return { addEventListener() {}, play() {}, pause() {}, style: { display: '' }, ended: false }; }, devicePixelRatio: 2 };
var document = { body: { appendChild() {} }, createElement() { return { style: { cssText: '' }, addEventListener() {}, getElementById() { return { addEventListener() {}, play() {}, pause() {}, style: { display: '' }, ended: false }; }, textContent: '', innerHTML: '', appendChild() {}, remove() {}, getContext() { return { scale(){}, clearRect(){}, fillRect(){}, fillText(){}, fillStyle:'', font:'', textAlign:'' }; }, width: 0, height: 0 }; }, addEventListener() {}, getElementById() { return { addEventListener() {}, play() {}, pause() {}, style: { display: '' }, ended: false }; } };
var performance = { now: () => 0 };
var _raf = null;
function requestAnimationFrame(cb) { _raf = cb; }
var THREE = { Scene: class { constructor() { this.background = null; } add() {} }, Color: class { constructor() {} setHex() {} }, OrthographicCamera: class { constructor() { this.position = { x:0, y:0, z:0 }; } updateProjectionMatrix() {} }, WebGLRenderer: class { constructor() { this.domElement = { getBoundingClientRect: () => ({left:0,top:0,width:360,height:640}), addEventListener() {}, getElementById() { return { addEventListener() {}, play() {}, pause() {}, style: { display: '' }, ended: false }; }, style: {} }; this.autoClear = true; } setSize() {} setPixelRatio() {} render() {} clear() {} clearDepth() {} }, Mesh: class { constructor() { this.position = { x:0, y:0, z:0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } }; this.rotation = { z: 0 }; this.scale = { x:1, y:1, set(x,y) { this.x=x; this.y=y; } }; this.material = { color: { setHex() {}, setRGB() {} }, opacity: 1, transparent: false }; this.visible = true; this.renderOrder = 0; } add() {} }, PlaneGeometry: class {}, RingGeometry: class {}, CircleGeometry: class {}, ShapeGeometry: class {}, Shape: class { moveTo() { return this; } lineTo() { return this; } closePath() { return this; } }, MeshBasicMaterial: class { constructor() { this.color = { setHex() {}, setRGB() {} }; this.opacity = 1; this.transparent = false; } }, CanvasTexture: class { constructor() { this.minFilter = 0; this.needsUpdate = false; } }, LinearFilter: 1, Group: class { add() {} }, AdditiveBlending: 1 };
window.THREE = THREE;
`;

const fn = new Function(env + code + `
  init();
  // Run one frame to solve beam
  if (_raf) _raf(16);

  // Now simulate 60 seconds at 60fps with the full game loop (minus rendering)
  var dt = 1.0 / 60.0;
  var totalBreaches = 0;
  var simTime = 0;

  for (var f = 0; f < 3600; f++) { // 60 seconds
    simTime += dt;
    updateSession(dt);
    if (isGameOver()) break;
    updateSpawner(dt, simTime);
    applySlowStates();
    var b = updateEnemies(dt);
    if (b > 0) { totalBreaches += b; addBreaches(b); }
    updateDamage(dt);
    updateFoundries(dt);
  }

  var spawns = getSpawnCount();
  var kills = getKillCount();
  var simElapsed = simTime;

  // Calculate kills/min a single band can achieve
  // DPS = 10 (1 band, D_BASE=10, N=1)
  // Mote HP at average t=30: hp = 30 * (1 + 30/900 * 3) = 30 * 1.1 = 33
  // Kill time per mote = 33/10 = 3.3s
  // Kills/min from 1 band = 60/3.3 = 18.2
  var avgMoteHp = 30 * (1 + (30 / SESSION_DURATION) * ESCALATION_HP_FACTOR);
  var killTimePerMote = avgMoteHp / D_BASE;
  var maxKillsPerMin = 60 / killTimePerMote;

  return {
    simElapsed: simElapsed.toFixed(1),
    gameOver: isGameOver(),
    spawns: spawns,
    kills: kills,
    breaches: totalBreaches,
    spawnsPerMin: (spawns / (simElapsed / 60)).toFixed(1),
    killsPerMin: (kills / (simElapsed / 60)).toFixed(1),
    breachesPerMin: (totalBreaches / (simElapsed / 60)).toFixed(1),
    maxKillsPerMinTheory: maxKillsPerMin.toFixed(1),
    avgMoteHp: avgMoteHp.toFixed(1),
    killTimePerMote: killTimePerMote.toFixed(2),
    moteSpeed: ENEMY_TYPES.mote.speed.toFixed(2),
    travelTime: (ENEMY_TRAVEL_DIST / ENEMY_TYPES.mote.speed).toFixed(1),
    spawnInterval: '3.5s (start) ramping to 2.0s'
  };
`);

const r = fn();
console.log('=== Phase 1 Headless Simulation (60s, zero input) ===');
console.log('');
console.log('  simElapsed:          ' + r.simElapsed + 's' + (r.gameOver ? ' (GAME OVER)' : ''));
console.log('  Spawns:           ' + r.spawns);
console.log('  Kills:            ' + r.kills);
console.log('  Breaches:         ' + r.breaches);
console.log('');
console.log('  Spawns/min:       ' + r.spawnsPerMin);
console.log('  Kills/min:        ' + r.killsPerMin);
console.log('  Breaches/min:     ' + r.breachesPerMin);
console.log('');
console.log('  Spawn interval:   ' + r.spawnInterval);
console.log('  Mote speed:       ' + r.moteSpeed + ' u/s');
console.log('  Travel time:      ' + r.travelTime + 's (spawn to breach)');
console.log('  Avg mote HP@t=30: ' + r.avgMoteHp);
console.log('  Kill time/mote:   ' + r.killTimePerMote + 's (1 band)');
console.log('  Max kills/min:    ' + r.maxKillsPerMinTheory + ' (theoretical, 1 band)');
console.log('');
if (parseFloat(r.spawnsPerMin) > parseFloat(r.maxKillsPerMinTheory)) {
  console.log('  *** SPAWN RATE EXCEEDS 1-BAND KILL RATE ***');
  console.log('  Phase 1 is MATHEMATICALLY UNSURVIVABLE with 1 band.');
} else {
  console.log('  Spawn rate is below 1-band kill capacity. Phase 1 is survivable.');
}
console.log('');
if (r.breaches > 0) {
  console.log('  RESULT: ' + r.breaches + ' breaches in 60s. Teaching phase is TOO HARD.');
} else {
  console.log('  RESULT: 0 breaches in 60s. Teaching phase is survivable.');
}

