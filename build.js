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
  <video id="intro-video" src="./assets/fixed_intro.mp4?v=4" poster="./assets/intro_poster.jpg?v=4"
         playsinline webkit-playsinline preload="auto"
         style="max-width:100%;max-height:100%;object-fit:contain;"></video>
  <div id="intro-tap" style="position:absolute;bottom:15%;color:#fff;font:bold 16px monospace;opacity:0.8;pointer-events:none;">Tap to begin</div>
</div>
<div id="defeat-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:99998;background:#000;display:none;align-items:center;justify-content:center;">
  <video id="defeat-video" playsinline webkit-playsinline preload="none"
         style="max-width:100%;max-height:100%;object-fit:contain;"></video>
</div>
<div id="win-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:99998;background:#000;display:none;align-items:center;justify-content:center;">
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

  // On iOS, video won't load until a user gesture, so we allow tap immediately.
  // play() in the gesture handler will trigger load+play in one step.

  // --- TAP HANDLER ---
  layer.addEventListener('pointerdown', function() {
    if (started) return;
    started = true;
    // Strategy: start muted (always succeeds from gesture), then unmute immediately.
    // Chrome rejects unmuted play() on low-engagement sites, but allows unmuting
    // a playing video within the same user activation.
    video.muted = true;
    var playPromise = video.play();
    tapMsg.style.display = 'none';
    if (playPromise && playPromise.then) {
      playPromise.then(function() {
        // Unmute now — still within the user activation microtask chain
        video.muted = false;
        updateDebugInfo('video playing, unmuted');
      }).catch(function(err) {
        updateDebugInfo('play() failed entirely: ' + err.name);
        startGame();
      });
    } else {
      // Older browser, no promise — just unmute
      video.muted = false;
    }
    // 14-second failsafe (intro is 10.6s — this is emergency only)
    setTimeout(function() {
      if (!gameStarted) {
        updateDebugInfo('FAILSAFE 14s');
        startGame();
      }
    }, 14000);
  });

  video.addEventListener('ended', startGame);
  // Narration runs to ~10.5s (file is 10.6s). Let video play to end naturally.
  // No early timeupdate transition — the 'ended' event above handles handoff.
  video.addEventListener('error', function() {
    updateDebugInfo('video error');
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

// --- Defeat video layer ---
// Plays once per browsing session on first loss. Skippable. Falls back to defeat screen on any failure.
(function() {
  var defeatLayer = document.getElementById('defeat-layer');
  var defeatVideo = document.getElementById('defeat-video');
  var defeatPlayed = false;
  var defeatActive = false;
  var defeatDone = false;
  var FADE_START = 8.5;
  var FADE_CUT   = 9.0;

  // Check sessionStorage — only play once per browsing session
  try { defeatPlayed = sessionStorage.getItem('defeatPlayed') === '1'; } catch(e) {}

  // Preload: start fetching a few seconds into gameplay
  var preloadTimer = setTimeout(function() {
    if (!defeatPlayed) {
      defeatVideo.src = './assets/archimed_fail.mp4?v=3';
      defeatVideo.load();
    }
  }, 5000);

  // Exposed globally so session.js triggerLose can call it
  window.playDefeatCinematic = function(onDone) {
    // onDone: callback to show the defeat overlay
    if (defeatPlayed || defeatActive) { onDone(); return; }
    defeatActive = true;
    defeatDone = false;

    var finish = function() {
      if (defeatDone) return;
      defeatDone = true;
      defeatPlayed = true;
      try { sessionStorage.setItem('defeatPlayed', '1'); } catch(e) {}
      defeatVideo.pause();
      defeatLayer.style.display = 'none';
      onDone();
    };

    // If video not ready, skip straight to defeat screen
    if (!defeatVideo.src || defeatVideo.readyState < 2) {
      finish();
      return;
    }

    // Show layer and play
    defeatLayer.style.display = 'flex';
    defeatLayer.style.background = '#000';
    var playPromise = defeatVideo.play();
    if (playPromise && playPromise.then) {
      playPromise.catch(function() { finish(); });
    }

    // Fade-to-black transition
    defeatVideo.addEventListener('timeupdate', function onTime() {
      if (defeatDone) { defeatVideo.removeEventListener('timeupdate', onTime); return; }
      var t = defeatVideo.currentTime;
      if (t >= FADE_START) {
        defeatLayer.style.transition = 'background 0.5s';
        defeatLayer.style.background = '#000';
      }
      if (t >= FADE_CUT) {
        defeatVideo.removeEventListener('timeupdate', onTime);
        finish();
      }
    });

    // Fallbacks
    defeatVideo.addEventListener('ended', finish);
    defeatVideo.addEventListener('error', finish);

    // Skip on tap
    defeatLayer.addEventListener('pointerdown', function skipTap() {
      defeatLayer.removeEventListener('pointerdown', skipTap);
      finish();
    });

    // Failsafe: 12s max
    setTimeout(function() { if (!defeatDone) finish(); }, 12000);
  };
})();

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
      winActive = false;
      onDone();
    };

    // If video not ready, skip straight to victory screen
    if (!winVideo.src || winVideo.readyState < 2) {
      finish();
      return;
    }

    // Show layer and play
    winLayer.style.display = 'flex';
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
