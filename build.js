// ============================================================
// build.js — Concatenates src/ files into index.html
//
// Usage: node build.js
// No dependencies. Reads src files in order, injects into template.
// ============================================================

const fs = require('fs');
const path = require('path');

// Dependency order — mirrors the module graph.
// config first (no deps), then renderer, beam, beam-render, mirror, prism, input, main last.
const SOURCE_FILES = [
  'src/config.js',
  'src/strings.js',
  'src/renderer.js',
  'src/background.js',
  'src/fortress.js',
  'src/zeus.js',
  'src/poseidon.js',
  'src/helios.js',
  'src/beam.js',
  'src/beam-render.js',
  'src/mirror.js',
  'src/prism.js',
  'src/enemy.js',
  'src/enemy-spawner.js',
  'src/foundry.js',
  'src/crafting.js',
  'src/effects.js',
  'src/audio.js',
  'src/damage.js',
  'src/tutorial.js',
  'src/session.js',
  'src/input.js',
  'src/main.js',
];

// Guard: every src/*.js on disk must be listed in SOURCE_FILES. This catches
// the "added a new module but forgot to bundle it" bug, where callers reference
// functions that are never defined and the game boots to a black screen.
const srcDir = path.join(__dirname, 'src');
const onDisk = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).map(f => 'src/' + f);
const missing = onDisk.filter(f => !SOURCE_FILES.includes(f));
if (missing.length > 0) {
  console.error(`\n❌ BUILD FAILED: src file(s) not listed in SOURCE_FILES: ${missing.join(', ')}`);
  console.error('  Add them to build.js SOURCE_FILES (in dependency order) or the bundle will omit them.\n');
  process.exit(1);
}

// Read and concatenate source files
let gameCode = '';
for (const file of SOURCE_FILES) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Missing source file: ${file}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  // Strip ES module import/export statements (they won't work inline)
  const stripped = stripModuleSyntax(content);
  gameCode += `// === ${file} ===\n${stripped}\n\n`;
}

// HTML template
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Burning Glass</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; touch-action: none; }
canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="intro-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;">
  <video id="intro-video" src="./assets/fixed_intro.mp4?v=4" poster="./assets/intro_poster.jpg?v=4"
         playsinline webkit-playsinline preload="auto"
         style="max-width:100%;max-height:100%;object-fit:contain;"></video>
  <div id="intro-tap" style="position:absolute;bottom:15%;color:#fff;font:bold 16px monospace;opacity:0.8;pointer-events:none;">Tap to begin</div>
</div>
<div id="win-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:99998;background:#000;display:none;pointer-events:none;align-items:center;justify-content:center;">
  <video id="win-video" playsinline webkit-playsinline preload="none"
         style="max-width:100%;max-height:100%;object-fit:contain;"></video>
</div>
<script src="./vendor/three.min.js"></script>
<script>
// THREE is available as a global from the vendor script above

