# BUILD LOG — Solar Siege

## Phase 1: Core Prototype

**c9eb9c3** — Initial prototype: beam ray-tracer, mirror reflection, prism splitting, enemy pool, damage system, foundry resource generation, crafting shop, win/lose state. Single-file HTML5 build with Three.js vendored.

**7df7175** — Burn feedback VFX (white flash on hit), pass-through foundries (beams no longer terminate at resource zones), rotation UX fix for touch, unlimited lives toggle for testing.

**66dc76d** — Solar Siege reskin: renamed from generic prototype, free mirror placement (no socket snapping), hearts/wall-integrity fix.

**54b59a5** — Game-over overlay with restart, beam-contact glow on enemies, destruction sequence (fragment debris), resonance mechanic (multi-beam synergy bonus), free placement cleanup.

## Phase 2: Gameplay Tuning

**0e70e8d** — Stable build: heat decay as separate accumulator (15%/s when beam leaves, not HP healing), paired spawning for multi-lane pressure, wall integrity system replacing lives, resonance balancing.

**87454b9** _(tag: submission-fallback)_ — Prism tier system (tiers 3–6), synergy scaled per tier (B(N) = 0.6/(N-1)) so focused DPS = 48 at all tiers, MAX_SEGMENTS raised to 24, first DESIGN_INTENT and BUILD_LOG, submission zip prepared.

## Phase 3: Reversed Layout Refactor

**8e36195** — Major layout flip: sun at top (y=48), ships spawn at y=40 and descend toward wall at y=-40, mirrors placed at y=-15 to -35 reflecting upward, altars below wall at y=-44. Initial commit had syntax error.

**526fa67** — Fix syntax error from refactor, add build-time syntax check (`new Function()` validation in build.js), prism positioned at PRISM_Y, beam reaches ships correctly.

**06acf70** — Visual fixes for reversed layout: sea fills middle band, ship silhouettes face downward, mirrors confirmed reflecting UP, prism at correct Y.

## Phase 4: Economy & Audio

**f606e54** — Four-currency altar economy (brass/bronze/silver/gold). 20% passive income, 80% beam-powered. Overheat at 6s continuous, 10s recovery. Wall-hit flash VFX. Spawn distribution: heavy centre + paired edges.

**bec50f0** — WebAudio synthesis: hum drone, chime (purchase), burn hiss, destruction boom, wall-hit impact, altar tone. Overheat gauge bar (green→yellow→red). Craft affordability pulse (300ms highlight on state change). Spawn tuning.

## Phase 5: Intro Video & Mobile

**1f6f596** — Intro video layer: 5-second failsafe timeout guarantees game starts regardless of video success. Error handler falls through to game. Debug overlay (readyState, play result, WebGL status) behind `?debug=1` flag.

**d50f8a9** — Re-encode video with ffmpeg: H.264 Baseline profile Level 3.1, yuv420p, AAC stereo 96kbps, moov atom at front (`-movflags +faststart`). File size 2.3MB (down from 11.3MB Main profile). Real poster frame extracted.

**165ff84** — Mobile video fixes: cache-busting query (`?v=2`), `muted` attribute for autoplay policy, `play()` as first synchronous call in gesture handler, enhanced debug info.

**bb6432c** — Fix debug string: remove template literal newlines that broke concatenated build output.

**3030e11** — Remove `muted` attribute — user gesture is sufficient, narration audio track must play.

**64308c0** — Force layout reflow (`void video.offsetHeight`) before `play()` so video has non-zero dimensions on iOS.

**7bb72f1** — Move reflow to page-load time (outside tap handler). Safari's gesture token is consumed by synchronous reflow inside the handler.

**eed772d** — Only treat `NotAllowedError` as fatal in play() catch. `AbortError` (media not buffered) lets the video attempt recovery; 5s failsafe covers worst case.

**c202607** — Gate tap on `canplaythrough`: show "Loading…" until video is buffered (or 4s timeout), then swap to "Tap to begin" and enable handler. Timeout skips intro entirely. Eliminates buffering race. Debug flag now only displays diagnostics, never changes behaviour.

## Phase 6: Polish (Current)

- Altar visibility overhaul: pulsing glow ring on unlit altars (sine-wave animation draws player attention), steady metal-coloured glow when lit, curved overheat arc (RingGeometry with partial theta, green→yellow→red transition).
- Craft affordability pulse confirmed working (already implemented in Phase 4).
- DESIGN_INTENT.docx written (under 500 words, no identifying information).

## Build System

- `node build.js` — concatenates ES module sources into single IIFE, wraps in HTML with Three.js vendor script, validates syntax via `new Function()`, outputs `index.html`.
- `node build.js --submission` — hard-errors if any DEV flags are true.
- Source modules in `src/`: main.js, beam.js, enemy.js, foundry.js, crafting.js, prism.js, renderer.js, config.js, audio.js, effects.js, hud.js, spawner.js, session.js, input.js, background.js.
- Vendor: `vendor/three.min.js` (Three.js r158).
- Assets: `assets/syracuse_intro.mp4` (2.3MB), `assets/intro_poster.jpg` (75KB).
- Total build size: ~107KB HTML + 670KB Three.js + 2.4MB assets ≈ 3.2MB (well under 35MB limit).

## Deployment

- GitHub Pages: https://rustoman-ai.github.io/spectrum-zero/
- Branch: master (Pages deploys from root)
- Safe revert point: `git tag submission-fallback` at commit 87454b9
