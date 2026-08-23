// Verify the refactored build: full session, currency accumulation, layout checks.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (!match) { console.log('FAIL'); process.exit(1); }
let code = match[1];
code = code.replace(/\/\/ --- Intro video layer ---[\s\S]*?\}\)\(\);/, '');

const env = `var window={innerWidth:360,innerHeight:640,addEventListener(){},devicePixelRatio:2,matchMedia(){return{matches:false}}};var document={body:{appendChild(){}},createElement(){return{style:{cssText:''},addEventListener(){},textContent:'',innerHTML:'',appendChild(){},remove(){},getContext(){return{scale(){},clearRect(){},fillRect(){},fillText(){},fillStyle:'',font:'',textAlign:'',createLinearGradient(){return{addColorStop(){}}},strokeStyle:'',lineWidth:0,beginPath(){},moveTo(){},lineTo(){},stroke(){}}},width:0,height:0}},getElementById(){return{addEventListener(){},play(){},pause(){},style:{display:''},ended:false}},addEventListener(){}};var performance={now:()=>0};var _raf=null;function requestAnimationFrame(cb){_raf=cb;}var THREE={Scene:class{constructor(){this.background=null}add(){}},Color:class{constructor(){}setHex(){}},OrthographicCamera:class{constructor(){this.position={x:0,y:0,z:0}}updateProjectionMatrix(){}},WebGLRenderer:class{constructor(){this.domElement={getBoundingClientRect:()=>({left:0,top:0,width:360,height:640}),addEventListener(){},style:{}};this.autoClear=true}setSize(){}setPixelRatio(){}render(){}clear(){}clearDepth(){}},Mesh:class{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.rotation={z:0};this.scale={x:1,y:1,set(x,y){this.x=x;this.y=y}};this.material={color:{setHex(){},setRGB(){}},opacity:1,transparent:false};this.visible=true;this.renderOrder=0}add(){}},PlaneGeometry:class{},RingGeometry:class{},CircleGeometry:class{},ShapeGeometry:class{},Shape:class{moveTo(){return this}lineTo(){return this}closePath(){return this}},MeshBasicMaterial:class{constructor(){this.color={setHex(){},setRGB(){}};this.opacity=1;this.transparent=false}},CanvasTexture:class{constructor(){this.minFilter=0;this.needsUpdate=false;this.wrapS=0;this.wrapT=0;this.offset={x:0,y:0}}},LinearFilter:1,RepeatWrapping:1000,Group:class{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.visible=true}add(){}},AdditiveBlending:1};window.THREE=THREE;`;

const fn = new Function(env + code + `
  init();
  if (_raf) _raf(16);

  // Full session sim
  var dt = 1.0/60.0, simTime = 0;
  for (var f = 0; f < 600*60; f++) {
    simTime += dt;
    updateSession(dt);
    if (isGameOver()) break;
    updateSpawner(dt, simTime);
    applySlowStates();
    var dmg = updateEnemies(dt);
    if (dmg > 0) addBreaches(dmg);
    updateDamage(dt);
    updateFoundries(dt);
  }

  var res = getResources();
  var segs = getSegments();

  return {
    simTime: simTime.toFixed(1),
    gameOver: isGameOver(),
    wall: getWallIntegrity().toFixed(1),
    spawns: getSpawnCount(),
    kills: getKillCount(),
    segments: segs.length,
    brass: res.brass.toFixed(0),
    bronze: res.bronze.toFixed(0),
    silver: res.silver.toFixed(0),
    gold: res.gold.toFixed(0),
    beamReachesShips: segs.some(function(s) { return s.end.y > SHIP_SPAWN_Y - 10; }),
    segEndpoints: segs.map(function(s) { return '(' + s.end.x.toFixed(0) + ',' + s.end.y.toFixed(0) + ')'; }),
  };
`);

const r = fn();
console.log('=== Refactored Build Verification (600s session) ===');
console.log('');
console.log('  Duration: ' + r.simTime + 's' + (r.gameOver ? ' (GAME OVER)' : ' (SURVIVED)'));
console.log('  Wall: ' + r.wall + '%');
console.log('  Spawns: ' + r.spawns + ' | Kills: ' + r.kills);
console.log('  Segments: ' + r.segments);
console.log('  Beam endpoints: ' + r.segEndpoints.join(' '));
console.log('  Beam reaches ship zone: ' + r.beamReachesShips);
console.log('');
console.log('  --- Currencies at end ---');
console.log('  Brass: ' + r.brass + ' (expected: ~' + Math.floor(parseFloat(r.simTime) * 5) + ' at 5/s)');
console.log('  Bronze: ' + r.bronze + ' (expected: ~' + Math.floor(parseFloat(r.simTime) * 3) + ')');
console.log('  Silver: ' + r.silver + ' (expected: ~' + Math.floor(parseFloat(r.simTime) * 2) + ')');
console.log('  Gold: ' + r.gold + ' (expected: ~' + Math.floor(parseFloat(r.simTime) * 1) + ')');
console.log('');
console.log('  --- Reachability (can player afford upgrades in 600s?) ---');
var t = parseFloat(r.simTime);
console.log('  Prism 4 (300 bronze): reachable at ' + (300/3).toFixed(0) + 's — ' + (t > 100 ? 'YES' : 'NO'));
console.log('  Prism 5 (200 silver): reachable at ' + (200/2).toFixed(0) + 's — ' + (t > 100 ? 'YES' : 'NO'));
console.log('  Priest (100 silver): reachable at ' + (100/2).toFixed(0) + 's — ' + (t > 50 ? 'YES' : 'NO'));
