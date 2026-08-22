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
  'src/beam.js',
  'src/beam-render.js',
  'src/mirror.js',
  'src/prism.js',
  'src/enemy.js',
  'src/enemy-spawner.js',
  'src/foundry.js',
  'src/crafting.js',
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
<script src="./vendor/three.min.js"></script>
<script>
// THREE is available as a global from the vendor script above

${gameCode}
</script>
</body>
</html>
`;

const outPath = path.join(__dirname, 'index.html');
fs.writeFileSync(outPath, html, 'utf8');

const size = fs.statSync(outPath).size;
console.log(`Built index.html (${(size / 1024).toFixed(1)} KB)`);

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
