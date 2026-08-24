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
  'src/session.js',
  'src/input.js',
  'src/main.js',
];

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
<title>Solar Siege</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; touch-action: none; }
canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="intro-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;">
  <video id="intro-video" src="./assets/syracuse_intro.mp4?v=2" poster="./assets/intro_poster.jpg?v=2"
         playsinline webkit-playsinline preload="auto"
         style="max-width:100%;max-height:100%;object-fit:contain;"></video>
  <div id="intro-tap" style="position:absolute;bottom:15%;color:#fff;font:bold 16px monospace;opacity:0.8;pointer-events:none;">Tap to begin</div>
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

  // Force layout at load time so video has computed dimensions before any gesture.
  // iOS Safari refuses play() on a zero-size video, and doing reflow inside the tap
  // handler burns the gesture token. This must happen BEFORE the tap listener.
  void video.offsetHeight;

  if (debugMode) {
    debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;bottom:10px;left:10px;color:lime;font:11px monospace;z-index:999999;background:rgba(0,0,0,0.8);padding:6px;white-space:pre;';
    document.body.appendChild(debugEl);
    updateDebugInfo('waiting for tap');
  }

  // Tap to play — video.play() MUST be the FIRST call in the gesture handler.
  // Nothing synchronous before play() — Safari's gesture token is fragile.
  layer.addEventListener('pointerdown', function() {
    if (!started) {
      started = true;
      // FIRST: start playback synchronously in the gesture — no work before this.
      // Even if readyState is 0, calling play() registers the user activation;
      // the browser will begin playback once data arrives.
      var playPromise = video.play();
      // THEN: UI updates
      tapMsg.style.display = 'none';
      if (playPromise && playPromise.then) {
        playPromise.then(function() {
          updateDebugInfo('video playing, readyState=' + video.readyState);
        }).catch(function(err) {
          // NotAllowedError = gesture not honoured, bail immediately.
          // AbortError = media not ready yet — do NOT kill the intro, let failsafe handle.
          updateDebugInfo('play() catch: ' + err.name + ' ' + err.message);
          if (err.name === 'NotAllowedError') {
            startGame();
          }
          // For any other error, the 5s failsafe will start the game if video never plays.
        });
      }
      // 5-second failsafe: if game hasn't started, force it
      setTimeout(function() {
        if (!gameStarted) {
          updateDebugInfo('FAILSAFE: 5s timeout, forcing game start');
          startGame();
        }
      }, 5000);
    }
  });

  video.addEventListener('ended', startGame);
  video.addEventListener('error', function() {
    updateDebugInfo('video error — forcing game start');
    startGame();
  });

  // Skip by tapping during playback
  video.addEventListener('pointerdown', function(e) {
    if (started && !video.ended && !gameStarted) {
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
      updateDebugInfo('startGame OK, WebGL=' + (!!document.querySelector('canvas')));
    } catch(e) {
      updateDebugInfo('init ERROR: ' + e.message);
    }
  }

  function updateDebugInfo(msg) {
    if (!debugEl) return;
    debugEl.textContent = 'DEBUG ' + msg + ' | vidReady=' + (video ? video.readyState : '?') + ' | muted=' + (video ? video.muted : '?') + ' | game=' + gameStarted + ' | canvas=' + (!!document.querySelector('canvas'));
  }
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

const size = fs.statSync(outPath).size;
console.log(`Built index.html (${(size / 1024).toFixed(1)} KB)`);

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
