// Full session sim: 300s (into phase 2), default beams, zero player input.
// Reports: wall integrity, kills, gold slow usage, multi-mirror usage.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n(?:\/\/ ---|\n|\/\/ THREE)[\s\S]*?<\/script>\s*<\/body>/);
if (!match) { console.log('FAIL: no script block'); process.exit(1); }
let code = match[0].replace(/<\/body>/, '').replace(/<\/?script>/g, '');
code = code.replace(/\/\/ --- Intro video layer ---[\s\S]*?\}\)\(\);/, '');

const env = `
var window={innerWidth:360,innerHeight:640,addEventListener(){},devicePixelRatio:2,matchMedia(){return{matches:false}}};
var document={body:{appendChild(){}},createElement(){return{style:{cssText:''},addEventListener(){},textContent:'',innerHTML:'',appendChild(){},remove(){},getContext(){return{scale(){},clearRect(){},fillRect(){},fillText(){},fillStyle:'',font:'',textAlign:'',createLinearGradient(){return{addColorStop(){}}},strokeStyle:'',lineWidth:0,beginPath(){},moveTo(){},lineTo(){},stroke(){}}},width:0,height:0}},getElementById(){return{addEventListener(){},play(){},pause(){},style:{display:''},ended:false}},addEventListener(){}};
var performance={now:()=>0};var _raf=null;function requestAnimationFrame(cb){_raf=cb;}
var THREE={Scene:class{constructor(){this.background=null}add(){}},Color:class{constructor(){}setHex(){}},OrthographicCamera:class{constructor(){this.position={x:0,y:0,z:0}}updateProjectionMatrix(){}},WebGLRenderer:class{constructor(){this.domElement={getBoundingClientRect:()=>({left:0,top:0,width:360,height:640}),addEventListener(){},style:{}};this.autoClear=true}setSize(){}setPixelRatio(){}render(){}clear(){}clearDepth(){}},Mesh:class{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.rotation={z:0};this.scale={x:1,y:1,set(x,y){this.x=x;this.y=y}};this.material={color:{setHex(){},setRGB(){}},opacity:1,transparent:false};this.visible=true;this.renderOrder=0}add(){}},PlaneGeometry:class{},RingGeometry:class{},CircleGeometry:class{},ShapeGeometry:class{},Shape:class{moveTo(){return this}lineTo(){return this}closePath(){return this}},MeshBasicMaterial:class{constructor(){this.color={setHex(){},setRGB(){}};this.opacity=1;this.transparent=false}},CanvasTexture:class{constructor(){this.minFilter=0;this.needsUpdate=false;this.wrapS=0;this.wrapT=0;this.offset={x:0,y:0}}},LinearFilter:1,RepeatWrapping:1000,Group:class{add(){}},AdditiveBlending:1};
window.THREE=THREE;
`;

const fn = new Function(env + code + `
  init();
  if (_raf) _raf(16);

  var dt = 1.0/60.0;
  var simTime = 0;
  var goldSlowCount = 0; // frames where any enemy was slowed by gold
  var maxSimTime = 300; // 5 minutes

  for (var f = 0; f < maxSimTime * 60; f++) {
    simTime += dt;
    updateSession(dt);
    if (isGameOver()) break;
    updateSpawner(dt, simTime);
    applySlowStates();

    var _pool = getEnemyPool();
    for (var i = 0; i < _pool.length; i++) {
      if (_pool[i].active && _pool[i].slowed) { goldSlowCount++; break; }
    }

    var dmg = updateEnemies(dt);
    if (dmg > 0) addBreaches(dmg);
    updateDamage(dt);
    updateFoundries(dt);
  }

  // Check how many mirrors are in the beam path (segments that reflect off mirrors)
  var segs = getSegments();
  var mirrorsInPath = new Set();
  // The beam solver records mirror hits — check segment bounces
  // Actually we can't directly tell from segments which mirrors are hit.
  // Instead check: how many mirrors have non-default angles (player moved them)?
  // In this zero-input sim, ALL mirrors stay at default = no player intervention.

  return {
    simTime: simTime.toFixed(1),
    gameOver: isGameOver(),
    wall: getWallIntegrity().toFixed(1),
    spawns: getSpawnCount(),
    kills: getKillCount(),
    goldSlowFrames: goldSlowCount,
    segments: segs.length
  };
`);

const r = fn();
console.log('=== Full Session Verification (300s, zero input) ===');
console.log('');
console.log('  Duration: ' + r.simTime + 's' + (r.gameOver ? ' (GAME OVER)' : ' (survived)'));
console.log('  Wall integrity: ' + r.wall + '%');
console.log('  Spawns: ' + r.spawns);
console.log('  Kills: ' + r.kills);
console.log('  Kill rate: ' + (r.kills / r.spawns * 100).toFixed(0) + '%');
console.log('  Gold slow frames: ' + r.goldSlowFrames + (r.goldSlowFrames > 0 ? ' (gold band hitting enemies)' : ' (gold never hit an enemy)'));
console.log('  Beam segments: ' + r.segments);
console.log('');

// Analysis
console.log('--- Analysis ---');

if (r.gameOver && parseFloat(r.simTime) < 60) {
  console.log('  PROBLEM: Game over in under 60s — phase 1 is unwinnable.');
} else if (r.gameOver && parseFloat(r.simTime) < 240) {
  console.log('  NOTE: Game over before phase 2 ends. Pressure may be too high without input.');
} else if (!r.gameOver) {
  console.log('  OK: Survived 300s with zero input. Wall at ' + r.wall + '%.');
}

if (r.goldSlowFrames > 0) {
  console.log('  Gold slow IS active: default beam path hits enemies with gold band.');
} else {
  console.log('  Gold slow NOT active in zero-input run (expected: gold goes to bottom edge, not enemies).');
  console.log('  A player must redirect gold to slow ships — this is the strategic choice.');
}

console.log('');
console.log('  Single-mirror question: with zero input, only default beam paths are active.');
console.log('  The sim cannot test whether a PLAYER uses multiple mirrors.');
console.log('  What it CAN test: is the game survivable enough that a player has TIME');
console.log('  to set up multi-mirror configurations before dying?');
console.log('  Answer: ' + (!r.gameOver || parseFloat(r.simTime) > 120 ? 'YES' : 'NO'));
