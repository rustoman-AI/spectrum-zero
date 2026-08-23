// Verify: focused DPS = 48 at every tier, kill times consistent.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>\n(?:\/\/ ---|\n|\/\/ THREE)[\s\S]*?<\/script>\s*<\/body>/);
if (!match) { process.exit(1); }
let code = match[0].replace(/<\/body>/, '').replace(/<\/?script>/g, '');
code = code.replace(/\/\/ --- Intro video layer ---[\s\S]*?\}\)\(\);/, '');
const env = `var window={innerWidth:360,innerHeight:640,addEventListener(){},devicePixelRatio:2,matchMedia(){return{matches:false}}};var document={body:{appendChild(){}},createElement(){return{style:{cssText:''},addEventListener(){},textContent:'',innerHTML:'',appendChild(){},remove(){},getContext(){return{scale(){},clearRect(){},fillRect(){},fillText(){},fillStyle:'',font:'',textAlign:'',createLinearGradient(){return{addColorStop(){}}},strokeStyle:'',lineWidth:0,beginPath(){},moveTo(){},lineTo(){},stroke(){}}},width:0,height:0}},getElementById(){return{addEventListener(){},play(){},pause(){},style:{display:''},ended:false}},addEventListener(){}};var performance={now:()=>0};var _raf=null;function requestAnimationFrame(cb){_raf=cb;}var THREE={Scene:class{constructor(){this.background=null}add(){}},Color:class{constructor(){}setHex(){}},OrthographicCamera:class{constructor(){this.position={x:0,y:0,z:0}}updateProjectionMatrix(){}},WebGLRenderer:class{constructor(){this.domElement={getBoundingClientRect:()=>({left:0,top:0,width:360,height:640}),addEventListener(){},style:{}};this.autoClear=true}setSize(){}setPixelRatio(){}render(){}clear(){}clearDepth(){}},Mesh:class{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.rotation={z:0};this.scale={x:1,y:1,set(x,y){this.x=x;this.y=y}};this.material={color:{setHex(){},setRGB(){}},opacity:1,transparent:false};this.visible=true;this.renderOrder=0}add(){}},PlaneGeometry:class{},RingGeometry:class{},CircleGeometry:class{},ShapeGeometry:class{},Shape:class{moveTo(){return this}lineTo(){return this}closePath(){return this}},MeshBasicMaterial:class{constructor(){this.color={setHex(){},setRGB(){}};this.opacity=1;this.transparent=false}},CanvasTexture:class{constructor(){this.minFilter=0;this.needsUpdate=false;this.wrapS=0;this.wrapT=0;this.offset={x:0,y:0}}},LinearFilter:1,RepeatWrapping:1000,Group:class{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.visible=true}add(){}},AdditiveBlending:1};window.THREE=THREE;`;

const fn = new Function(env + code + `
  console.log('=== Prism Tier Arithmetic Verification ===');
  console.log('');
  var tiers = [3, 4, 5, 6];
  var huskHp = 180; // phase-2 husk (100 * 1.8)
  var quadHp = 360; // phase-2 quadrireme (200 * 1.8)
  var quadArmour = 2;
  var anyFail = false;

  for (var t = 0; t < tiers.length; t++) {
    var N = tiers[t];
    var td = PRISM_TIERS[N];
    var focusedDPS = N * td.dBase * (1 + td.synergy * (N - 1));
    var singleDPS = td.dBase;
    var focusedAfterArmour = focusedDPS - quadArmour * N;
    var singleAfterArmour = Math.max(0, singleDPS - quadArmour);
    var huskKillFocused = huskHp / focusedDPS;
    var quadKillFocused = quadHp / Math.max(1, focusedAfterArmour);
    var huskKillSingle = huskHp / singleDPS;
    var quadKillSingle = quadHp / Math.max(1, singleAfterArmour);

    console.log('  Tier ' + N + ' (' + td.shape + '): dBase=' + td.dBase + ' synergy=' + td.synergy);
    console.log('    Focused DPS (all on 1):  ' + focusedDPS.toFixed(1) + (Math.abs(focusedDPS - 48) < 0.5 ? ' OK' : ' FAIL (expected 48)'));
    if (Math.abs(focusedDPS - 48) >= 0.5) anyFail = true;
    console.log('    Husk kill (focused):     ' + huskKillFocused.toFixed(1) + 's (travel 12s)');
    console.log('    Quad kill (focused):     ' + quadKillFocused.toFixed(1) + 's (travel 16s) [armour reduces to ' + focusedAfterArmour.toFixed(0) + ' DPS]');
    console.log('    Husk kill (1 band):      ' + huskKillSingle.toFixed(1) + 's (travel 12s) — ' + (huskKillSingle > 12 ? 'FAILS (intended)' : 'kills'));
    console.log('    Quad kill (1 band):      ' + quadKillSingle.toFixed(1) + 's (travel 16s) — ' + (quadKillSingle > 16 ? 'HOPELESS (intended)' : 'kills'));
    console.log('');
  }
  console.log(anyFail ? '*** FOCUSED DPS MISMATCH ***' : 'All tiers: focused DPS = 48. Confirmed.');
`);
fn();
