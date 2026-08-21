---
inclusion: auto
---

# Spectrum Zero - Hard Constraints & Tech Decisions

These rules are NON-NEGOTIABLE across every session. Treat any violation as a build failure.

## Packaging (validation-critical)

1. Final deliverable is a single `.zip` under 35 MB with `index.html` at the TOP LEVEL (not inside a folder).
2. ALL game code ends up inside `index.html`, readable and unminified. Develop in separate source files under `src/`, then assemble with `build.js` (plain Node concatenation script). No bundler, no minification, no source maps.
3. Three.js lives in `vendor/three.module.js` and is referenced by RELATIVE PATH. It must NOT be embedded in `index.html`.
4. ZERO network requests at runtime. No CDN, no Google Fonts, no analytics, no fetch, no XHR, no external URLs of any kind. The game must run correctly from a `file://` URL with the network disabled.
5. All assets, fonts, and data ship inside the zip with relative paths.
6. Portrait orientation only. Single-player. Single touch, pointer events only, no multitouch gestures.

## Tech Stack (already decided, do not re-litigate)

- Three.js with an orthographic camera. 2D game rendered in 3D for additive blending and shaders.
- Beam paths solved by iterative raycast, capped at 8 bounces and 12 segments. Recompute ONLY on event (mirror moved, mirror rotated, prism placed, source drifted). Cache segments between frames. Idle frames must NOT re-solve.
- Beam segments rendered as quad meshes with additive glow material. Do NOT use `THREE.Line`.
- Enemies are pooled instanced planes. No per-enemy allocation during a run.
- Audio is WebAudio synthesis only. No audio files anywhere in the project.
- No persistence, no save system, no meta-progression. Every run starts fresh.
- Target 60 fps on a mid-tier Android phone.

## Code Rules

- Vanilla JS modules, no framework, no TypeScript, no npm runtime dependencies.
- All balance numbers (`D_BASE`, `SYNERGY_BONUS`, HP curve, foundry rates, craft costs, phase timings) live in a single `src/config.js`. No magic numbers in gameplay code.
- Every file under 300 lines. Split when it grows past that.
- Comment the beam reflection math and the damage formula. Leave the rest clean.

## Build Order (vertical slices)

M1: Beam solve, 4 draggable/rotatable mirrors, 1 prism, grey-boxed everything.
M2: Enemy spawner, damage math, escalation curve, lose state.
M3: Three foundries, Slag and Insight resources, crafting tray, win state.
M4: The four-phase 15-minute arc, source drift, boss, tuning pass.
M5: Feedback pass (colour return, burn meters, particles, WebAudio, timer pressure).
M6: Build script, vendor folder, offline validation, zip packaging.

## Process

- Maintain `BUILD_LOG.md` from the first session. Append a dated entry per session recording decisions locked and what was built.
- The GDD (`spectrum-zero-gdd.md`) is the source of truth for gameplay, math, and balance. Follow its numbers exactly. Do not invent new mechanics.