// --- Intro video layer ---
(function() {
  var layer = document.getElementById('intro-layer');
  var video = document.getElementById('intro-video');
  var tapMsg = document.getElementById('intro-tap');
  var started = false;
  var gameStarted = false;
  var debugMode = window.location.search.indexOf('debug=1') > -1;
  var debugEl = null;

  if (debugMode) {
    debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;bottom:10px;left:10px;color:lime;font:11px monospace;z-index:999999;background:rgba(0,0,0,0.8);padding:6px;white-space:pre;';
    document.body.appendChild(debugEl);
  }
  updateDebugInfo('loading video');

  // Force layout so video has real dimensions (iOS refuses zero-size play)
  void video.offsetHeight;

  // File facts (verified with ffprobe): assets/fixed_intro.mp4 is H.264
  // Constrained-Baseline L3.1, 720x1280, AAC-LC, moov BEFORE mdat (fast-start),
  // duration 10.625s. silencedetect finds NO trailing silence — audio runs to
  // the end — so the correct handoff is the natural 'ended' event, not any
  // mid-file cut. Two failsafes below guarantee the game starts regardless, and
  // a progress-aware watchdog guarantees a PLAYING video is never cut early.

  var HARD_CAP_MS = 15000; // absolute ceiling (> 10.625s + buffer): game starts no matter what

  // --- TAP HANDLER: begin muted playback from the user gesture ---
  layer.addEventListener('pointerdown', function onTap() {
    if (started) return;
    started = true;
    tapMsg.style.display = 'none';
    // Muted play() always succeeds from a gesture; unmute inside the same
    // activation so the narration is audible where the browser allows it.
    video.muted = true;
    var p = video.play();
    if (p && p.then) {
      p.then(function() {
        video.muted = false;
        updateDebugInfo('playing');
        armWatchdog(); // only watch progress once playback has actually begun
      }).catch(function(err) {
        // Could not play at all (autoplay refusal, decode failure, etc.) —
        // the game must start regardless.
        updateDebugInfo('play() rejected: ' + err.name);
        startGame();
      });
    } else {
      video.muted = false;
      armWatchdog();
    }
  });

  // Normal transition: the video played through to its end.
  video.addEventListener('ended', function() {
    updateDebugInfo('ended');
    startGame();
  });

  // Any hard media error -> start the game (never block on a broken file).
  video.addEventListener('error', function() {
    updateDebugInfo('video error');
    startGame();
  });

  // Progress-aware watchdog: instead of a blind timer that can cut a playing
  // video (the old 4s "stuck" check and the 3s 'stalled' handler both could),
  // we poll currentTime. We only hand off early if the video has genuinely
  // STOPPED advancing for a while (readiness/stall failure). A steadily
  // advancing video is left alone to reach 'ended'. The hard cap is the final
  // backstop so the game always starts.
  var watchStart = 0;
  var lastTime = -1;
  var stalledFor = 0;
  var watchdog = null;
  function armWatchdog() {
    if (watchdog) return;
    watchStart = Date.now();
    lastTime = video.currentTime;
    watchdog = setInterval(function() {
      if (gameStarted) { clearInterval(watchdog); return; }
      var t = video.currentTime;
      var advanced = t > lastTime + 0.05;
      if (advanced) { stalledFor = 0; lastTime = t; }
      else { stalledFor += 250; }
      // Never advanced past the very start within 4s => it never really played.
      var neverStarted = (t < 0.3 && Date.now() - watchStart > 4000);
      // Was playing but has been frozen for >3s mid-clip => stalled buffer.
      var frozenMidClip = (t >= 0.3 && stalledFor >= 3000);
      // Absolute ceiling regardless of state.
      var pastCap = (Date.now() - watchStart > HARD_CAP_MS);
      if (neverStarted || frozenMidClip || pastCap) {
        updateDebugInfo('FAILSAFE: ' + (pastCap ? 'cap' : neverStarted ? 'never-started' : 'frozen'));
        clearInterval(watchdog);
        startGame();
      }
    }, 250);
  }

  // Absolute backstop even if the tap's play() promise never settles (some
  // mobile browsers): if playback hasn't begun a while after the first tap,
  // start the game so recording is never blocked on a dead video.
  layer.addEventListener('pointerdown', function armHardCap() {
    setTimeout(function() {
      if (!gameStarted && (video.paused || video.currentTime < 0.3)) {
        updateDebugInfo('FAILSAFE: no-playback backstop');
        startGame();
      }
    }, HARD_CAP_MS);
  }, { once: true });

  // Skip by tapping DURING playback (second tap onward), once it's actually rolling.
  video.addEventListener('pointerdown', function(e) {
    if (started && video.currentTime > 0.3 && !video.ended && !gameStarted) {
      e.stopPropagation();
      video.pause();
      startGame();
    }
  });

  function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    layer.style.display = 'none';
    try {
      if (typeof init === 'function') init();
      updateDebugInfo('startGame OK');
    } catch(e) {
      updateDebugInfo('init ERROR: ' + e.message);
    }
  }

  function updateDebugInfo(msg) {
    if (!debugEl) return;
    debugEl.textContent = 'DEBUG ' + msg + ' | vidReady=' + (video ? video.readyState : '?') + ' | game=' + gameStarted;
  }
})();

