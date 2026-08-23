// ============================================================
// verify.mjs — Independent validation of submission build
//
// Usage: node verify.mjs
// Checks: no DEV flags active, no external URLs, file structure.
// ============================================================

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let failures = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${name}`);
  } else {
    console.log(`  FAIL: ${name} — ${detail}`);
    failures++;
  }
}

console.log('=== Submission Verification ===\n');

// 1. DEV flags must all be false
const configSrc = readFileSync(join(__dirname, 'src/config.js'), 'utf8');
const devBlock = configSrc.match(/export const DEV = \{([^}]+)\}/);
if (devBlock) {
  const flags = devBlock[1].match(/(\w+)\s*:\s*true/g);
  if (flags) {
    for (const f of flags) {
      check(`DEV flag`, false, `${f.split(':')[0].trim()} is TRUE — must be false for submission`);
    }
  } else {
    check('All DEV flags false', true);
  }
} else {
  check('DEV block exists', false, 'Could not find DEV object in config.js');
}

// 2. index.html exists and has no external URLs
const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
check('index.html exists', html.length > 0);
const externalUrls = html.match(/https?:\/\//g);
check('Zero external URLs', !externalUrls, `Found ${externalUrls ? externalUrls.length : 0} external URLs`);

// 3. No import/export statements in built code
const imports = html.match(/\b(import|export)\b/g);
check('No import/export in build', !imports, `Found ${imports ? imports.length : 0} module keywords`);

// 4. vendor/three.min.js exists
try {
  const three = readFileSync(join(__dirname, 'vendor/three.min.js'), 'utf8');
  check('vendor/three.min.js present', three.length > 0);
} catch { check('vendor/three.min.js present', false, 'File not found'); }

// 5. No .env, no secrets
check('No .env file', (() => { try { readFileSync(join(__dirname, '.env')); return false; } catch { return true; } })());

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILURE(S) — not safe to submit.`}`);
process.exit(failures > 0 ? 1 : 0);
