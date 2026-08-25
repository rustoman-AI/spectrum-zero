# BUILD LOG — Solar Siege

## Phase 1: Core Prototype

**c9eb9c3** — Initial prototype: beam ray-tracer, mirror reflection, prism splitting, enemy pool, damage system, foundry resource generation, crafting shop, win/lose state. Single-file HTML5 build with Three.js vendored.

**7df7175** — Burn feedback VFX (white flash on hit), pass-through foundries (beams no longer terminate at resource zones), rotation UX fix for touch, unlimited lives toggle for testing.

**66dc76d** — Solar Siege reskin: renamed from generic prototype, free mirror placement (no socket snapping), hearts/wall-integrity fix.

**54b59a5** — Game-over overlay with restart, beam-contact glow on enemies, destruction sequence (fragment debris), resonance mechanic (multi-beam synergy bonus), free placement cleanup.

## Phase 2: Gameplay Tuning

**0e70e8d** — Stable build: heat decay as separate accumulator (15%/s when beam leaves, not HP healing), paired spawning for multi-lane pressure, wall integrity system replacing lives, resonance balancing.

**87454b9** _(tag: submission-fallback)_ — Prism tier system (tiers 3–6), synergy scaled per tier (B(N) = 0.6/(N-1)) so focused DPS = 48 at all tiers, MAX_SEGMENTS raised to 24, first submission zip prepared.

## Phase 3: Reversed Layout Refactor

**8e36195** — Major layout flip: sun at top (y=48), ships spawn at y=40 and descend toward wall at y=-40, mirrors placed at y=-15 to -35 reflecting upward, altars below wall at y=-44. Initial commit had syntax error.

**526fa67** — Fix syntax error from refactor, add build-time syntax check (`new Function()` validation in build.js), prism positioned at PRISM_Y, beam reaches ships correctly.

**06acf70** — Visual fixes for reversed layout: sea fills middle band, ship silhouettes face downward, mirrors confirmed reflecting UP, prism at correct Y.

## Phase 4: Economy & Audio

**f606e54** — Four-currency altar economy (brass/bronze/silver/gold). 20% passive income, 80% beam-powered. Overheat at 6s continuous, 10s recovery. Wall-hit flash VFX. Spawn distribution: heavy centre + paired edges.

**bec50f0** — WebAudio synthesis: hum drone, chime (purchase), burn hiss, destruction boom, wall-hit impact, altar tone with overheat pitch drop. Voice cap (6 simultaneous). Hum ducking under explosions. Mute toggle. Overheat gauge bar. Craft affordability pulse. Spawn tuning.

## Phase 5: Intro & Defeat Cinematics

**1f6f596** — Intro video layer: 5-second failsafe timeout guarantees game starts regardless of video success. Error handler falls through to game.

**d50f8a9** — Re-encode video: H.264 Baseline profile Level 3.1, yuv420p, AAC stereo 96kbps, moov at front. File size 2.3MB.

**165ff84 → eed772d** — Six iterations on mobile video playback: cache-busting, gesture handling, layout reflow timing, error recovery. Root causes: iOS won't preload without gesture, Chrome rejects unmuted play on low-engagement sites.

**c202607** — Gate tap on canplaythrough with 4s fallback.

**35a5054** — Altar visibility overhaul: pulsing glow ring on unlit altars, steady metal glow when lit, curved overheat arc (green→yellow→red).

**f3030c4** — Replace intro video with archimed_intro.mp4 (English voiceover, 1.2MB re-encoded). White-flash transition at 8.0s, game starts at 8.3s.

**8f08a43** — Defeat cinematic: archimed_fail.mp4 (1.55MB). Plays once per session on first loss, skippable from first frame, preloaded during gameplay.

**01e60bd → d027c60** — Final mobile video fix: removed canplaythrough gate (iOS never fires it pre-gesture), start muted then unmute in .then() callback to satisfy Chrome's autoplay policy on low-engagement sites.

## Phase 6: Core Beam Fixes

**81e8a24** — Raw sun beam no longer damages or powers altars. Every segment tagged with `preSplit` flag. Pre-prism segments (sun→prism) are inert. Post-prism bands can damage and power altars. `getActiveTier()` properly imported — band count derives from prism presence/tier, no fallback to hardcoded 3.

**58db9b9** — Default mirrors set to vertical (π/2). Headless trace confirms: zero bands reach ship lanes without player input. Kill rate with no interaction: zero. The game now requires active mirror rotation to function.

## Phase 7: Polish (Current)

- Craft button affordability: full-contrast text + bright border when affordable, 300ms pulse at cost-crossing moment, 40% desaturated when not.
- Altar tone wired into main loop (was imported but never called).
- Contact glow, kill flash, sparks, debris, audio already functional from Phase 4.
- DESIGN_INTENT.docx rewritten: centered on the wall-vs-altar attention trade.

## Build System

- `node build.js` — concatenates ES module sources into single IIFE, wraps in HTML with Three.js vendor script, validates syntax via `new Function()`, outputs `index.html`.
- `node build.js --submission` — hard-errors if any DEV flags are true.
- Source modules in `src/`: main.js, beam.js, beam-render.js, mirror.js, prism.js, enemy.js, enemy-spawner.js, foundry.js, crafting.js, effects.js, audio.js, damage.js, session.js, input.js, background.js, config.js, strings.js, renderer.js.
- Vendor: `vendor/three.min.js` (Three.js r158).
- Assets: `assets/archimed_intro.mp4` (1.2MB), `assets/archimed_fail.mp4` (1.55MB), `assets/intro_poster.jpg` (48KB).
- Total zip size: **2.84 MB** (well under 35MB limit).

## Deployment

- GitHub Pages: https://rustoman-ai.github.io/spectrum-zero/
- Branch: master (Pages deploys from root)
- Safe revert point: `git tag submission-fallback` at commit 87454b9