// --- Defeat: fully in-engine (no video) ---
// The defeat cinematic was removed. Defeat is handled entirely in-engine by
// session.js (dark-red dim + debris + fade-in stats overlay). This no-op stub
// remains only so any stray caller degrades gracefully to the in-engine screen.
window.playDefeatCinematic = function(onDone) { if (typeof onDone === 'function') onDone(); };

// --- Win video layer ---
// Plays on every win. Skippable. Falls back to victory screen on any failure.
(function() {
  var winLayer = document.getElementById('win-layer');
  var winVideo = document.getElementById('win-video');
  var winActive = false;
  var winDone = false;

  // Preload: start fetching a few seconds into gameplay
  setTimeout(function() {
    winVideo.src = './assets/archimed_win.mp4?v=4';
    winVideo.load();
  }, 8000);

  // Exposed globally so session.js triggerWin can call it
  window.playWinCinematic = function(onDone) {
    if (winActive) { onDone(); return; }
    winActive = true;
    winDone = false;

    var finish = function() {
      if (winDone) return;
      winDone = true;
      winVideo.pause();
      winLayer.style.display = 'none';
      winLayer.style.pointerEvents = 'none'; // stop intercepting taps
      winActive = false;
      onDone();
    };

    // If video not ready, skip straight to victory screen
    if (!winVideo.src || winVideo.readyState < 2) {
      finish();
      return;
    }

    // Show layer and play (enable pointer-events only while playing, for skip tap)
    winLayer.style.display = 'flex';
    winLayer.style.pointerEvents = 'auto';
    winLayer.style.background = '#000';
    winVideo.muted = true;
    var playPromise = winVideo.play();
    if (playPromise && playPromise.then) {
      playPromise.then(function() { winVideo.muted = false; })
        .catch(function() { finish(); });
    } else {
      winVideo.muted = false;
    }

    // Narration runs to ~8.0s (file is 8.3s). Let video play to end.
    // 'ended' event below handles handoff.

    // Fallbacks
    winVideo.addEventListener('ended', finish);
    winVideo.addEventListener('error', finish);

    // Skip on tap
    winLayer.addEventListener('pointerdown', function skipTap() {
      winLayer.removeEventListener('pointerdown', skipTap);
      finish();
    });

    // Failsafe: 12s max
    setTimeout(function() { if (!winDone) finish(); }, 12000);
  };
})();

