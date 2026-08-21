# Spectrum Zero - Build Log

Maintained from the first session. One entry per session recording decisions locked and what was built.

---

## 2026-08-20 — Session 1: Spec Phase

**What was built:**
- `requirements.md` — 10 functional requirement groups + non-functional requirements, all numbers from the GDD
- `design.md` — full technical architecture: 15-file module structure, game loop order, dirty-flag beam caching, component designs for beam solver, mirrors, prisms, enemies (instanced pool), damage, foundries, crafting, session controller, drift, audio, feedback
- `tasks.md` — 48 tasks across 6 vertical-slice milestones (M1–M6)
- `.kiro/steering/spectrum-zero-constraints.md` — persistent steering file with all hard constraints

**Decisions locked:**
- Orthographic camera, world height = 100 units, Y-up, origin at centre
- Beam solver: iterative raycast, max 8 bounces, 12 segments, event-driven recompute only
- Beam rendering: quad mesh pool with additive blending (not THREE.Line)
- Enemy pool size: 64 instanced planes
- Build system: plain Node concat script (`build.js`), no bundler
- Three.js in `vendor/three.module.js`, imported via relative path in the HTML template
- All balance numbers in `src/config.js`, no magic numbers elsewhere
- File size cap: 300 lines per source file

**Open from GDD (not yet resolved):**
1. Recombination win condition legibility — keeping both paths (kill Devourer OR 100% Recombination) for now, will test in M4
2. Three bands on 5-inch portrait — will validate in M1 greybox
3. Drift fairness — will tune in M4

**Next session:** Begin M1 implementation (beam solve, mirrors, prism, grey-box visuals, build.js).

---

## 2026-08-20 — Session 2: M1 Implementation Start

**Decision locked:**
- Sockets are GENERIC. A socket holds exactly one object (mirror or prism). Dragging onto an occupied socket swaps the two objects. Prisms share the mirror socket grid — no dedicated prism slots. Rationale: one interaction vocabulary, socket scarcity is the strategy, saves portrait screen space.

**Building:**
- M1: beam solve, 4 mirrors, 1 prism, grey-box visuals, build.js

**Built:**
- `src/config.js` — all balance numbers, socket grid (3x4 = 12 sockets), phase timings
- `src/renderer.js` — Three.js ortho camera, resize, screenToWorld
- `src/beam.js` — iterative raycast solver with reflection math (commented) and prism split
- `src/beam-render.js` — quad mesh pool with additive blending glow
- `src/mirror.js` — generic socket system, 4 mirrors, drag/rotate/damage/repair
- `src/prism.js` — prism placement sharing socket grid, swap logic
- `src/input.js` — pointer events, IDLE→DRAG→ROTATE state machine
- `src/main.js` — game loop with dirty-flag beam caching
- `vendor/three.module.js` — Three.js r160
- `build.js` — Node concat script, strips imports/exports, produces index.html
- `test-headless.js` — Node smoke test (mock THREE, verify init + beam solve)

**Verified:**
- `node build.js` → 29.2 KB index.html, syntax valid
- `node test-headless.js` → PASS (2 segments, 4 mirrors, 1 prism)
- Zero external URLs in output
- No naming collisions in flat scope


---

## 2026-08-20 — Session 3: M1 Fixes + M2 Implementation

**Fixes applied:**
- Portrait lock: fixed 9:16 canvas with letterboxing
- Duplicate bands: excludePrism prevents sub-beam re-hitting same prism
- Divergence angle: PRISM_SPREAD_DEG=20 (10deg per outer band, tunable)
- Colours: Amber=#FF8C1A (warm orange), Gold=#FFE9A0 (pale white-gold, 60% width, pulses)
- Band width encodes power: thickness proportional to intensity
- Double-sided mirrors: beams cannot pass through from any direction
- Z-order: beams behind objects (z=-0.3/-0.5), mirrors z=0, prism z=0.2
- Input redesigned: tap-select (highlight ring), swipe-rotate, drag-move, no timing dependency
- Vendor renamed to three.min.js (UMD build, plain script tag)

