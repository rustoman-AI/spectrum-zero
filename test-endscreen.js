// ============================================================
// test-endscreen.js — Verify defeat, victory, and restart paths
// with DEV.INVINCIBLE = false.
// ============================================================

const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n(?:\/\/ ---|\n|\/\/ THREE)[\s\S]*?<\/script>\s*<\/body>/);
if (!match) { console.log('FAIL: no script block'); process.exit(1); }

let code = match[0].replace(/<\/body>/, '').replace(/<\/?script>/g, '');
// Remove intro IIFE and the init() guard — we call init() directly
code = code.replace(/\/\/ --- Intro video layer ---[\s\S]*?\}\)\(\);/, '');
code = code.replace(/\/\/ Boot.*\n.*init\(\).*/, '');

const env = `
var window = { innerWidth: 360, innerHeight: 640, addEventListener() {}, devicePixelRatio: 2, matchMedia() { return { matches: false }; } };
var document = { body: { appendChild() {} }, createElement() { return { style: { cssText: '' }, addEventListener() {}, textContent: '', innerHTML: '', appendChild() {}, remove() {}, getContext() { return { scale(){}, clearRect(){}, fillRect(){}, fillText(){}, fillStyle:'', font:'', textAlign:'', createLinearGradient() { return { addColorStop(){} }; }, strokeStyle:'', lineWidth:0, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){} }; }, width: 0, height: 0 }; }, getElementById() { return { addEventListener() {}, play() {}, pause() {}, style: { display: '' }, ended: false }; }, addEventListener() {} };
var performance = { now: () => 0 };
var _raf = null;
function requestAnimationFrame(cb) { _raf = cb; }
var THREE = { Scene: class { constructor() { this.background = null; } add() {} }, Color: class { constructor() {} setHex() {} }, OrthographicCamera: class { constructor() { this.position = { x:0, y:0, z:0 }; } updateProjectionMatrix() {} }, WebGLRenderer: class { constructor() { this.domElement = { getBoundingClientRect: () => ({left:0,top:0,width:360,height:640}), addEventListener() {}, style: {} }; this.autoClear = true; } setSize() {} setPixelRatio() {} render() {} clear() {} clearDepth() {} }, Mesh: class { constructor() { this.position = { x:0, y:0, z:0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } }; this.rotation = { z: 0 }; this.scale = { x:1, y:1, set(x,y) { this.x=x; this.y=y; } }; this.material = { color: { setHex() {}, setRGB() {} }, opacity: 1, transparent: false }; this.visible = true; this.renderOrder = 0; } add() {} }, PlaneGeometry: class {}, RingGeometry: class {}, CircleGeometry: class {}, ShapeGeometry: class {}, Shape: class { moveTo() { return this; } lineTo() { return this; } closePath() { return this; } }, MeshBasicMaterial: class { constructor() { this.color = { setHex() {}, setRGB() {} }; this.opacity = 1; this.transparent = false; } }, CanvasTexture: class { constructor() { this.minFilter = 0; this.needsUpdate = false; this.wrapS = 0; this.wrapT = 0; this.offset = { x:0, y:0 }; } }, LinearFilter: 1, RepeatWrapping: 1000, Group: class { add() {} }, AdditiveBlending: 1 };
window.THREE = THREE;
`;

try {
  const testFn = new Function(env + code + `
    console.log('=== End Screen Verification (DEV.INVINCIBLE = ' + DEV.INVINCIBLE + ') ===');
    console.log('');

    // --- DEFEAT PATH ---
    console.log('--- Defeat Path ---');
    init();
    if (_raf) _raf(16); // solve beam

    // Confirm not game over initially
    console.log('  Before breaches: gameOver=' + isGameOver());

    // Add 3 breaches (should trigger lose)
    addBreaches(1);
    console.log('  After 1 breach: gameOver=' + isGameOver() + ' breaches=' + getBreaches());
    addBreaches(1);
    console.log('  After 2 breaches: gameOver=' + isGameOver());
    addBreaches(1);
    console.log('  After 3 breaches: gameOver=' + isGameOver());

    if (!isGameOver()) {
      console.log('  FAIL: Game should be over after 3 breaches!');
      return { defeat: false, victory: false, restart: false };
    }
    console.log('  PASS: Defeat screen triggers at 3 breaches');

    // --- RESTART PATH ---
    console.log('');
    console.log('--- Restart Path ---');
    var preRestart = performance.now();
    resetSession();
    var postRestart = performance.now();

    var checks = {
      gameOver: isGameOver() === false,
      elapsed: getElapsed() === 0,
      breaches: getBreaches() === 0,
      slag: getSlag() === 0,
      insight: getInsight() === 0,
      recombination: getRecombination() === 0,
      enemies: getEnemyPool().filter(function(e){return e.active;}).length === 0,
      mirrors: getMirrors().length === MIRROR_COUNT_START,
      mirrorAngle: getMirrors()[0].angle === Math.PI / 4,
      mirrorDamage: getMirrors().every(function(m){ return m.hits === 0 && !m.shattered && !m.reinforced; }),
      prisms: getPrisms().length === 1,
      sockets: getSockets().length === SOCKET_POSITIONS.length,
    };

    var allClean = true;
    for (var k in checks) {
      var status = checks[k] ? 'OK' : 'LEAKED';
      if (!checks[k]) allClean = false;
      console.log('  ' + k + ': ' + status);
    }
    if (allClean) console.log('  PASS: All state reset cleanly');
    else console.log('  FAIL: State leak detected');

    // --- VICTORY PATH ---
    console.log('');
    console.log('--- Victory Path ---');
    init();
    if (_raf) _raf(32);
    notifyDevourerKilled();
    updateSession(0.016);
    console.log('  After Devourer killed: gameOver=' + isGameOver() + ' won=' + isGameWon());
    if (isGameOver() && isGameWon()) {
      console.log('  PASS: Victory screen triggers on Devourer kill');
    } else {
      console.log('  FAIL: Victory not triggered');
    }
    // Simulate 5 more frames — gameOver must stay true, won must stay true
    for (var f = 0; f < 5; f++) {
      if (_raf) _raf(48 + f * 16);
    }
    console.log('  After 5 more frames: gameOver=' + isGameOver() + ' won=' + isGameWon());
    var victoryStays = isGameOver() && isGameWon();
    if (victoryStays) console.log('  PASS: Victory screen persists');
    else console.log('  FAIL: Victory screen was cleared without restart tap');

    // --- SECOND RUN ---
    console.log('');
    console.log('--- Second Run (state leak check) ---');
    resetSession();
    init();
    if (_raf) _raf(48);
    console.log('  gameOver=' + isGameOver() + ' elapsed=' + getElapsed().toFixed(1) + ' breaches=' + getBreaches());
    var secondClean = !isGameOver() && getElapsed() < 1 && getBreaches() === 0;
    console.log(secondClean ? '  PASS: Second run starts clean' : '  FAIL: State leaked into second run');

    return { defeat: true, victory: victoryStays, restart: allClean, secondRun: secondClean };
  `);

  const result = testFn();
  console.log('');
  const allPass = result.defeat && result.victory && result.restart && result.secondRun;
  console.log(allPass ? 'All end-screen paths verified.' : '*** FAILURES DETECTED ***');
  process.exit(allPass ? 0 : 1);

} catch (e) {
  console.log('FATAL:', e.message);
  console.log(e.stack);
  process.exit(1);
}
