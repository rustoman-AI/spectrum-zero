// Full 60s session run to check: is any wave unwinnable? Does gold matter?
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n(?:\/\/ ---|\n|\/\/ THREE)[\s\S]*?<\/script>\s*<\/body>/);
if (!match) { console.log('FAIL'); process.exit(1); }
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
  var wallStart = getWallIntegrity();
  for (var f = 0; f < 3600; f++) {
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
  return {
    time: simTime.toFixed(1),
    gameOver: isGameOver(),
    wall: getWallIntegrity().toFixed(1),
    wallLost: (wallStart - getWallIntegrity()).toFixed(1),
    spawns: getSpawnCount(),
    kills: getKillCount()
  };
`);

const r = fn();
console.log('=== 60s Session Run (zero input, DEV.INVINCIBLE=' + false + ') ===');
console.log('  Time: ' + r.time + 's' + (r.gameOver ? ' (GAME OVER)' : ''));
console.log('  Wall: ' + r.wall + '% (lost ' + r.wallLost + ')');
console.log('  Spawns: ' + r.spawns + ' | Kills: ' + r.kills);