${gameCode}
</script>
</body>
</html>
`;

const outPath = path.join(__dirname, 'index.html');
fs.writeFileSync(outPath, html, 'utf8');

// --- Syntax check: parse the generated script to catch errors before shipping ---
const scriptMatch = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
  } catch (e) {
    console.error(`\n❌ BUILD FAILED: Syntax error in generated index.html`);
    console.error(`  ${e.message}\n`);
    fs.unlinkSync(outPath);
    process.exit(1);
  }
}

// --- Strict-mode lint: catch undefined references ---
// Wraps game code in strict mode inside a VM with browser-like globals stubbed.
// Any ReferenceError (undefined variable) fails the build.
const vm = require('vm');
if (scriptMatch) {
  const strictCode = `"use strict";\n(function(){\n${scriptMatch[1]}\n})();`;
  // Stub browser globals so declarations don't throw for missing DOM/WebGL
  const sandbox = {
    THREE: new Proxy({}, { get: () => function(){return {prototype:{},setAttribute:()=>{},connect:()=>({connect:()=>({connect:()=>({})})}),start:()=>{},stop:()=>{},getChannelData:()=>new Float32Array(1)}} }),
    window: { location:{search:''}, matchMedia:()=>({matches:false}), AudioContext: function(){}, webkitAudioContext: function(){}, devicePixelRatio:1 },
    document: { createElement:()=>({getContext:()=>({clearRect:()=>{},fillRect:()=>{},fillText:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},arc:()=>{},ellipse:()=>{},quadraticCurveTo:()=>{},scale:()=>{},save:()=>{},restore:()=>{},createLinearGradient:()=>({addColorStop:()=>{}}),createRadialGradient:()=>({addColorStop:()=>{}}),measureText:()=>({width:0}),set font(_){},set fillStyle(_){},set strokeStyle(_){},set lineWidth(_){},set textAlign(_){},set textBaseline(_){}}),width:128,height:128,style:{}}), getElementById:()=>({style:{},addEventListener:()=>{},play:()=>Promise.resolve(),pause:()=>{},load:()=>{}}), querySelector:()=>null, body:{appendChild:()=>{}}, addEventListener:()=>{} },
    console: console,
    setTimeout: ()=>0, setInterval: ()=>0, clearTimeout: ()=>{}, clearInterval: ()=>{},
    requestAnimationFrame: ()=>0,
    performance: {now:()=>0},
    sessionStorage: {getItem:()=>null,setItem:()=>{}},
    navigator: {},
    Image: function(){},
    Math: Math, Date: Date, JSON: JSON,
    parseInt, parseFloat, isNaN, isFinite, undefined, NaN, Infinity,
    Array, Object, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Map, Set, WeakMap, WeakSet, Promise, Proxy, Float32Array, Uint8Array, Int16Array,
  };
  try {
    const script = new vm.Script(strictCode, { filename: 'index.html (strict lint)' });
    script.runInNewContext(sandbox, { timeout: 5000 });
  } catch (e) {
    if (e.message && e.message.includes('is not defined')) {
      console.error(`\n❌ BUILD FAILED: Undefined reference in strict mode`);
      console.error(`  ${e.message}`);
      console.error(`  This is likely a missing variable declaration (like the isLight bug).`);
      console.error(`  Fix: declare the variable or import it.\n`);
      fs.unlinkSync(outPath);
      process.exit(1);
    }
    // Other runtime errors during lint are expected (missing DOM context etc) — ignore
  }
}

const size = fs.statSync(outPath).size;
console.log(`Built index.html (${(size / 1024).toFixed(1)} KB)`);

// --- Luminance budget check (background must stay under the beam brightness) ---
// Every background/environment surface must sit below 22% WCAG relative
// luminance so the additive beams remain the brightest thing on screen. This
// scans src/background.js for the actual colours in the build, prints them, and
// HARD-FAILS if any exceeds the ceiling — so the sea can never drift bright
// again unnoticed (the previous "turquoise" regression went unchecked because
// no such gate existed).
(function luminanceBudget() {
  const LUM_CEIL = 0.22;
  const srcBg = fs.readFileSync(path.join(__dirname, 'src/background.js'), 'utf8');
  const relLum = (hex) => {
    const n = parseInt(hex.replace(/^#|^0x/i, ''), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  // The sea has a TIGHTER cap than the 22% global ceiling: it must stay within
  // the specified dark band #12303F(2.6%)..#1A4257(4.8%). The old regression
  // (#1f8f8a) measured 21.8% — under 22% yet visibly turquoise and washing out
  // the beams — so a plain 22% gate is too loose to protect the sea.
  const SEA_CEIL = relLum('#1A4257') + 0.005; // ~5.3%, small tolerance
  const surfaces = [];
  // Sea gradient stops inside drawSeaBase (checked against SEA_CEIL).
  const seaFn = (srcBg.match(/function drawSeaBase[\s\S]*?\n}/) || [''])[0];
  const stopRe = /addColorStop\([\d.]+,\s*'(#[0-9a-fA-F]{6})'\)/g;
  let m;
  const seaStops = [];
  while ((m = stopRe.exec(seaFn))) { seaStops.push(m[1]); }
  if (seaStops.length) {
    surfaces.push(['sea upper (top stop)', seaStops[0], SEA_CEIL]);
    surfaces.push(['sea lower (bottom stop)', seaStops[seaStops.length - 1], SEA_CEIL]);
    for (let i = 1; i < seaStops.length - 1; i++) surfaces.push([`sea mid stop ${i}`, seaStops[i], SEA_CEIL]);
  }
  // Named surface constants (checked against the global 22% ceiling).
  for (const name of ['COL_GROUND', 'COL_SKY', 'COL_WALL']) {
    const mm = srcBg.match(new RegExp(name + '\\s*=\\s*(0x[0-9a-fA-F]{6})'));
    if (mm) surfaces.push([name, mm[1], LUM_CEIL]);
  }
  console.log('\n  Luminance budget (sea cap ' + (SEA_CEIL * 100).toFixed(1) + '%, others ' + (LUM_CEIL * 100) + '%):');
  const offenders = [];
  for (const [name, hex, cap] of surfaces) {
    const L = relLum(hex);
    const over = L >= cap;
    console.log(`    ${name.padEnd(22)} ${hex}  ${(L * 100).toFixed(1)}%${over ? '  ✗ OVER' : ''}`);
    if (over) offenders.push(`${name} ${hex} ${(L * 100).toFixed(1)}% (cap ${(cap * 100).toFixed(1)}%)`);
  }
  console.log(`    ${'(ref) beam gold full'.padEnd(22)} #ffe9a0  ${(relLum('#ffe9a0') * 100).toFixed(1)}%  (additive; brightest on screen)`);
  if (offenders.length) {
    console.error(`\n❌ BUILD FAILED: background surface(s) over luminance cap:`);
    for (const o of offenders) console.error('  ' + o);
    console.error('  Sea must stay within #12303F..#1A4257 so the beams remain brightest.');
    // Delete the just-written output so a failed build can never leave a stale,
    // too-bright index.html on disk (matches the syntax/lint gates above).
    try { fs.unlinkSync(outPath); console.error('  (deleted index.html)\n'); } catch (_) { console.error(''); }
    process.exit(1);
  }
})();