**M2 built:**
- src/enemy.js: 64-enemy pool, per-enemy mesh, lane movement, breach detection
- src/enemy-spawner.js: Phase 1 motes every 2.5s, Phase 2 husks+carapaces every 1.8s, escalation hp_multiplier = 1 + (t/900)*3
- src/damage.js: DPS = N * D_BASE * (1 + SYNERGY_BONUS * (N-1)), armour subtraction, gold slow, kill awards Slag
- src/session.js: timer, breach counter (3 = lose), game-over overlay, tap-to-restart, HUD
- main.js: full game loop with all M2 systems integrated

**Decisions locked:**
- Mirrors are double-sided (deliberate — beams never pass through)
- Enemy pool uses individual meshes (not InstancedMesh) for now — optimise in M5 if needed
- Slag earned from kills tracked globally, will connect to crafting in M3

**Headless test caveat:**
- Mock extended with addEventListener/textContent on DOM elements and Shape/ShapeGeometry on THREE. These are standard APIs in real browsers; mock additions are for test coverage, not code correctness.


---

## 2026-08-20 — Session 4: Feel Fixes + M3 Implementation

**Feel fixes:**
- Mirror tween: 120ms ease-out snap with beam sweeping during interpolation
- Drop-target highlight: yellow ring shows nearest socket during drag
- Spawn ramp: 3s initial delay, interval ramps from 3.5s→2.0s over Phase 1
- Game-over: full dim quad + frozen enemies + text overlay in-scene

**M3 built:**
- src/foundry.js: 3 foundries (Forge/LensWorks/Chorus), segment-hit detection, resource accumulation at GDD rates
- src/crafting.js: 6-button canvas-texture tray, purchase logic, effects (prism/repair/reinforce/focus/anchor)
- src/session.js: win state (Recombination >= 100% OR Devourer killed), HUD with timer+hearts+recombination%, timer red at 12:00
- Damage now routes kill Slag through foundry.js, uses Focus multiplier

**Decisions locked:**
- Slag from kills goes to the same pool as foundry production (single resource, not separate)
- Focus multiplier stacks: each purchase is +15% of D_BASE
- Crafting tray positioned above foundries (y = FOUNDRY_Y + 8)
- BREACH_Y derived from FOUNDRY_Y + 5 (single source of truth)

**Test suite: 23 assertions, all pass.**


---

## 2026-08-20 — Session 5: Absorption & Layout Fix

**Critical fix: Beam absorption at foundries**
- Foundries are now absorbing surfaces in the beam solver. A band that hits a foundry TERMINATES there — it does not continue to the enemy zone.
- This creates the core GDD tradeoff: a band is either burning enemies OR banking resources, never both.
- Foundries added to `castRay` via `rayAABBIntersect`.

**Foundry positions (iterated through several failures):**
- Final: Forge x=-15, Lens Works x=+14, Chorus x=+22 (hw=5, hh=3)
- On load: zero foundries fed, all three bands reach y=-50 (enemy zone)
- Gold band at 10° reaches x=7 at y=-15.2 — misses Lens left edge at x=9
- Each foundry reachable with one mirror redirect

**Other fixes this round:**
- Craft tray: DOM element below canvas in letterbox bar, falls back to overlapping if no room
- Overlay z-order: depthTest=false + renderOrder 998/999, always draws on top
- Zone order corrected: Mirror field → Foundry band (y=-15) → Breach line (y=-24) → Enemy zone

**Test suite: 27 assertions, all pass.**
New assertions: zero foundries fed on load, absorbed band has no segment below foundry, absorbed band stops damaging enemies below.

**Decisions locked:**
- Foundry absorption is permanent game rule (band terminates, does not pass through)
- Foundry positions are asymmetric (-15/+14/+22) — visual asymmetry accepted for gameplay symmetry
