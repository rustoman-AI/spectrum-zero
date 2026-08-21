// Headless smoke test — verifies init() runs and beam solves without errors.
// Usage: node test-headless.js (run after node build.js)

const fs = require('fs');

const code = fs.readFileSync('index.html', 'utf8');
const match = code.match(/<script>\n\/\/ THREE is available[\s\S]*?<\/script>/);
if (!match) { console.log('FAIL: no game script block'); process.exit(1); }

let gameCode = match[0].replace(/<\/?script>/g, '').replace(/^\/\/ THREE is available.*$/m, '');

const envMock = `
const window = { innerWidth: 360, innerHeight: 640, addEventListener() {}, devicePixelRatio: 1 };
const document = { body: { appendChild() {} }, createElement() { return { style: {}, addEventListener() {}, textContent: '' }; }, addEventListener() {} };
const performance = { now: () => 0 };
let _rafCallback = null;
function requestAnimationFrame(cb) { _rafCallback = cb; }
`;

const threeMock = `
const THREE = {
  Scene: class { constructor() { this.background = null; } add() {} },
  Color: class { constructor() {} setHex() {} },
  OrthographicCamera: class {
    constructor() { this.position = { x:0, y:0, z:0 }; }
    updateProjectionMatrix() {}
  },
  WebGLRenderer: class {
    constructor() {
      this.domElement = {
        getBoundingClientRect: () => ({ left:0, top:0, width:360, height:640 }),
        addEventListener: () => {},
        style: {}
      };
    }
    setSize() {}
    setPixelRatio() {}
    render() {}
  },
  Mesh: class {
    constructor() {
      this.position = { x:0, y:0, z:0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } };
      this.rotation = { z: 0 };
      this.scale = { x:1, y:1 };
      this.material = { color: { setHex(){}, setRGB(){} }, opacity: 1, transparent: false };
      this.visible = true;
    }
  },
  PlaneGeometry: class {},
  RingGeometry: class {},
  CircleGeometry: class {},
  ShapeGeometry: class {},
  Shape: class { moveTo() { return this; } lineTo() { return this; } closePath() { return this; } },
  MeshBasicMaterial: class {
    constructor() { this.color = { setHex(){}, setRGB(){} }; this.opacity = 1; this.transparent = false; }
  },
  Group: class { add() {} },
  AdditiveBlending: 1,
};
window.THREE = THREE;
`;

gameCode = gameCode.replace(/\ninit\(\);\s*$/, '');

const fullCode = envMock + threeMock + gameCode;

try {
  const fn = new Function(fullCode + `
    init();
    if (_rafCallback) _rafCallback(16);
    return { segments: getSegments().length, mirrors: getMirrors().length, prisms: getPrisms().length };
  `);
  const result = fn();
  console.log('PASS - init OK, segments:', result.segments, 'mirrors:', result.mirrors, 'prisms:', result.prisms);
  process.exit(0);
} catch (e) {
  console.log('FAIL:', e.message);
  console.log(e.stack);
  process.exit(1);
}