// --- DEV flag validation ---
// Hard-error if any DEV flag is true (prevents shipping test overrides)
const configSrc = fs.readFileSync(path.join(__dirname, 'src/config.js'), 'utf8');
const devBlockMatch = configSrc.match(/export const DEV = \{([^}]+)\}/);
if (devBlockMatch) {
  const flagLines = devBlockMatch[1].split('\n');
  const activeFlags = [];
  for (const line of flagLines) {
    const m = line.match(/(\w+)\s*:\s*true/);
    if (m) activeFlags.push(m[1]);
  }
  if (activeFlags.length > 0) {
    if (process.argv.includes('--submission')) {
      console.error(`\n❌ BUILD FAILED: DEV flags active: ${activeFlags.join(', ')}`);
      console.error('  Cannot build submission with DEV overrides. Set all to false in config.js.\n');
      process.exit(1);
    }
    console.warn(`\n⚠ DEV FLAGS ACTIVE: ${activeFlags.join(', ')}`);
    console.warn('  Build is NOT submission-safe. Set all DEV flags to false before packaging.\n');
  }
}

// --- Helpers ---

function stripModuleSyntax(code) {
  // Remove import statements — both single-line and multi-line
  // Match: import ... from './something';
  // The [\s\S]*? handles multi-line destructured imports
  let result = code.replace(/import\s+[\s\S]*?\s+from\s+['"]\.\/.*?['"];?/g, '');
  // Also handle: import './foo.js'; (side-effect imports)
  result = result.replace(/import\s+['"]\.\/.*?['"];?/g, '');
  // Remove export keywords (keep the declarations)
  result = result.replace(/^export\s+(function|const|let|var|class)\s/gm, '$1 ');
  result = result.replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
  result = result.replace(/^export\s+default\s+/gm, '');
  return result;
}
